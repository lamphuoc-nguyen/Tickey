-- ============================================================================
-- pgTAP: mã vào cổng theo đơn (20261101000000_booking_admission_pass.sql).
-- Dùng dữ liệu seed: Đêm 1 của Org A, staff-a phân công cổng G1 (VIP, Thường), customer-1 mua vé.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create temp table fx (k text primary key, v text);
grant all on fx to anon, authenticated, service_role;
create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;
create function pg_temp.fx(p_k text) returns text language sql stable as $$ select v from fx where k = p_k $$;
grant execute on function pg_temp.act_as(uuid), pg_temp.fx(text) to anon, authenticated, service_role;

insert into fx values
  ('c1', 'a0000000-0000-4000-8000-0000000000c1'), ('c2', 'a0000000-0000-4000-8000-0000000000c2'),
  ('staff', 'a0000000-0000-4000-8000-0000000000f1');
insert into fx select 'ses', id::text from public.sessions where title = 'Đêm 1';
insert into fx select 'g1', g.id::text from public.gates g join public.sessions s on s.venue_id = g.venue_id
               where s.id = pg_temp.fx('ses')::uuid and g.code = 'G1';
insert into public.signing_keys (kid, public_key) values ('tk', 'PUBKEY');

-- Đơn VIP 3 ghế (trả tiền) và đơn 2 vé sinh viên miễn phí ở khu đứng
do $$
declare v_vip uuid; v_free uuid; v_b jsonb; v_pay jsonb;
begin
  select id into v_vip from public.ticket_types where session_id = pg_temp.fx('ses')::uuid and name = 'VIP';
  select id into v_free from public.ticket_types where session_id = pg_temp.fx('ses')::uuid and kind = 'FREE';
  perform pg_temp.act_as(pg_temp.fx('c1')::uuid);
  v_b := public.create_booking(pg_temp.fx('ses')::uuid,
           (select jsonb_agg(jsonb_build_object('ticket_type_id', v_vip, 'seat_id', s.id))
            from (select id from public.seats
                  where zone_id = (select zone_id from public.ticket_type_zones where ticket_type_id = v_vip limit 1)
                  order by seat_code limit 3) s),
           gen_random_uuid()::text);
  insert into fx values ('vip', v_b ->> 'id');
  v_pay := public.begin_payment((v_b ->> 'id')::uuid, 'VNPAY');
  perform public.apply_payment_success(v_pay #>> '{payment,order_ref}', 'TXN-ADM',
    (select total_amount from public.bookings where id = (v_b ->> 'id')::uuid), '{}');
  -- Người mua khác, để không đụng giới hạn vé mỗi tài khoản của customer-1
  perform pg_temp.act_as(pg_temp.fx('c2')::uuid);
  v_b := public.create_booking(pg_temp.fx('ses')::uuid,
           jsonb_build_array(jsonb_build_object('ticket_type_id', v_free, 'quantity', 2)), gen_random_uuid()::text);
  insert into fx values ('free', v_b ->> 'id');
  perform set_config('request.jwt.claims', '', true);

  -- Worker: ký vé lẻ như bình thường
  foreach v_b in array array[to_jsonb(pg_temp.fx('vip')), to_jsonb(pg_temp.fx('free'))] loop
    perform public.attach_ticket_credentials((v_b #>> '{}')::uuid,
      (select jsonb_agg(jsonb_build_object('ticket_id', x ->> 'ticket_id', 'kid', 'tk',
                                           'payload', x ->> 'payload', 'signature', 'sig'))
       from jsonb_array_elements(public.issue_tickets((v_b #>> '{}')::uuid, 'tk')) x));
  end loop;
end $$;

select is((select status from public.bookings where id = pg_temp.fx('vip')::uuid), 'CONFIRMED',
  'Đơn VIP đã CONFIRMED sau khi ký vé');

-- ---------------------------------------------------------------- phát QR đơn
select pg_temp.act_as(pg_temp.fx('c1')::uuid);
select ok(public.get_booking_admission(pg_temp.fx('vip')::uuid) -> 'credential' = 'null'::jsonb
          and (public.get_booking_admission(pg_temp.fx('vip')::uuid) ->> 'remaining')::int = 3,
  'Chưa ký: chưa có QR đơn, còn 3 lượt');
select set_config('request.jwt.claims', '', true);

insert into fx values ('payload', public.issue_booking_credential(pg_temp.fx('vip')::uuid, 'tk'));
select is((pg_temp.fx('payload')::jsonb ->> 'v')::int, 2, 'Payload QR đơn là v2');
select is(pg_temp.fx('payload')::jsonb ->> 'bid', pg_temp.fx('vip'), 'Payload chứa booking id');
select public.attach_booking_credential(pg_temp.fx('vip')::uuid, 'tk', pg_temp.fx('payload'), 'sig-vip');
select is(public.issue_booking_credential(pg_temp.fx('vip')::uuid, 'tk'), null, 'Đã có QR thì không phát lại');

select pg_temp.act_as(pg_temp.fx('c1')::uuid);
select is(public.get_booking_admission(pg_temp.fx('vip')::uuid) #>> '{credential,signature}', 'sig-vip',
  'Chủ đơn đọc được QR đơn');
select pg_temp.act_as(pg_temp.fx('c2')::uuid);
select throws_ok(format('select public.get_booking_admission(%L)', pg_temp.fx('vip')), 'NOT_FOUND',
  'Người khác không đọc được QR đơn');
set local role authenticated;
select is_empty($$ select 1 from public.booking_credentials $$, 'RLS: người khác không thấy booking_credentials');
reset role;

-- ---------------------------------------------------------------- soát vé theo đơn
-- Đưa Đêm 1 vào giờ mở cổng (chỉ trong transaction test)
select set_config('request.jwt.claims', '', true);
update public.sessions set sales_start_at = now() - interval '3 hours', sales_end_at = now() - interval '2 hours',
                           doors_open_at = now() - interval '1 hour',
                           starts_at = now() + interval '30 minutes', ends_at = now() + interval '3 hours'
 where id = pg_temp.fx('ses')::uuid;
update public.staff_assignments set valid_from = now() - interval '2 hours', valid_until = now() + interval '4 hours'
 where session_id = pg_temp.fx('ses')::uuid;

select pg_temp.act_as(pg_temp.fx('staff')::uuid);
insert into fx select 'dev', public.register_gate_device(
  (select tenant_id from public.sessions where id = pg_temp.fx('ses')::uuid), 'fp-adm', 'Máy test', 'ANDROID') ->> 'device_id';

create function pg_temp.scan(p_booking text, p_scan text, p_count int) returns jsonb language sql as $$
  select public.check_in_booking(pg_temp.fx(p_booking)::uuid, pg_temp.fx('ses')::uuid, pg_temp.fx('g1')::uuid,
                                 pg_temp.fx('dev')::uuid, p_scan, p_count) $$;
grant execute on function pg_temp.scan(text, text, int) to authenticated;

insert into fx values ('s1', pg_temp.scan('vip', 'scan-1', 2)::text);
select ok(pg_temp.fx('s1')::jsonb ->> 'result' = 'OK'
          and jsonb_array_length(pg_temp.fx('s1')::jsonb -> 'admitted') = 2
          and (pg_temp.fx('s1')::jsonb ->> 'remaining')::int = 1,
  'Một lần quét cho vào 2 người, còn 1 lượt');
select ok((pg_temp.scan('vip', 'scan-1', 2) ->> 'replayed')::boolean
          and (pg_temp.scan('vip', 'scan-1', 2) ->> 'remaining')::int = 1,
  'Gửi lại cùng client_scan_id không trừ thêm lượt');
select throws_ok($$ select pg_temp.scan('vip', 'scan-2', 5) $$, 'VALIDATION_FAILED',
  'Xin vào nhiều hơn số lượt còn lại bị từ chối');
select is((select count(*)::int from public.tickets where booking_id = pg_temp.fx('vip')::uuid and status = 'USED'), 2,
  'Lần quét bị từ chối không ghi vé nào');
select is(pg_temp.scan('vip', 'scan-3', 1) ->> 'remaining', '0', 'Người thứ 3 vào, hết lượt');
select is(pg_temp.scan('vip', 'scan-4', 1) ->> 'result', 'ALREADY_USED', 'Quét lại QR đã dùng hết: ALREADY_USED');
select is(pg_temp.scan('free', 'scan-5', 1) ->> 'result', 'WRONG_ZONE', 'Vé khu đứng quét ở cổng G1: WRONG_ZONE');
select is((select count(*)::int from public.scan_logs where device_id = pg_temp.fx('dev')::uuid), 5,
  'Mỗi vé cho vào và mỗi lần từ chối đều có log');

select * from finish();
rollback;
