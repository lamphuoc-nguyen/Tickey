-- ============================================================================
-- pgTAP: bốn bài test bắt buộc (tài liệu mục 26) + máy trạng thái, sổ cái.
--   AC-01 tranh một ghế      AC-06 IPN trùng
--   AC-03/04 trả muộn        AC-15 cô lập tenant
-- AC-01 ở đây chạy tuần tự trong một transaction (kiểm tra điều kiện khóa ghế);
-- bản song song thật: supabase/scripts/concurrency_ac01.sh.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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
select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid, 'u' || n || '@test.vn',
       jsonb_build_object('full_name', 'User ' || n)
from generate_series(1, 60) n;
insert into fx values
  ('owner_a', '00000000-0000-0000-0000-000000000001'), ('owner_b', '00000000-0000-0000-0000-000000000002'),
  ('admin',   '00000000-0000-0000-0000-000000000003'), ('c1', '00000000-0000-0000-0000-000000000004'),
  ('c2',      '00000000-0000-0000-0000-000000000005'), ('c3', '00000000-0000-0000-0000-000000000006');
insert into public.memberships (user_id, scope, roles)
values (pg_temp.fx('admin'), 'PLATFORM', array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']);

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

create function pg_temp.setup_catalog(p_owner uuid, p_org uuid, p_prefix text, p_publish boolean)
returns void language plpgsql as $$
declare v_venue uuid; v_lv uuid; v_ev uuid; v_ses uuid; v_zone uuid;
begin
  perform pg_temp.act_as(p_owner);
  v_venue := public.save_venue(jsonb_build_object('tenant_id', p_org, 'name', 'Venue ' || p_prefix,
             'address_line', '1 Le Loi', 'city', 'TP.HCM', 'capacity', 1000));
  v_lv := (public.create_layout(v_venue, 'Main') ->> 'layout_version_id')::uuid;
  perform public.save_layout_draft(v_lv, '{"zones":[{"id":"A","name":"Khu A","type":"seated","seats":[
     {"id":"A-1","row":"1","number":"1","x":0,"y":0},{"id":"A-2","row":"1","number":"2","x":1,"y":0}]},
     {"id":"GA","name":"Khu dung","type":"standing","capacity":50}]}');
  perform public.publish_layout_version(v_lv);
  v_ev := public.save_event(jsonb_build_object('tenant_id', p_org, 'title', 'Event ' || p_prefix,
                                               'slug', 'event-' || p_prefix));
  v_ses := public.save_session(jsonb_build_object('event_id', v_ev, 'venue_id', v_venue, 'layout_version_id', v_lv,
             'starts_at', now() + interval '2 days', 'ends_at', now() + interval '2 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '2 days'));
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  insert into fx values (p_prefix || '_venue', v_venue), (p_prefix || '_event', v_ev), (p_prefix || '_ses', v_ses),
    (p_prefix || '_tt', public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP', 'kind', 'PAID',
       'price_amount', 300000, 'quota', 2, 'zone_ids', jsonb_build_array(v_zone)))),
    (p_prefix || '_seat1', (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-1')),
    (p_prefix || '_seat2', (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-2'));
  if p_publish then
    perform public.submit_event_for_review(v_ev);
    perform pg_temp.act_as(pg_temp.fx('admin'));
    perform public.review_event(v_ev, 'APPROVED');
  end if;
end $$;

-- Đặt vé như một khách; lưu booking id vào fx
create function pg_temp.book(p_key text, p_user text, p_seat text) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.fx(p_user), 'aal1');
  insert into fx values (p_key, (public.create_booking(pg_temp.fx('a_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('a_tt'), 'seat_id', pg_temp.fx(p_seat))),
    p_key || '-idem-key') ->> 'id')::uuid);
  insert into pay values (p_key, public.begin_payment(pg_temp.fx(p_key), 'VNPAY') -> 'payment' ->> 'order_ref');
end $$;
grant execute on function pg_temp.book(text, text, text) to authenticated;

do $$
begin
  insert into fx values ('org_a', pg_temp.setup_org(pg_temp.fx('owner_a'), 'tap-org-a')),
                        ('org_b', pg_temp.setup_org(pg_temp.fx('owner_b'), 'tap-org-b'));
  perform pg_temp.setup_catalog(pg_temp.fx('owner_a'), pg_temp.fx('org_a'), 'a', true);
  perform pg_temp.setup_catalog(pg_temp.fx('owner_b'), pg_temp.fx('org_b'), 'b', false);  -- Org B: sự kiện nháp
  perform public.run_session_status_transitions();
end $$;
select is((select status from public.sessions where id = pg_temp.fx('a_ses')), 'ON_SALE',
          'Session đã duyệt tự mở bán đúng giờ');

-- ---------------------------------------------------------------- AC-01
-- 50 khách cùng giành ghế A-1: đúng 1 thành công, 49 SEAT_CONFLICT
create function pg_temp.contend(p_n int) returns jsonb language plpgsql as $$
declare v_ok int := 0; v_conflict int := 0; v_other text := '';
begin
  for i in 1..p_n loop
    perform pg_temp.act_as(('00000000-0000-0000-0000-' || lpad(to_hex(10 + i), 12, '0'))::uuid, 'aal1');
    begin
      perform public.create_booking(pg_temp.fx('a_ses'),
        jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('a_tt'), 'seat_id', pg_temp.fx('a_seat1'))),
        'contend-' || i);
      v_ok := v_ok + 1;
    exception when others then
      if sqlerrm = 'SEAT_CONFLICT' then v_conflict := v_conflict + 1; else v_other := v_other || sqlerrm || ';'; end if;
    end;
  end loop;
  return jsonb_build_object('ok', v_ok, 'conflict', v_conflict, 'other', v_other);
end $$;
grant execute on function pg_temp.contend(int) to authenticated;
set local role authenticated;
select is(pg_temp.contend(50), '{"ok": 1, "conflict": 49, "other": ""}'::jsonb,
          'AC-01: 50 lệnh create_booking cho cùng một ghế, đúng 1 thành công, 49 SEAT_CONFLICT');
reset role;
select is((select locked from public.ticket_type_inventory where ticket_type_id = pg_temp.fx('a_tt')), 1,
          'AC-01: tồn kho hạng vé chỉ giữ 1');
select is((select count(*)::int from public.session_seats
           where session_id = pg_temp.fx('a_ses') and seat_id = pg_temp.fx('a_seat1') and status = 'LOCKED'), 1,
          'AC-01: ghế bị khóa bởi đúng một Booking');
do $$ begin  -- trả ghế để dùng cho các test sau
  perform public.release_booking(id, 'CANCELLED') from public.bookings where session_id = pg_temp.fx('a_ses');
end $$;

-- ---------------------------------------------------------------- AC-06
set local role authenticated;
do $$ begin perform pg_temp.book('b1', 'c1', 'a_seat1'); end $$;
do $$ begin perform pg_temp.act_as(pg_temp.fx('c2'), 'aal1'); end $$;
select throws_ok(format('select public.create_booking(%L, %L, %L)', pg_temp.fx('a_ses'),
                        jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('a_tt'), 'seat_id', pg_temp.fx('a_seat1'))),
                        'c2-booking-0001'),
                 'P0001', 'SEAT_CONFLICT', 'Ghế đang bị khóa (PAYMENT_PENDING) thì không đặt lại được');
select throws_ok(format('select public.apply_payment_success(%L, %L, %s)', pg_temp.ref('b1'), 'TXN-A1', 300000),
                 '42501', null, 'authenticated không gọi được hàm xử lý IPN');
reset role;
set local role service_role;
select is(public.apply_payment_success(pg_temp.ref('b1'), 'TXN-A1', 300000, '{}') ->> 'result', 'PAID',
          'AC-06: IPN đầu tiên chuyển Booking sang PAID');
select is(public.apply_payment_success(pg_temp.ref('b1'), 'TXN-A1', 300000, '{}') ->> 'result', 'DUPLICATE',
          'AC-06: IPN trùng được nhận diện, trả thành công cho cổng');
reset role;
select is((select count(*)::int from public.outbox where topic = 'ISSUE_TICKETS' and aggregate_id = pg_temp.fx('b1')), 1,
          'AC-06: chỉ phát vé một lần');
select is((select count(*)::int from public.ledger_transactions t join public.payments p on p.id = t.reference_id
           where p.booking_id = pg_temp.fx('b1')), 1,
          'AC-06: chỉ ghi một bút toán');
select is((select status from public.bookings where id = pg_temp.fx('b1')), 'PAID', 'AC-06: Booking PAID');

-- ---------------------------------------------------------------- AC-03 / AC-05
-- c2 giữ ghế A-2, mở phiên thanh toán; cổng xác nhận chưa thu -> EXPIRED; IPN đến muộn khi ghế còn
set local role authenticated;
do $$ begin perform pg_temp.book('b2', 'c2', 'a_seat2'); end $$;
reset role;
select is(public.release_expired_bookings(null), 0, 'AC-05: PAYMENT_PENDING không tự hết hạn khi chạy job dọn lock');
set local role service_role;
select ok(public.expire_unpaid_booking(pg_temp.fx('b2')), 'Cổng xác nhận chưa thu: Booking sang EXPIRED, trả ghế');
select is(public.apply_payment_success(pg_temp.ref('b2'), 'TXN-B2', 300000, '{}') ->> 'result', 'PAID',
          'AC-03: IPN muộn, ghế cũ còn trống: khóa lại đúng ghế cũ và chuyển PAID');
reset role;
select is((select booking_id from public.session_seats where session_id = pg_temp.fx('a_ses') and seat_id = pg_temp.fx('a_seat2')
           and status = 'SOLD'), pg_temp.fx('b2'), 'AC-03: ghế A-2 thuộc Booking trả muộn');

-- ---------------------------------------------------------------- AC-04
-- c3 giữ ghế, phiên cổng hết hạn -> EXPIRED; ghế bị bán cho người khác; IPN của c3 mới đến -> hoàn 100%
-- dùng Session thứ hai của cùng Event (cùng Layout) để có ghế trống
do $$
declare v_lv uuid; v_ses uuid; v_zone uuid; v_tt uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
             'layout_version_id', v_lv, 'starts_at', now() + interval '3 days', 'ends_at', now() + interval '3 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '3 days'));
  v_tt := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP2', 'kind', 'PAID',
             'price_amount', 300000, 'quota', 5, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.run_session_status_transitions();
  update fx set v = v_ses where k = 'a_ses';
  update fx set v = v_tt where k = 'a_tt';
end $$;
set local role authenticated;
do $$ begin perform pg_temp.book('b3', 'c3', 'a_seat1'); end $$;
reset role;
set local role service_role;
do $$ begin perform public.expire_unpaid_booking(pg_temp.fx('b3')); end $$;
reset role;
set local role authenticated;
do $$ begin perform pg_temp.book('b4', 'c1', 'a_seat1'); end $$;  -- người khác lấy ghế và thanh toán
reset role;
set local role service_role;
do $$ begin perform public.apply_payment_success(pg_temp.ref('b4'), 'TXN-B4', 300000, '{}'); end $$;
select is(public.apply_payment_success(pg_temp.ref('b3'), 'TXN-B3', 300000, '{}') ->> 'result', 'REFUND_PENDING',
          'AC-04: IPN muộn, ghế đã bán: không phát vé, chuyển REFUND_PENDING');
reset role;
select is((select amount from public.refunds where booking_id = pg_temp.fx('b3') and reason = 'LATE_PAYMENT_NO_SEAT'),
          300000::bigint, 'AC-04: tạo Refund 100%');
select is((select booking_id from public.session_seats where session_id = pg_temp.fx('a_ses') and seat_id = pg_temp.fx('a_seat1')),
          pg_temp.fx('b4'), 'AC-04: ghế vẫn thuộc người đã mua');
select is((select count(*)::int from public.outbox where topic = 'ISSUE_TICKETS' and aggregate_id = pg_temp.fx('b3')), 0,
          'AC-04: không phát vé cho Booking trả muộn');

-- ---------------------------------------------------------------- AC-15
create function pg_temp.visible_rows_of(p_org uuid) returns jsonb language plpgsql as $$
declare r record; v_n bigint; v_res jsonb := '{}';
begin
  for r in select c.table_name, max(c.column_name) as col   -- tenant_id ưu tiên hơn org_id
           from information_schema.columns c
           join pg_tables t on t.schemaname = 'public' and t.tablename = c.table_name
           where c.table_schema = 'public' and c.column_name in ('tenant_id', 'org_id')
           group by c.table_name order by 1 loop
    execute format('select count(*) from public.%I where %I = $1', r.table_name, r.col) into v_n using p_org;
    if v_n > 0 then v_res := v_res || jsonb_build_object(r.table_name, v_n); end if;
  end loop;
  return v_res;
end $$;
grant execute on function pg_temp.visible_rows_of(uuid) to authenticated;
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
select is(pg_temp.visible_rows_of(pg_temp.fx('org_b')), '{}'::jsonb,
          'AC-15: Owner Org A không đọc được dòng nào của Org B (mọi bảng có tenant_id / org_id)');
select throws_ok(format('select public.save_venue(%L)', jsonb_build_object('id', pg_temp.fx('b_venue'), 'name', 'hack')),
                 'P0001', 'FORBIDDEN', 'AC-15: Org A không sửa được Venue của Org B');
select throws_ok(format('select public.submit_event_for_review(%L)', pg_temp.fx('b_event')),
                 'P0001', 'FORBIDDEN', 'AC-15: Org A không gửi duyệt sự kiện của Org B');
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_b')); end $$;
select ok(pg_temp.visible_rows_of(pg_temp.fx('org_b')) ?& array['events', 'venues', 'seats'],
          'Đối chứng: Owner Org B đọc được dữ liệu của mình');
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
set local role anon;
select is((select count(*)::int from public.seats where tenant_id = pg_temp.fx('org_b')), 0,
          'Khách không thấy sơ đồ ghế của sự kiện chưa công bố');
reset role;

-- ---------------------------------------------------------------- máy trạng thái, sổ cái
select throws_ok(format('update public.bookings set status = %L where id = %L', 'PENDING', pg_temp.fx('b1')),
                 'P0001', 'INVALID_STATE', 'Booking PAID không quay về PENDING');
select throws_ok(format('update public.sessions set status = %L where id = %L', 'SCHEDULED', pg_temp.fx('a_ses')),
                 'P0001', 'INVALID_STATE', 'Session ON_SALE không quay về SCHEDULED');
select is((select sum(case direction when 'DEBIT' then amount else -amount end) from public.ledger_entries), 0::numeric,
          'Sổ cái cân: tổng Nợ = tổng Có');

select * from finish();
rollback;
