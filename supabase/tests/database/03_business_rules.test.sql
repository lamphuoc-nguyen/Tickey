-- ============================================================================
-- pgTAP: quy tắc nghiệp vụ chưa có test ở 02_core_flows.
--   Giá và chủ Booking do server quyết định (mục 7.1)    IPN sai số tiền (mục 5)
--   Phân quyền Staff theo Session, thiết bị, tenant (mục 23)
--   Soát vé: ISSUED -> USED đúng một lần, quét lại, sai Session, vé VOID (mục 6, 23.3)
--   Đồng bộ offline: First Write Wins, DUPLICATE_ENTRY (mục 23.2)
--   Kết thúc Session: vé chưa dùng thành NO_SHOW, mở đối soát (mục 5, 6)
-- Thời gian Session được dời trực tiếp (now() cố định trong transaction) để có "đang mở cổng".
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- ---------------------------------------------------------------- fixture
create temp table fx (k text primary key, v uuid);
create temp table pay (k text primary key, ref text);
grant all on fx, pay to anon, authenticated, service_role;

create function pg_temp.act_as(p_uid uuid, p_aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true) $$;
create function pg_temp.fx(p_k text) returns uuid language sql stable as $$ select v from fx where k = p_k $$;
create function pg_temp.ref(p_k text) returns text language sql stable as $$ select ref from pay where k = p_k $$;
grant execute on function pg_temp.act_as(uuid, text), pg_temp.fx(text), pg_temp.ref(text) to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid, 'br' || n || '@test.vn',
       jsonb_build_object('full_name', 'User ' || n)
from generate_series(1, 8) n;
insert into fx values
  ('owner_a', '00000000-0000-0000-0000-000000000001'), ('owner_b', '00000000-0000-0000-0000-000000000002'),
  ('admin',   '00000000-0000-0000-0000-000000000003'), ('c1', '00000000-0000-0000-0000-000000000004'),
  ('c2',      '00000000-0000-0000-0000-000000000005'), ('c3', '00000000-0000-0000-0000-000000000006'),
  ('staff_a', '00000000-0000-0000-0000-000000000007'), ('staff_b', '00000000-0000-0000-0000-000000000008');
insert into public.memberships (user_id, scope, roles)
values (pg_temp.fx('admin'), 'PLATFORM', array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']);
insert into public.signing_keys (kid, public_key) values ('br-test-kid', 'br-test-public-key');

create function pg_temp.setup_org(p_owner uuid, p_slug text) returns uuid language plpgsql as $$
declare v_org uuid; v_kyc uuid;
begin
  perform pg_temp.act_as(p_owner);
  v_org := public.create_organization('Org ' || p_slug, p_slug);
  v_kyc := public.submit_kyc(v_org, '{}', p_slug, jsonb_build_array(jsonb_build_object(
             'doc_type', 'BUSINESS_LICENSE', 'storage_path', v_org || '/gpkd.pdf')));
  perform pg_temp.act_as(pg_temp.fx('admin'));
  perform public.review_kyc(v_kyc, 'APPROVED');
  return v_org;
end $$;

-- Một Session đang bán, Zone ngồi A với 5 ghế, hạng vé VIP 300.000đ
create function pg_temp.setup_catalog(p_owner uuid, p_org uuid, p_prefix text) returns void language plpgsql as $$
declare v_venue uuid; v_lv uuid; v_ev uuid; v_ses uuid; v_zone uuid;
begin
  perform pg_temp.act_as(p_owner);
  v_venue := public.save_venue(jsonb_build_object('tenant_id', p_org, 'name', 'Venue ' || p_prefix,
             'address_line', '1 Le Loi', 'city', 'TP.HCM', 'capacity', 1000));
  v_lv := (public.create_layout(v_venue, 'Main') ->> 'layout_version_id')::uuid;
  perform public.save_layout_draft(v_lv, '{"zones":[{"id":"A","name":"Khu A","type":"seated","seats":[
     {"id":"A-1","row":"1","number":"1","x":0,"y":0},{"id":"A-2","row":"1","number":"2","x":1,"y":0},
     {"id":"A-3","row":"1","number":"3","x":2,"y":0},{"id":"A-4","row":"1","number":"4","x":3,"y":0},
     {"id":"A-5","row":"1","number":"5","x":4,"y":0}]}]}');
  perform public.publish_layout_version(v_lv);
  v_ev := public.save_event(jsonb_build_object('tenant_id', p_org, 'title', 'Event ' || p_prefix,
                                               'slug', 'br-event-' || p_prefix));
  v_ses := public.save_session(jsonb_build_object('event_id', v_ev, 'venue_id', v_venue, 'layout_version_id', v_lv,
             'starts_at', now() + interval '2 days', 'ends_at', now() + interval '2 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '2 days'));
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  insert into fx values (p_prefix || '_ses', v_ses),
    (p_prefix || '_tt', public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP', 'kind', 'PAID',
       'price_amount', 300000, 'quota', 5, 'zone_ids', jsonb_build_array(v_zone))));
  insert into fx select p_prefix || '_' || lower(replace(seat_code, '-', '')), id
  from public.seats where layout_version_id = v_lv;
  perform public.submit_event_for_review(v_ev);
  perform pg_temp.act_as(pg_temp.fx('admin'));
  perform public.review_event(v_ev, 'APPROVED');
end $$;

-- Khách đặt các ghế p_seats của Session p_prefix; item mang thêm giá giả để kiểm tra server bỏ qua
create function pg_temp.book(p_key text, p_user text, p_prefix text, p_seats text[], p_options jsonb default '{}')
returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.fx(p_user), 'aal1');
  insert into fx values (p_key, (public.create_booking(pg_temp.fx(p_prefix || '_ses'),
    (select jsonb_agg(jsonb_build_object('ticket_type_id', pg_temp.fx(p_prefix || '_tt'),
                                         'seat_id', pg_temp.fx(p_prefix || '_' || s),
                                         'price_amount', 1, 'unit_price', 1))
     from unnest(p_seats) s),
    p_key || '-idem-key', p_options) ->> 'id')::uuid);
  insert into pay values (p_key, public.begin_payment(pg_temp.fx(p_key), 'VNPAY') -> 'payment' ->> 'order_ref');
end $$;
grant execute on function pg_temp.book(text, text, text, text[], jsonb) to authenticated;

-- Vé của ghế p_seat trong Session p_prefix (id lưu vào fx sau khi phát vé; Staff không đọc được bảng tickets qua RLS)
create function pg_temp.ticket(p_prefix text, p_seat text) returns uuid language sql stable as $$
  select pg_temp.fx('t_' || p_prefix || '_' || p_seat) $$;
grant execute on function pg_temp.ticket(text, text) to authenticated;

create function pg_temp.scan(p_ticket uuid, p_scan_id text, p_device text default 'dev_a') returns text
language sql as $$
  select public.check_in(p_ticket, pg_temp.fx('a_ses'), null, pg_temp.fx(p_device), p_scan_id) ->> 'result' $$;
grant execute on function pg_temp.scan(uuid, text, text) to authenticated;

-- Log offline: một lượt quét local_result OK lúc now() - p_minutes_ago phút
create function pg_temp.sync_one(p_ticket uuid, p_scan_id text, p_minutes_ago int) returns jsonb language sql as $$
  select public.sync_offline_scans(pg_temp.fx('a_ses'), pg_temp.fx('dev_a'), jsonb_build_array(jsonb_build_object(
    'client_scan_id', p_scan_id, 'ticket_id', p_ticket, 'gate_id', null,
    'scanned_at', now() - make_interval(mins => p_minutes_ago), 'local_result', 'OK'))) $$;
grant execute on function pg_temp.sync_one(uuid, text, int) to authenticated;

do $$
begin
  insert into fx values ('org_a', pg_temp.setup_org(pg_temp.fx('owner_a'), 'br-org-a')),
                        ('org_b', pg_temp.setup_org(pg_temp.fx('owner_b'), 'br-org-b'));
  perform pg_temp.setup_catalog(pg_temp.fx('owner_a'), pg_temp.fx('org_a'), 'a');
  perform pg_temp.setup_catalog(pg_temp.fx('owner_b'), pg_temp.fx('org_b'), 'b');
  perform public.run_session_status_transitions();
end $$;
insert into public.memberships (user_id, scope, org_id, roles) values
  (pg_temp.fx('staff_a'), 'ORG', pg_temp.fx('org_a'), array['SCANNER']),
  (pg_temp.fx('staff_b'), 'ORG', pg_temp.fx('org_b'), array['SCANNER']);

-- ---------------------------------------------------------------- giá và chủ Booking do server quyết định
set local role authenticated;
do $$ begin
  perform pg_temp.book('bk_c1', 'c1', 'a', array['a1', 'a2'], jsonb_build_object('user_id', pg_temp.fx('c2')));
  perform pg_temp.book('bk_c2', 'c2', 'a', array['a3', 'a4']);
  perform pg_temp.book('bk_mis', 'c3', 'a', array['a5']);
  perform pg_temp.book('bk_b', 'c3', 'b', array['a1']);
end $$;
reset role;
select is((select total_amount from public.bookings where id = pg_temp.fx('bk_c1')), 600000::bigint,
          'Giá do server tính: 2 ghế x 300.000đ, bỏ qua price_amount/unit_price client gửi');
select is((select array_agg(distinct unit_price) from public.booking_items where booking_id = pg_temp.fx('bk_c1')),
          array[300000::bigint], 'Đơn giá chụp vào Booking là giá của hạng vé');
select is((select user_id from public.bookings where id = pg_temp.fx('bk_c1')), pg_temp.fx('c1'),
          'Chủ Booking là auth.uid(), không phải user_id client gửi');

-- ---------------------------------------------------------------- IPN sai số tiền
set local role service_role;
select is(public.apply_payment_success(pg_temp.ref('bk_mis'), 'TXN-MIS', 1000, '{}') ->> 'result', 'AMOUNT_MISMATCH',
          'IPN sai số tiền bị từ chối');
reset role;
select is((select status from public.bookings where id = pg_temp.fx('bk_mis')), 'PAYMENT_PENDING',
          'IPN sai số tiền: Booking không sang PAID');
select ok((select flagged from public.bookings where id = pg_temp.fx('bk_mis')),
          'IPN sai số tiền: Booking bị gắn cờ để Admin xử lý');
select is((select count(*)::int from public.outbox where topic = 'ISSUE_TICKETS' and aggregate_id = pg_temp.fx('bk_mis')), 0,
          'IPN sai số tiền: không phát vé');

-- Thanh toán đúng và phát vé cho các Booking còn lại
set local role service_role;
do $$ begin
  perform public.apply_payment_success(pg_temp.ref(k), 'TXN-' || k, (select total_amount from public.bookings
                                       where id = pg_temp.fx(k)), '{}')
  from unnest(array['bk_c1', 'bk_c2', 'bk_b']) k;
end $$;
reset role;
do $$ begin
  perform public.issue_tickets(pg_temp.fx(k), 'br-test-kid') from unnest(array['bk_c1', 'bk_c2', 'bk_b']) k;
end $$;
insert into fx select 't_' || f.k, t.id
from fx f join public.tickets t on t.seat_id = f.v
where f.k ~ '^[ab]_a[0-9]$';
select is((select count(*)::int from public.tickets where booking_id = pg_temp.fx('bk_c1') and status = 'ISSUED'), 2,
          'Phát đúng N vé ISSUED cho Booking N ghế');
do $$ begin perform public.issue_tickets(pg_temp.fx('bk_c1'), 'br-test-kid'); end $$;  -- worker chạy lại
select is((select count(*)::int from public.tickets where booking_id = pg_temp.fx('bk_c1')), 2,
          'Phát vé idempotent: chạy lại không tạo thêm vé');

-- Dời Session A về "đang mở cổng": cửa mở 1 giờ trước, kết thúc sau 2 giờ
update public.sessions
   set doors_open_at = now() - interval '1 hour', starts_at = now() - interval '30 minutes',
       ends_at = now() + interval '2 hours', sales_end_at = now() + interval '1 hour'
 where id = pg_temp.fx('a_ses');

-- ---------------------------------------------------------------- phân công Staff
do $$ begin perform pg_temp.act_as(pg_temp.fx('c1')); end $$;
select throws_ok(format('select public.check_in(%L, %L, null, gen_random_uuid(), %L)',
                        pg_temp.ticket('a', 'a1'), pg_temp.fx('a_ses'), 'x-0'),
                 'P0001', 'FORBIDDEN', 'Khách (không phải Staff) không soát vé được');
do $$ begin perform pg_temp.act_as(pg_temp.fx('staff_a')); end $$;
select throws_ok(format('select public.check_in(%L, %L, null, gen_random_uuid(), %L)',
                        pg_temp.ticket('a', 'a1'), pg_temp.fx('a_ses'), 'x-1'),
                 'P0001', 'FORBIDDEN', 'Staff chưa được phân công Session: không soát vé được');
select throws_ok(format('select public.assign_staff(%L, %L, %L)', pg_temp.fx('a_ses'), pg_temp.fx('staff_a'), '{SCAN}'),
                 'P0001', 'FORBIDDEN', 'Staff (SCANNER) không tự phân công cho mình');
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_b')); end $$;
select throws_ok(format('select public.assign_staff(%L, %L, %L)', pg_temp.fx('a_ses'), pg_temp.fx('staff_b'), '{SCAN}'),
                 'P0001', 'FORBIDDEN', 'Org B không phân công Staff cho Session của Org A');
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
select throws_ok(format('select public.assign_staff(%L, %L, %L)', pg_temp.fx('a_ses'), pg_temp.fx('c1'), '{SCAN}'),
                 'P0001', 'VALIDATION_FAILED', 'Không phân công người không phải Staff của Org');
select throws_ok(format('select public.assign_staff(%L, %L, %L)', pg_temp.fx('a_ses'), pg_temp.fx('staff_a'), '{POS}'),
                 'P0001', 'VALIDATION_FAILED', 'Quyền POS cần vai trò POS');
do $$ begin
  insert into fx values ('asg_a', public.assign_staff(pg_temp.fx('a_ses'), pg_temp.fx('staff_a'), array['SCAN']));
end $$;
select ok((select now() between valid_from and valid_until from public.staff_assignments where id = pg_temp.fx('asg_a')),
          'Phân công mặc định có hiệu lực từ trước giờ mở cổng đến sau khi kết thúc');

-- ---------------------------------------------------------------- thiết bị
do $$ begin perform pg_temp.act_as(pg_temp.fx('staff_b')); end $$;
select throws_ok(format('select public.register_gate_device(%L, %L, %L, %L)', pg_temp.fx('org_a'), 'fp-b', 'Pixel', 'ANDROID'),
                 'P0001', 'FORBIDDEN', 'Staff Org B không đăng ký thiết bị vào Org A');
do $$ begin
  perform pg_temp.act_as(pg_temp.fx('staff_a'));
  insert into fx values ('dev_a', (public.register_gate_device(pg_temp.fx('org_a'), 'fp-a', 'Pixel', 'ANDROID')
                                   ->> 'device_id')::uuid);
end $$;
select throws_ok(format('select public.check_in(%L, %L, null, gen_random_uuid(), %L)',
                        pg_temp.ticket('a', 'a1'), pg_temp.fx('a_ses'), 'x-2'),
                 'P0001', 'FORBIDDEN', 'Thiết bị chưa đăng ký: không soát vé được');

-- ---------------------------------------------------------------- soát vé online
set local role authenticated;
select is(pg_temp.scan(pg_temp.ticket('a', 'a1'), 'on-1'), 'OK', 'Quét vé ISSUED hợp lệ: OK');
reset role;
select is((select status from public.tickets where id = pg_temp.ticket('a', 'a1')), 'USED', 'Vé chuyển ISSUED -> USED');
set local role authenticated;
select is(pg_temp.scan(pg_temp.ticket('a', 'a1'), 'on-2'), 'ALREADY_USED', 'Quét lại vé đã dùng: ALREADY_USED');
select is(public.check_in(pg_temp.ticket('a', 'a1'), pg_temp.fx('a_ses'), null, pg_temp.fx('dev_a'), 'on-1') ->> 'replayed',
          'true', 'Gửi lại cùng client_scan_id: trả kết quả cũ, không xử lý lại');
reset role;
select is((select count(*)::int from public.scan_logs where client_scan_id = 'on-1'), 1,
          'Gửi lại cùng client_scan_id không ghi thêm log');
set local role authenticated;
select is(pg_temp.scan(pg_temp.ticket('b', 'a1'), 'on-3'), 'WRONG_SESSION', 'Vé của Session khác: WRONG_SESSION');
reset role;
update public.tickets set status = 'VOID' where id = pg_temp.ticket('a', 'a2');
set local role authenticated;
select is(pg_temp.scan(pg_temp.ticket('a', 'a2'), 'on-4'), 'REVOKED', 'Vé VOID: REVOKED');
do $$ begin perform pg_temp.act_as(pg_temp.fx('staff_b')); end $$;
select throws_ok(format('select public.check_in(%L, %L, null, %L, %L)',
                        pg_temp.ticket('a', 'a3'), pg_temp.fx('a_ses'), pg_temp.fx('dev_a'), 'x-3'),
                 'P0001', 'FORBIDDEN', 'Staff Org B không soát vé Session của Org A');
reset role;
select throws_ok(format('update public.tickets set status = %L where id = %L', 'ISSUED', pg_temp.ticket('a', 'a1')),
                 'P0001', 'INVALID_STATE', 'Vé USED không quay về ISSUED');

-- ---------------------------------------------------------------- đồng bộ offline: First Write Wins
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('staff_a')); end $$;
select is((pg_temp.sync_one(pg_temp.ticket('a', 'a3'), 'off-1', 10) ->> 'processed')::int, 1, 'Đồng bộ offline: xử lý 1 lượt quét');
select ok(pg_temp.sync_one(pg_temp.ticket('a', 'a3'), 'off-2', 20) -> 'duplicate_ticket_ids' ? pg_temp.ticket('a', 'a3')::text,
          'Vé vào hai lần (offline): báo DUPLICATE_ENTRY');
select is((pg_temp.sync_one(pg_temp.ticket('a', 'a3'), 'off-1', 10) ->> 'processed')::int, 0,
          'Đồng bộ lại cùng log: không xử lý lần hai');
reset role;
select is((select used_at from public.tickets where id = pg_temp.ticket('a', 'a3')), now() - interval '20 minutes',
          'First Write Wins: giữ lượt quét sớm nhất');
select is((select result from public.scan_logs where client_scan_id = 'off-2'), 'DUPLICATE_ENTRY',
          'Log lượt quét sau ghi DUPLICATE_ENTRY');
select is((select count(*)::int from public.outbox where topic = 'GATE_ALERT' and aggregate_id = pg_temp.fx('a_ses')), 1,
          'Vé vào hai lần: gửi cảnh báo cổng');

-- ---------------------------------------------------------------- kết thúc Session: NO_SHOW
update public.sessions
   set doors_open_at = now() - interval '4 hours', starts_at = now() - interval '3 hours',
       ends_at = now() - interval '1 minute', sales_end_at = now() - interval '2 minutes'
 where id = pg_temp.fx('a_ses');
do $$ begin perform public.run_session_status_transitions(); end $$;
select is((select status from public.sessions where id = pg_temp.fx('a_ses')), 'ENDED', 'Hết giờ: Session sang ENDED');
select is((select status from public.tickets where id = pg_temp.ticket('a', 'a4')), 'NO_SHOW', 'Vé ISSUED chưa dùng thành NO_SHOW');
select is((select status from public.tickets where id = pg_temp.ticket('a', 'a1')), 'USED', 'Vé đã dùng giữ USED');
select is((select status from public.tickets where id = pg_temp.ticket('a', 'a2')), 'VOID', 'Vé VOID giữ VOID');
select is((select cutoff_at from public.settlements where session_id = pg_temp.fx('a_ses')), now() - interval '1 minute' + interval '72 hours',
          'Mở đối soát với hạn khiếu nại REPORT_WINDOW 72 giờ');
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('staff_a')); end $$;
select is(pg_temp.scan(pg_temp.ticket('a', 'a4'), 'on-5'), 'OUTSIDE_TIME', 'Quét online sau khi Session kết thúc: OUTSIDE_TIME');
select is((pg_temp.sync_one(pg_temp.ticket('a', 'a4'), 'off-3', 30) ->> 'processed')::int, 1,
          'Log offline quét trước giờ kết thúc vẫn được đồng bộ');
reset role;
select is((select status from public.tickets where id = pg_temp.ticket('a', 'a4')), 'USED',
          'NO_SHOW -> USED khi log offline cho thấy khách đã vào');

-- ---------------------------------------------------------------- thu hồi thiết bị và phân công
do $$ begin
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  perform public.revoke_gate_device(pg_temp.fx('dev_a'), 'mất máy');
  perform pg_temp.act_as(pg_temp.fx('staff_a'));
end $$;
set local role authenticated;
select throws_ok(format('select public.check_in(%L, %L, null, %L, %L)',
                        pg_temp.ticket('a', 'a3'), pg_temp.fx('a_ses'), pg_temp.fx('dev_a'), 'x-4'),
                 'P0001', 'DEVICE_REVOKED', 'Thiết bị bị thu hồi: không soát vé được');
reset role;
do $$ begin
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  perform public.revoke_staff_assignment(pg_temp.fx('asg_a'));
  perform pg_temp.act_as(pg_temp.fx('staff_a'));
end $$;
set local role authenticated;
select throws_ok(format('select public.check_in(%L, %L, null, %L, %L)',
                        pg_temp.ticket('a', 'a3'), pg_temp.fx('a_ses'), pg_temp.fx('dev_a'), 'x-5'),
                 'P0001', 'FORBIDDEN', 'Phân công bị thu hồi: không soát vé được');
reset role;

select * from finish();
rollback;
