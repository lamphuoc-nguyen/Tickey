-- ============================================================================
-- pgTAP: bốn bài test bắt buộc (tài liệu mục 26) + máy trạng thái, sổ cái.
--   AC-01 tranh một ghế      AC-06 IPN trùng
--   AC-03/04 trả muộn        AC-15 cô lập tenant
-- AC-01 ở đây chạy tuần tự trong một transaction (kiểm tra điều kiện khóa ghế);
-- bản song song thật: supabase/scripts/concurrency_ac01.sh.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

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

-- Signing key for QR code signing
insert into public.signing_keys (kid, public_key) values ('k1', 'PUBKEY');

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

-- ---------------------------------------------------------------- Full happy path: Booking → Payment → Ticket (CONFIRMED)
-- Test end-to-end flow: create_booking → begin_payment → apply_payment_success → issue_tickets → attach_ticket_credentials → CONFIRMED
set local role service_role;
do $$
declare
  v_booking uuid;
  v_ref text;
  v_happy_ses uuid;
  v_happy_tt uuid;
  v_happy_seat uuid;
  v_lv uuid;
begin
  -- Get layout_version_id from existing session
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  
  -- Create a fresh session for the happy path test to avoid seat conflicts
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_happy_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
              'layout_version_id', v_lv, 'starts_at', now() + interval '4 days', 'ends_at', now() + interval '4 days 2 hours',
              'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '4 days'));
  select id into v_happy_seat from public.seats where layout_version_id = v_lv and seat_code = 'A-1';
  v_happy_tt := public.save_ticket_type(jsonb_build_object('session_id', v_happy_ses, 'name', 'VIP-Happy', 'kind', 'PAID',
              'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  -- Create a new booking for the happy path test
  v_booking := (public.create_booking(v_happy_ses,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_happy_tt, 'seat_id', v_happy_seat)),
    'happy-path-001') ->> 'id')::uuid;
  insert into fx values ('happy_booking', v_booking);
  
  -- Begin payment
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into pay values ('happy_ref', v_ref);
end $$;
reset role;

-- Verify booking is PAYMENT_PENDING after begin_payment
select is((select status from public.bookings where id = pg_temp.fx('happy_booking')), 'PAYMENT_PENDING',
          'Happy path: Booking chuyển sang PAYMENT_PENDING sau begin_payment');

-- IPN success (service_role)
set local role service_role;
select is(public.apply_payment_success(pg_temp.ref('happy_ref'), 'TXN-HAPPY', 300000, '{}') ->> 'result', 'PAID',
          'Happy path: IPN thành công chuyển Booking sang PAID');

-- Issue tickets
select is((select count(*)::int from public.issue_tickets(pg_temp.fx('happy_booking'), 'k1')), 1,
          'Happy path: issue_tickets tạo 1 vé');

-- Attach credentials
select is(public.attach_ticket_credentials(pg_temp.fx('happy_booking'),
      (select jsonb_agg(jsonb_build_object('ticket_id', t.id, 'kid', 'k1', 'payload', 'p', 'signature', 's'))
       from public.tickets t where booking_id = pg_temp.fx('happy_booking'))), 'CONFIRMED',
          'Happy path: attach_ticket_credentials chuyển Booking sang CONFIRMED');

-- Verify final state
reset role;
select is((select status from public.bookings where id = pg_temp.fx('happy_booking')), 'CONFIRMED',
          'Happy path: Booking cuối cùng là CONFIRMED');
select is((select count(*)::int from public.tickets where booking_id = pg_temp.fx('happy_booking') and status = 'ISSUED'), 1,
          'Happy path: Có 1 vé ISSUED');
select is((select count(*)::int from public.ticket_credentials where ticket_id in (select id from public.tickets where booking_id = pg_temp.fx('happy_booking'))), 1,
          'Happy path: Có 1 credential được ký');
select is((select count(*)::int from public.outbox where topic = 'ISSUE_TICKETS' and aggregate_id = pg_temp.fx('happy_booking')), 1,
          'Happy path: Outbox ISSUE_TICKETS được tạo');

-- Ledger check
select is((select count(*)::int from public.ledger_transactions t join public.payments p on p.id = t.reference_id
           where p.booking_id = pg_temp.fx('happy_booking')), 1,
          'Happy path: Có 1 bút toán ledger cho thanh toán');

reset role;

-- ---------------------------------------------------------------- C-04: apply_payment_success fixes
-- Setup part 1: Create sessions, ticket types (superuser for run_session_status_transitions)
do $$
declare
  v_ses uuid; v_tt uuid; v_lv uuid;
  v_ses2 uuid; v_tt2 uuid;
  v_ses3 uuid; v_tt3 uuid;
  v_ses4 uuid; v_tt4 uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  perform pg_temp.act_as(pg_temp.fx('owner_a'));

  -- Test 1: AMOUNT_MISMATCH followed by corrected IPN
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '5 days', 'ends_at', now() + interval '5 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '5 days'));
  v_tt := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C04', 'kind', 'PAID',
            'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  insert into fx values ('c04_mismatch_ses', v_ses), ('c04_mismatch_tt', v_tt);

  -- Test 2: Second transaction for same order (different gateway_txn_id) creates DUPLICATE_PAYMENT refund
  v_ses2 := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
             'layout_version_id', v_lv, 'starts_at', now() + interval '6 days', 'ends_at', now() + interval '6 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '6 days'));
  v_tt2 := public.save_ticket_type(jsonb_build_object('session_id', v_ses2, 'name', 'VIP-C04-DUP', 'kind', 'PAID',
             'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  insert into fx values ('c04_dup_ses', v_ses2), ('c04_dup_tt', v_tt2);

  -- Test 3: FAILED payment can be retried (apply_payment_failure then begin_payment again)
  v_ses3 := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
             'layout_version_id', v_lv, 'starts_at', now() + interval '7 days', 'ends_at', now() + interval '7 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '7 days'));
  v_tt3 := public.save_ticket_type(jsonb_build_object('session_id', v_ses3, 'name', 'VIP-C04-RETRY', 'kind', 'PAID',
             'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  insert into fx values ('c04_retry_ses', v_ses3), ('c04_retry_tt', v_tt3);

  -- Test 4: INITIATED payment expired -> BOOKING_EXPIRED
  v_ses4 := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
             'layout_version_id', v_lv, 'starts_at', now() + interval '8 days', 'ends_at', now() + interval '8 days 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '8 days'));
  v_tt4 := public.save_ticket_type(jsonb_build_object('session_id', v_ses4, 'name', 'VIP-C04-EXP', 'kind', 'PAID',
             'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  insert into fx values ('c04_exp_ses', v_ses4), ('c04_exp_tt', v_tt4), ('c04_exp_lv', v_lv);
end $$;

-- Setup part 2: Create bookings, payments (authenticated)
set local role authenticated;
do $$
declare
  v_booking uuid; v_ref text;
  v_booking2 uuid; v_ref2 text;
  v_booking3 uuid; v_ref3 text;
  v_booking4 uuid; v_ref4 text;
begin
  -- Test 1
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking := (public.create_booking(pg_temp.fx('c04_mismatch_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c04_mismatch_tt'), 'seat_id', (select id from public.seats where layout_version_id = pg_temp.fx('c04_exp_lv') and seat_code = 'A-1'))),
    'c04-mismatch-001') ->> 'id')::uuid;
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c04_mismatch_booking', v_booking);
  insert into pay values ('c04_mismatch_ref', v_ref);

  -- Test 2
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking2 := (public.create_booking(pg_temp.fx('c04_dup_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c04_dup_tt'), 'seat_id', (select id from public.seats where layout_version_id = pg_temp.fx('c04_exp_lv') and seat_code = 'A-2'))),
    'c04-dup-001') ->> 'id')::uuid;
  v_ref2 := public.begin_payment(v_booking2, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c04_dup_booking', v_booking2);
  insert into pay values ('c04_dup_ref', v_ref2);

  -- Test 3
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking3 := (public.create_booking(pg_temp.fx('c04_retry_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c04_retry_tt'), 'seat_id', (select id from public.seats where layout_version_id = pg_temp.fx('c04_exp_lv') and seat_code = 'A-1'))),
    'c04-retry-001') ->> 'id')::uuid;
  v_ref3 := public.begin_payment(v_booking3, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c04_retry_booking', v_booking3);
  insert into pay values ('c04_retry_ref', v_ref3);

  -- Test 4
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking4 := (public.create_booking(pg_temp.fx('c04_exp_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c04_exp_tt'), 'seat_id', (select id from public.seats where layout_version_id = pg_temp.fx('c04_exp_lv') and seat_code = 'A-2'))),
    'c04-exp-001') ->> 'id')::uuid;
  v_ref4 := public.begin_payment(v_booking4, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c04_exp_booking', v_booking4);
  insert into pay values ('c04_exp_ref', v_ref4);
end $$;
reset role;

-- C-04 Test 1: AMOUNT_MISMATCH followed by corrected IPN returns NEEDS_REVIEW
set local role service_role;
select is(public.apply_payment_success(pg_temp.ref('c04_mismatch_ref'), 'TXN-WRONG', 999999, '{}') ->> 'result', 'AMOUNT_MISMATCH',
          'C-04: First IPN with wrong amount -> AMOUNT_MISMATCH');
select is(public.apply_payment_success(pg_temp.ref('c04_mismatch_ref'), 'TXN-CORRECT', 300000, '{}') ->> 'result', 'NEEDS_REVIEW',
          'C-04: Corrected IPN after AMOUNT_MISMATCH -> NEEDS_REVIEW');
reset role;

-- C-04 Test 2: Second transaction for same order (different gateway_txn_id) creates DUPLICATE_PAYMENT refund
set local role service_role;
select is(public.apply_payment_success(pg_temp.ref('c04_dup_ref'), 'TXN-FIRST', 300000, '{}') ->> 'result', 'PAID',
          'C-04: First IPN succeeds -> PAID');
select is(public.apply_payment_success(pg_temp.ref('c04_dup_ref'), 'TXN-SECOND', 300000, '{}') ->> 'result', 'DUPLICATE_PAYMENT_REFUND',
          'C-04: Second IPN with different txn -> DUPLICATE_PAYMENT_REFUND');
select is((select count(*)::int from public.refunds where booking_id = pg_temp.fx('c04_dup_booking') and reason = 'DUPLICATE_PAYMENT'), 1,
          'C-04: DUPLICATE_PAYMENT refund created');
-- Now creates a new payment for the second txn, so 2 ledger transactions (original + duplicate)
select is((select count(*)::int from public.ledger_transactions lt join public.payments p on p.id = lt.reference_id where p.booking_id = pg_temp.fx('c04_dup_booking')), 2,
          'C-04: Ledger has 2 transactions (original payment + duplicate payment)');

-- C-04 Retry: sending same IPN again should return DUPLICATE, not create new refund
select is(public.apply_payment_success(pg_temp.ref('c04_dup_ref'), 'TXN-SECOND', 300000, '{}') ->> 'result', 'DUPLICATE',
          'C-04: Retry IPN of second txn returns DUPLICATE, no new refund');
select is((select count(*)::int from public.refunds where booking_id = pg_temp.fx('c04_dup_booking') and reason = 'DUPLICATE_PAYMENT'), 1,
          'C-04: Retry does not increase DUPLICATE_PAYMENT refund count');
select is((select p.gateway_txn_id from public.refunds r join public.payments p on p.id = r.payment_id where r.booking_id = pg_temp.fx('c04_dup_booking') and r.reason = 'DUPLICATE_PAYMENT'), 'TXN-SECOND',
          'C-04: DUPLICATE_PAYMENT refund points to payment with gateway_txn_id = TXN-SECOND');
select is((select sum(amount)::bigint from public.refunds where booking_id = pg_temp.fx('c04_dup_booking') and reason = 'DUPLICATE_PAYMENT'), 300000::bigint,
          'C-04: Total refunded amount = 300000 (one txn only)');
reset role;

-- C-01: FAILED payment can be retried (apply_payment_failure then begin_payment again)
set local role service_role;
select is(public.apply_payment_failure(pg_temp.ref('c04_retry_ref'), 'card_declined', '{}') ->> 'result', 'FAILED',
          'C-01: Payment failure -> FAILED');
select ok((public.begin_payment(pg_temp.fx('c04_retry_booking'), 'VNPAY') -> 'payment' ->> 'order_ref') <> pg_temp.ref('c04_retry_ref'),
          'C-01: begin_payment after FAILED creates new payment');
select is((select status from public.bookings where id = pg_temp.fx('c04_retry_booking')), 'PAYMENT_PENDING',
          'C-01: Booking stays PAYMENT_PENDING after retry');
reset role;

-- C-01: INITIATED payment expired -> BOOKING_EXPIRED
set local role service_role;
do $$
declare v_booking uuid; v_ref text; v_ses uuid; v_tt uuid; v_lv uuid;
begin
  v_booking := pg_temp.fx('c04_exp_booking');
  v_ref := pg_temp.ref('c04_exp_ref');
  v_ses := pg_temp.fx('c04_exp_ses');
  v_tt := pg_temp.fx('c04_exp_tt');
  v_lv := pg_temp.fx('c04_exp_lv');
  -- Expire the booking manually (simulating lock_expires_at past)
  update public.payments set initiated_at = now() - interval '30 minutes' where order_ref = v_ref;
  update public.bookings set lock_expires_at = now() - interval '1 minute' where id = v_booking;
  update public.session_seats set lock_expires_at = now() - interval '1 minute' where session_id = v_ses and status = 'LOCKED';
end $$;
select throws_ok(format('select public.begin_payment(%L, %L)', pg_temp.fx('c04_exp_booking'), 'VNPAY'),
                 'P0001', 'BOOKING_EXPIRED',
                 'C-01: begin_payment with expired lock raises BOOKING_EXPIRED');
-- Expire the booking to release inventory
select ok(public.expire_unpaid_booking(pg_temp.fx('c04_exp_booking')),
          'C-01: expire_unpaid_booking releases inventory');
select is((select locked from public.ticket_type_inventory where ticket_type_id = pg_temp.fx('c04_exp_tt')), 0,
          'C-01: ticket_type_inventory.locked = 0 after expire');
select is((select status from public.session_seats where session_id = pg_temp.fx('c04_exp_ses') and seat_id = (select id from public.seats where layout_version_id = pg_temp.fx('c04_exp_lv') and seat_code = 'A-2')), 'AVAILABLE',
          'C-01: Seat released to AVAILABLE after expire');
reset role;

-- ---------------------------------------------------------------- C-05: save_ticket_type PAID priority over FREE
-- C-05 Test 1: COMP before PAID -> seat belongs to PAID
-- Setup part 1: Create session, ticket types (superuser for run_session_status_transitions)
do $$
declare v_ses uuid; v_zone uuid; v_comp uuid; v_paid uuid; v_lv uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '9 days', 'ends_at', now() + interval '9 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '9 days'));
  -- Create COMP first
  v_comp := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Khach moi', 'kind', 'COMP',
                  'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  -- Create PAID after
  v_paid := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C05', 'kind', 'PAID',
                  'price_amount', 500000, 'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.run_session_status_transitions();
  insert into fx values ('c05_comp_ses', v_ses), ('c05_comp_tt', v_comp), ('c05_paid_tt', v_paid);
end $$;

-- C-05 Test 1: COMP before PAID -> seat belongs to PAID
select is((select count(*)::int from public.session_seats where session_id = pg_temp.fx('c05_comp_ses') and ticket_type_id = pg_temp.fx('c05_paid_tt') and status in ('AVAILABLE','BLOCKED','HELD')), 2,
          'C-05: COMP before PAID -> seats assigned to PAID');
select is((select count(*)::int from public.session_seats where session_id = pg_temp.fx('c05_comp_ses') and ticket_type_id = pg_temp.fx('c05_comp_tt')), 0,
          'C-05: COMP does not auto-assign seats');

-- C-05 Test 2: FREE PUBLIC before PAID -> seat belongs to PAID
-- Setup part 1: Create session, ticket types (superuser for run_session_status_transitions)
do $$
declare v_lv uuid; v_ses uuid; v_zone uuid; v_free uuid; v_paid uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '9 days', 'ends_at', now() + interval '9 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '9 days'));
  -- Create FREE PUBLIC first
  v_free := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Mien phi', 'kind', 'FREE',
                  'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  -- Create PAID after
  v_paid := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C05-FREE', 'kind', 'PAID',
                  'price_amount', 500000, 'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.run_session_status_transitions();
  insert into fx values ('c05_free_ses', v_ses), ('c05_free_tt', v_free), ('c05_free_paid_tt', v_paid);
end $$;

select is((select count(*)::int from public.session_seats where session_id = pg_temp.fx('c05_free_ses') and ticket_type_id = pg_temp.fx('c05_free_paid_tt') and status in ('AVAILABLE','BLOCKED','HELD')), 2,
          'C-05: FREE before PAID -> seats assigned to PAID');
select is((select count(*)::int from public.session_seats where session_id = pg_temp.fx('c05_free_ses') and ticket_type_id = pg_temp.fx('c05_free_tt')), 0,
          'C-05: FREE PUBLIC does not take seats when PAID exists in zone');

-- C-05 Test 3: create_booking with PAID seat -> total_amount = PAID price
-- Setup part 1: Create session, ticket types (superuser for run_session_status_transitions)
do $$
declare v_lv uuid; v_ses uuid; v_zone uuid; v_free uuid; v_paid uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '10 days'));
  v_free := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Mien phi 2', 'kind', 'FREE',
                  'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  v_paid := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C05-BOOK', 'kind', 'PAID',
                  'price_amount', 750000, 'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.run_session_status_transitions();
  insert into fx values ('c05_book_ses', v_ses), ('c05_book_free_tt', v_free), ('c05_book_paid_tt', v_paid), ('c05_book_lv', v_lv);
end $$;

-- Setup part 2: Create booking (authenticated)
set local role authenticated;
do $$
declare v_booking uuid;
begin
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking := (public.create_booking(pg_temp.fx('c05_book_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c05_book_paid_tt'), 'seat_id', (select id from public.seats where layout_version_id = pg_temp.fx('c05_book_lv') and seat_code = 'A-1'))),
    'c05-book-001') ->> 'id')::uuid;
  insert into fx values ('c05_book_booking', v_booking);
end $$;
reset role;

select is((select total_amount from public.bookings where id = pg_temp.fx('c05_book_booking')), 750000::bigint,
          'C-05: Booking total_amount = PAID price (not 0)');

-- C-05 Test 4: Manually assign seat to FREE, then UPDATE PAID -> seat stays FREE
-- Setup: Create PAID first (gets seats), manually assign one seat to FREE, then UPDATE PAID
do $$
declare v_lv uuid; v_ses uuid; v_zone uuid; v_free uuid; v_paid uuid; v_seat uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  select id into v_zone from public.zones where layout_version_id = v_lv and code = 'A';
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '12 days'));
  -- Create PAID first (gets all seats in zone)
  v_paid := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C05-UPDATE', 'kind', 'PAID',
                  'price_amount', 500000, 'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  -- Create FREE after (should not auto-assign since PAID exists)
  v_free := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Mien phi 4', 'kind', 'FREE',
                  'quota', 2, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.run_session_status_transitions();
  -- Manually assign seat A-1 to FREE
  v_seat := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-1');
  perform public.assign_seats_ticket_type(v_ses, array[v_seat]::uuid[], v_free);
  -- Now UPDATE PAID (change price) - should NOT reassign the manually assigned FREE seat
  perform public.save_ticket_type(jsonb_build_object('id', v_paid, 'price_amount', 600000));
  insert into fx values ('c05_update_ses', v_ses), ('c05_update_free_tt', v_free), ('c05_update_paid_tt', v_paid), ('c05_update_seat', v_seat);
end $$;

-- Verify manually assigned seat stays FREE after PAID UPDATE
select is((select ticket_type_id from public.session_seats where session_id = pg_temp.fx('c05_update_ses') and seat_id = pg_temp.fx('c05_update_seat')), pg_temp.fx('c05_update_free_tt'),
          'C-05: Manually assigned seat stays FREE after PAID updated');
select is((select count(*)::int from public.session_seats where session_id = pg_temp.fx('c05_update_ses') and ticket_type_id = pg_temp.fx('c05_update_paid_tt') and status in ('AVAILABLE','BLOCKED','HELD')), 1,
          'C-05: PAID keeps other seats, only manually assigned seat stays FREE');

-- ---------------------------------------------------------------- C-07: create_refund rounding
-- C-07 Test 1 setup: 2 tickets 100000 each, refund 100001 -> tests largest remainder (50000, 50001)
-- Split: session/ticket types as superuser, booking/payment as authenticated
do $$
declare v_ses uuid; v_tt uuid; v_seat1 uuid; v_seat2 uuid; v_lv uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '11 days', 'ends_at', now() + interval '11 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '11 days'));
  v_tt := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C07', 'kind', 'PAID',
                  'price_amount', 100000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  v_seat1 := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-1');
  v_seat2 := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-2');
  insert into fx values ('c07_round_ses', v_ses), ('c07_round_tt', v_tt), ('c07_round_lv', v_lv),
                        ('c07_round_seat1', v_seat1), ('c07_round_seat2', v_seat2);
end $$;

set local role authenticated;
do $$
declare v_booking uuid; v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking := (public.create_booking(pg_temp.fx('c07_round_ses'),
    jsonb_build_array(
      jsonb_build_object('ticket_type_id', pg_temp.fx('c07_round_tt'), 'seat_id', pg_temp.fx('c07_round_seat1')),
      jsonb_build_object('ticket_type_id', pg_temp.fx('c07_round_tt'), 'seat_id', pg_temp.fx('c07_round_seat2'))
    ),
    'c07-round-001') ->> 'id')::uuid;
  insert into fx values ('c07_round_booking', v_booking);
  
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into pay values ('c07_round_ref', v_ref);
end $$;
reset role;

set local role service_role;
do $$
declare v_ref text; v_booking uuid; v_refund uuid;
begin
  v_ref := pg_temp.ref('c07_round_ref');
  v_booking := pg_temp.fx('c07_round_booking');
  perform public.apply_payment_success(v_ref, 'TXN-C07', 200000, '{}');
  perform public.issue_tickets(v_booking, 'k1');
  
  -- Refund 100001 (tests largest remainder: 50000, 50001)
  v_refund := public.create_refund(v_booking, 100001, 'CUSTOMER_REQUEST', 'MANUAL', gen_random_uuid(), pg_temp.fx('c1'),
    (select jsonb_agg(id) from public.tickets where booking_id = v_booking));
  insert into fx values ('c07_round_refund', v_refund);
end $$;
reset role;

-- C-07 Test 1: 2 tickets 100000 each, refund 100001 -> largest remainder 50000, 50001
select is((select sum(amount)::bigint from public.refund_items where refund_id = pg_temp.fx('c07_round_refund')), 100001::bigint,
          'C-07: sum(refund_items.amount) = refunds.amount (100001)');
select ok((select count(*) from public.refund_items where refund_id = pg_temp.fx('c07_round_refund') and amount in (50000, 50001)) = 2,
          'C-07: refund items are 50000, 50001');

-- C-07 Test 2: v_base = 0 (refund only FREE tickets) -> VALIDATION_FAILED
-- Create booking with both PAID (price > 0, seated) and FREE (standing, no seat) tickets, refund only FREE ticket
-- Split: session/ticket types as superuser, booking as authenticated, payment as service_role
do $$
declare v_ses uuid; v_tt_paid uuid; v_tt_free uuid; v_seat1 uuid; v_zone_ga uuid; v_lv uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '12 days'));
  -- PAID ticket with price > 0 (zone A, seated)
  v_tt_paid := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Paid-C07', 'kind', 'PAID',
                  'price_amount', 100000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  -- FREE ticket with price = 0 (zone GA, standing)
  v_zone_ga := (select id from public.zones where layout_version_id = v_lv and code = 'GA');
  v_tt_free := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'Free-C07', 'kind', 'FREE',
                  'price_amount', 0, 'quota', 10, 'zone_ids', jsonb_build_array(v_zone_ga)));
  perform public.run_session_status_transitions();
  v_seat1 := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-1');
  insert into fx values ('c07_zero_ses', v_ses), ('c07_zero_tt_paid', v_tt_paid), ('c07_zero_tt_free', v_tt_free), ('c07_zero_lv', v_lv),
                        ('c07_zero_seat1', v_seat1), ('c07_zero_zone_ga', v_zone_ga);
end $$;

set local role authenticated;
do $$
declare v_booking uuid; v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  -- Booking with both PAID (seated) and FREE (standing, no seat_id) tickets
  v_booking := (public.create_booking(pg_temp.fx('c07_zero_ses'),
    jsonb_build_array(
      jsonb_build_object('ticket_type_id', pg_temp.fx('c07_zero_tt_paid'), 'seat_id', pg_temp.fx('c07_zero_seat1')),
      jsonb_build_object('ticket_type_id', pg_temp.fx('c07_zero_tt_free'), 'zone_id', pg_temp.fx('c07_zero_zone_ga'), 'quantity', 1)
    ),
    'c07-zero-001') ->> 'id')::uuid;
  insert into fx values ('c07_zero_booking', v_booking);
  
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into pay values ('c07_zero_ref', v_ref);
end $$;
reset role;

set local role service_role;
do $$
declare v_ref text; v_booking uuid;
begin
  v_booking := pg_temp.fx('c07_zero_booking');
  v_ref := pg_temp.ref('c07_zero_ref');
  -- Payment amount = PAID ticket price (100000)
  perform public.apply_payment_success(v_ref, 'TXN-C07-ZERO', 100000, '{}');
  perform public.issue_tickets(v_booking, 'k1');
end $$;
reset role;

-- C-07 Test 2 assertion: refund only FREE ticket (v_base = 0) -> VALIDATION_FAILED
set local role service_role;
select throws_ok(
  format('select public.create_refund(%L, %L, %L, %L, %L, %L, %L)',
    pg_temp.fx('c07_zero_booking'), 1000, 'CUSTOMER_REQUEST', 'MANUAL', gen_random_uuid(), pg_temp.fx('c1'),
    (select jsonb_agg(t.id) from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
     where t.booking_id = pg_temp.fx('c07_zero_booking') and bi.unit_price = 0)
  ),
  'P0001', 'VALIDATION_FAILED',
  'C-07: Refund FREE tickets (v_base=0) throws VALIDATION_FAILED'
);
reset role;

-- ---------------------------------------------------------------- C-01: INITIATED hết hạn → thanh toán lại
-- Setup part 1: Create session, ticket type (superuser for run_session_status_transitions)
do $$
declare v_lv uuid; v_ses uuid; v_tt uuid; v_zone uuid; v_seat1 uuid; v_seat2 uuid;
begin
  select layout_version_id into v_lv from public.sessions where id = pg_temp.fx('a_ses');
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  v_ses := public.save_session(jsonb_build_object('event_id', pg_temp.fx('a_event'), 'venue_id', pg_temp.fx('a_venue'),
            'layout_version_id', v_lv, 'starts_at', now() + interval '13 days', 'ends_at', now() + interval '13 days 2 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '13 days'));
  v_tt := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'VIP-C01', 'kind', 'PAID',
                  'price_amount', 300000, 'quota', 10, 'zone_ids', jsonb_build_array((select id from public.zones where layout_version_id = v_lv and code = 'A'))));
  perform public.run_session_status_transitions();
  v_seat1 := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-1');
  v_seat2 := (select id from public.seats where layout_version_id = v_lv and seat_code = 'A-2');
  insert into fx values ('c01_ses', v_ses), ('c01_tt', v_tt), ('c01_lv', v_lv),
                        ('c01_seat1', v_seat1), ('c01_seat2', v_seat2);
end $$;

-- Setup part 2: Test INITIATED expired -> repayment
set local role authenticated;
do $$
declare v_booking uuid; v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_booking := (public.create_booking(pg_temp.fx('c01_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c01_tt'), 'seat_id', pg_temp.fx('c01_seat1'))),
    'c01-initiated-expired-001') ->> 'id')::uuid;
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c01_exp_booking', v_booking);
  insert into pay values ('c01_exp_ref', v_ref);
end $$;
reset role;

-- Expire the INITIATED payment (set initiated_at to 16 minutes ago, session_minutes = 15)
set local role service_role;
do $$
declare v_ref text;
begin
  v_ref := pg_temp.ref('c01_exp_ref');
  update public.payments set initiated_at = now() - interval '16 minutes' where order_ref = v_ref;
end $$;
reset role;

-- Call begin_payment again - should create new payment
set local role authenticated;
do $$
declare v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c1'), 'aal1');
  v_ref := public.begin_payment(pg_temp.fx('c01_exp_booking'), 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into pay values ('c01_exp_ref_new', v_ref);
end $$;
reset role;

-- Verify old payment is EXPIRED, new payment is INITIATED
set local role service_role;
select is((select status from public.payments where order_ref = pg_temp.ref('c01_exp_ref')), 'EXPIRED',
          'C-01: Old INITIATED payment becomes EXPIRED after expiry');
select is((select status from public.payments where order_ref = pg_temp.ref('c01_exp_ref_new')), 'INITIATED',
          'C-01: New payment created with INITIATED status');
select is((select count(*)::int from public.payments where booking_id = pg_temp.fx('c01_exp_booking')), 2,
          'C-01: Two payments exist for the booking (old EXPIRED, new INITIATED)');
-- Also verify the booking is still PAYMENT_PENDING
select is((select status from public.bookings where id = pg_temp.fx('c01_exp_booking')), 'PAYMENT_PENDING',
          'C-01: Booking stays PAYMENT_PENDING after repayment');
-- Verify lock_expires_at was extended
select ok((select lock_expires_at from public.bookings where id = pg_temp.fx('c01_exp_booking')) > now(),
          'C-01: lock_expires_at extended after repayment');
reset role;

-- Setup part 3: Test FAILED payment can be retried (verify FAILED payment stays FAILED)
set local role authenticated;
do $$
declare v_booking uuid; v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c2'), 'aal1');
  v_booking := (public.create_booking(pg_temp.fx('c01_ses'),
    jsonb_build_array(jsonb_build_object('ticket_type_id', pg_temp.fx('c01_tt'), 'seat_id', pg_temp.fx('c01_seat2'))),
    'c01-failed-retry-001') ->> 'id')::uuid;
  v_ref := public.begin_payment(v_booking, 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into fx values ('c01_failed_booking', v_booking);
  insert into pay values ('c01_failed_ref', v_ref);
end $$;
reset role;

set local role service_role;
select is(public.apply_payment_failure(pg_temp.ref('c01_failed_ref'), 'card_declined', '{}') ->> 'result', 'FAILED',
          'C-01: Payment failure -> FAILED');
reset role;

set local role authenticated;
do $$
declare v_ref text;
begin
  perform pg_temp.act_as(pg_temp.fx('c2'), 'aal1');
  v_ref := public.begin_payment(pg_temp.fx('c01_failed_booking'), 'VNPAY') -> 'payment' ->> 'order_ref';
  insert into pay values ('c01_failed_ref_new', v_ref);
end $$;
reset role;

set local role service_role;
select is((select status from public.payments where order_ref = pg_temp.ref('c01_failed_ref')), 'FAILED',
          'C-01: Old FAILED payment stays FAILED after retry');
select is((select status from public.payments where order_ref = pg_temp.ref('c01_failed_ref_new')), 'INITIATED',
          'C-01: New payment created with INITIATED status after FAILED');
select is((select count(*)::int from public.payments where booking_id = pg_temp.fx('c01_failed_booking')), 2,
          'C-01: Two payments exist (old FAILED, new INITIATED)');
reset role;

-- ---------------------------------------------------------------- Máy trạng thái, sổ cái
select throws_ok(format('update public.bookings set status = %L where id = %L', 'PENDING', pg_temp.fx('b1')),
                 'P0001', 'INVALID_STATE', 'Booking PAID không quay về PENDING');
select throws_ok(format('update public.sessions set status = %L where id = %L', 'SCHEDULED', pg_temp.fx('a_ses')),
                 'P0001', 'INVALID_STATE', 'Session ON_SALE không quay về SCHEDULED');
select is((select sum(case direction when 'DEBIT' then amount else -amount end) from public.ledger_entries), 0::numeric,
          'Sổ cái cân: tổng Nợ = tổng Có');

select * from finish();
rollback;