-- ============================================================================
-- Smoke test end-to-end cho toàn bộ migration (chạy trên DB LOCAL sau `supabase db reset`):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/scripts/smoke_e2e.sql
-- Toàn bộ chạy trong một transaction và ROLLBACK ở cuối: không để lại dữ liệu.
-- Dòng nào bắt đầu bằng "WRONG" hoặc "UNEXPECTED" là test hỏng; dòng "check:" phải là true.
-- Kiểm tra: KYC + MFA, Layout bất biến, vé FREE có quota, SEAT_CONFLICT, idempotency,
-- vé mời COMP, POS, IPN trùng, trả muộn -> hoàn 100%, sổ cái cân, cô lập tenant,
-- QR chỉ chủ vé đọc, Staff (phân công, thiết bị, online/offline FWW, thủ công, thu hồi),
-- B2B, Report -> Dispute -> hold, đình chỉ Org (hai Admin), hủy Session duyệt hai người
-- -> refund engine -> thu tài khoản (OTP) -> chuyển khoản thủ công, hoàn thủ công,
-- chargeback, đối soát -> payout (cooldown tài khoản, hai người duyệt), file đối soát cổng,
-- job cảnh báo / nhắc lịch, máy trạng thái, outbox thử lại.
-- Test tranh ghế song song (AC-01) cần nhiều kết nối: xem supabase/tests và ghi chú cuối file.
-- ============================================================================
\set ON_ERROR_STOP 1
begin;
\pset format unaligned
\pset tuples_only on
-- users
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','owner@a.vn','{"full_name":"Owner A"}'),
 ('00000000-0000-0000-0000-00000000000b','owner@b.vn','{"full_name":"Owner B"}'),
 ('00000000-0000-0000-0000-0000000000a1','admin1@p.vn','{}'),
 ('00000000-0000-0000-0000-0000000000a2','admin2@p.vn','{}'),
 ('00000000-0000-0000-0000-0000000000c1','c1@x.vn','{"full_name":"Khach Mot","phone":"0901234567"}'),
 ('00000000-0000-0000-0000-0000000000c2','c2@x.vn','{"full_name":"Khach Hai"}'),
 ('00000000-0000-0000-0000-0000000000f1','staff@a.vn','{"full_name":"Staff A"}'),
 ('00000000-0000-0000-0000-0000000000f2','pos@a.vn','{"full_name":"POS A"}'),
 ('00000000-0000-0000-0000-0000000000e1','buyer@corp.vn','{"full_name":"Corp Buyer"}');
insert into public.memberships (user_id, scope, roles) values
 ('00000000-0000-0000-0000-0000000000a1','PLATFORM',array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']),
 ('00000000-0000-0000-0000-0000000000a2','PLATFORM',array['FINANCE_ADMIN','DISPUTE_ADMIN']);
insert into public.signing_keys (kid, public_key) values ('k1','PUBKEY');
create or replace function pg_temp.t_as(p_uid text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated','aal',p_aal)::text, false); $$;
create or replace function pg_temp.t_as_otp(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated','aal','aal1',
    'amr', json_build_array(json_build_object('method','otp','timestamp', extract(epoch from now())::bigint)))::text, false); $$;
grant execute on function pg_temp.t_as(text,text), pg_temp.t_as_otp(text) to authenticated;
create or replace function pg_temp.t_expect(p_sql text, p_code text) returns text language plpgsql as $$
begin execute p_sql; return 'UNEXPECTED_SUCCESS expected '||p_code;
exception when others then if sqlerrm = p_code then return 'ok '||p_code; else return 'WRONG '||sqlerrm||' expected '||p_code; end if; end $$;
grant execute on function pg_temp.t_expect(text,text) to authenticated, service_role;
set role authenticated;
-- ===== Org onboarding
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select public.create_organization('Nha Hat A','nha-hat-a') as org_a \gset
select pg_temp.t_as('00000000-0000-0000-0000-00000000000b','aal2');
select public.create_organization('Org B','smoke-org-b') as org_b \gset
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select public.list_my_workspaces();
select public.submit_kyc(:'org_a', '{"legal_name":"Cong ty A"}', '079 123 456', jsonb_build_array(jsonb_build_object('doc_type','BUSINESS_LICENSE','storage_path', :'org_a' || '/gpkd.pdf'))) as kyc \gset
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal1');
select 'kyc without mfa: ' || pg_temp.t_expect(format('select public.review_kyc(%L,%L)', :'kyc','APPROVED'), 'MFA_REQUIRED');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select public.review_kyc(:'kyc','APPROVED');
-- ===== Venue, layout
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal1');
select public.save_venue(jsonb_build_object('tenant_id', :'org_a', 'name','Nha hat Thanh pho','venue_type','THEATER','address_line','7 Cong Truong Lam Son','district','Quan 1','city','TP.HCM','capacity',500)) as venue \gset
select public.create_layout(:'venue','Khan phong') ->> 'layout_version_id' as lv \gset
select public.save_layout_draft(:'lv', '{"zones":[{"id":"A","name":"Khu A","type":"seated","seats":[
 {"id":"A-1-1","section":"Tang 1","row":"1","number":"1","x":0,"y":0},
 {"id":"A-1-2","section":"Tang 1","row":"1","number":"2","x":1,"y":0},
 {"id":"A-1-3","section":"Tang 1","row":"1","number":"3","x":2,"y":0,"flags":["wheelchair"]},
 {"id":"A-2-1","section":"Tang 1","row":"2","number":"1","x":0,"y":1},
 {"id":"A-2-2","section":"Tang 1","row":"2","number":"2","x":1,"y":1,"blocked":true}]},
 {"id":"GA","name":"Khu dung","type":"standing","capacity":100}]}');
select 'publish: ' || public.publish_layout_version(:'lv')::text;
select 'edit published: ' || pg_temp.t_expect(format('select public.save_layout_draft(%L, %L)', :'lv', '{"zones":[]}'), 'INVALID_STATE');
-- ===== Event, sessions, ticket types (một Event nhiều Session)
select public.save_event(jsonb_build_object('tenant_id', :'org_a','title','Hoa nhac mua thu','slug','hoa-nhac-mua-thu')) as ev \gset
select public.save_session(jsonb_build_object('event_id', :'ev','venue_id', :'venue','layout_version_id', :'lv','title','Dem 1 TP.HCM',
  'starts_at', now() + interval '3 days','ends_at', now() + interval '3 days 3 hours','sales_start_at', now() - interval '1 hour','sales_end_at', now() + interval '3 days')) as ses \gset
select public.save_session(jsonb_build_object('event_id', :'ev','venue_id', :'venue','layout_version_id', :'lv','title','Dem 2 TP.HCM',
  'starts_at', now() + interval '2 hours','ends_at', now() + interval '5 hours','sales_start_at', now() - interval '1 hour','sales_end_at', now() + interval '110 minutes')) as ses2 \gset
select id as zone_a from public.zones where layout_version_id = :'lv' and code='A' \gset
select id as zone_ga from public.zones where layout_version_id = :'lv' and code='GA' \gset
select public.save_ticket_type(jsonb_build_object('session_id', :'ses','name','VIP','kind','PAID','price_amount',500000,'quota',4,'zone_ids',jsonb_build_array(:'zone_a'))) as tt_vip \gset
select public.save_ticket_type(jsonb_build_object('session_id', :'ses','name','Mien phi','kind','FREE','quota',3,'max_per_order',5,'zone_ids',jsonb_build_array(:'zone_ga'))) as tt_free \gset
select public.save_ticket_type(jsonb_build_object('session_id', :'ses','name','Dung','kind','PAID','price_amount',100000,'quota',20,'zone_ids',jsonb_build_array(:'zone_ga'))) as tt_dung \gset
select public.save_ticket_type(jsonb_build_object('session_id', :'ses','name','Khach moi','kind','COMP','quota',3,'zone_ids',jsonb_build_array(:'zone_a', :'zone_ga'))) as tt_comp \gset
select public.save_ticket_type(jsonb_build_object('session_id', :'ses2','name','Thuong','kind','PAID','price_amount',200000,'quota',10,'zone_ids',jsonb_build_array(:'zone_a'))) as tt2 \gset
select 'free with price: ' || pg_temp.t_expect(format('select public.save_ticket_type(%L)', jsonb_build_object('session_id', :'ses','name','x','kind','FREE','price_amount',1000,'quota',3,'zone_ids',jsonb_build_array(:'zone_ga'))), 'VALIDATION_FAILED');
select 'submit: ' || public.submit_event_for_review(:'ev')::text;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select public.review_event(:'ev','APPROVED');
reset role;
select public.run_session_status_transitions();
select 'session status: ' || string_agg(status, ',') from public.sessions;
select id as s11 from public.seats where seat_code='A-1-1' \gset
select id as s12 from public.seats where seat_code='A-1-2' \gset
select id as s13 from public.seats where seat_code='A-1-3' \gset
select id as s21 from public.seats where seat_code='A-2-1' \gset
select id as s22 from public.seats where seat_code='A-2-2' \gset
set role authenticated;
-- ===== Booking
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s11'),jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s12')), 'key-c1-0001') ->> 'id' as b1 \gset
select 'idempotent: ' || (public.create_booking(:'ses', '[{"x":1}]', 'key-c1-0001') ->> 'id' = :'b1');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select 'seat conflict: ' || pg_temp.t_expect(format('select public.create_booking(%L, %L, %L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s12'),jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s21')), 'key-c2-0001'), 'SEAT_CONFLICT');
select 'blocked seat: ' || pg_temp.t_expect(format('select public.create_booking(%L, %L, %L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s22')), 'key-c2-0002'), 'SEAT_CONFLICT');
select 'free booking: ' || (public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_free','quantity',2)), 'key-c2-0003') ->> 'status');
select 'free quota: ' || pg_temp.t_expect(format('select public.create_booking(%L, %L, %L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_free','quantity',2)), 'key-c2-0004'), 'SOLD_OUT');
select 'c2 reads c1 booking: ' || count(*) from public.bookings where id = :'b1';
select 'customer buys COMP: ' || pg_temp.t_expect(format('select public.create_booking(%L, %L, %L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_comp','quantity',1)), 'key-c2-0005'), 'VALIDATION_FAILED');
select 'customer issues COMP: ' || pg_temp.t_expect(format('select public.issue_comp_tickets(%L, %L, %L, %L)', :'ses', :'tt_comp', '[{"email":"x@y.vn","name":"X"}]', 'comp-x-0001'), 'FORBIDDEN');
-- ===== Vé mời COMP (FR-EVT-05): người nhận có tài khoản thì sở hữu vé, quota bị trừ
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal1');
select 'comp: ' || (public.issue_comp_tickets(:'ses', :'tt_comp', jsonb_build_array(
   jsonb_build_object('email','c1@x.vn','name','Khach Mot'),
   jsonb_build_object('email','vip@guest.vn','name','Nghe si khach moi','quantity',1)), 'comp-batch-0001') ->> 'remaining');
select 'comp over quota: ' || pg_temp.t_expect(format('select public.issue_comp_tickets(%L, %L, %L, %L)', :'ses', :'tt_comp', '[{"email":"a@g.vn","name":"A","quantity":2}]', 'comp-batch-0002'), 'SOLD_OUT');
reset role;
select 'check: comp owners ' || (count(*) filter (where user_id = '00000000-0000-0000-0000-0000000000c1') = 1
                                 and count(*) filter (where user_id is null) = 1 and bool_and(status = 'PAID'))
from public.bookings where booking_type = 'COMP';
set role authenticated;
-- ===== Payment
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select public.begin_payment(:'b1','VNPAY') -> 'payment' ->> 'order_ref' as ref1 \gset
reset role; set role service_role;
select 'ipn: ' || public.apply_payment_success(:'ref1','TXN-1', 1000000, '{"method":"ATM"}')::text;
select 'ipn dup: ' || public.apply_payment_success(:'ref1','TXN-1', 1000000, '{}')::text;
select public.issue_tickets(:'b1','k1');
select 'attach: ' || public.attach_ticket_credentials(:'b1', (select jsonb_agg(jsonb_build_object('ticket_id', t.id,'kid','k1','payload','p','signature','s')) from public.tickets t where booking_id = :'b1'));
reset role;
select 'balances: ' || string_agg(code || '=' || balance, ', ' order by code) from public.ledger_account_balances where balance <> 0;
-- late payment: c2 books A-2-1, starts payment, gateway query says unpaid -> expired, c1 takes seat, c2 IPN arrives
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s21')), 'key-c2-0010') ->> 'id' as b2 \gset
select public.begin_payment(:'b2','VNPAY') -> 'payment' ->> 'order_ref' as ref2 \gset
reset role; set role service_role;
select 'expire: ' || public.expire_unpaid_booking(:'b2');
reset role; set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s21')), 'key-c1-0010') ->> 'status' as b3status \gset
select 'c1 takes seat: ' || :'b3status';
reset role; set role service_role;
select 'late ipn: ' || public.apply_payment_success(:'ref2','TXN-2', 500000, '{}')::text;
reset role;
select 'inventory vip: ' || row_to_json(i)::text from public.ticket_type_inventory i where ticket_type_id = :'tt_vip';
select 'balances: ' || string_agg(code || '=' || balance, ', ' order by code) from public.ledger_account_balances where balance <> 0;
-- ===== RLS / IDOR (AC-15)
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-00000000000b','aal2');
select 'orgB sees orgA bookings: ' || count(*) from public.bookings where tenant_id = :'org_a';
select 'orgB sees orgA layouts: ' || count(*) from public.layout_versions where tenant_id = :'org_a';
select 'orgB sees orgA payments: ' || count(*) from public.payments where org_id = :'org_a';
select 'orgB save_event on orgA: ' || pg_temp.t_expect(format('select public.save_event(%L)', jsonb_build_object('id', :'ev', 'title','hack')), 'FORBIDDEN');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select 'c2 sees c1 credentials: ' || count(*) from public.ticket_credentials;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select 'c1 sees own credentials: ' || count(*) from public.ticket_credentials;
select 'anon-ish public events: ' || count(*) from public.events;
reset role;

select b.id as b1 from public.bookings b where status='CONFIRMED' \gset
select public.issue_tickets(id,'k1') from public.bookings where total_amount=0 and status='PAID';
select 'check: comp holder names ' || bool_and(holder_name is not null) from public.tickets t join public.bookings b on b.id = t.booking_id where b.booking_type = 'COMP';
select t.id as t1 from public.tickets t where booking_id = :'b1' order by id limit 1 \gset
select t.id as t2 from public.tickets t where booking_id = :'b1' order by id desc limit 1 \gset
select t.id as tfree from public.tickets t join public.bookings b on b.id = t.booking_id where b.booking_type = 'CUSTOMER' and t.zone_id = :'zone_ga' limit 1 \gset
update public.sessions set doors_open_at = now() - interval '10 minutes', starts_at = now() + interval '1 hour' where id = :'ses';
insert into public.gates (tenant_id, venue_id, code, name) values (:'org_a', :'venue', 'G1', 'Cong 1'), (:'org_a', :'venue', 'G2', 'Cong 2');
select id as g1 from public.gates where code='G1' and venue_id = :'venue' \gset
select id as g2 from public.gates where code='G2' and venue_id = :'venue' \gset
set role authenticated;
-- ===== Staff
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select 'member: ' || public.set_org_member(:'org_a','staff@a.vn', array['SCANNER'])::text;
select 'member pos: ' || public.set_org_member(:'org_a','pos@a.vn', array['POS'])::text;
select public.set_session_gate_zones(:'ses', jsonb_build_array(jsonb_build_object('gate_id', :'g1','zone_ids', jsonb_build_array(:'zone_a')), jsonb_build_object('gate_id', :'g2','zone_ids', jsonb_build_array(:'zone_ga'))));
select public.assign_staff(:'ses','00000000-0000-0000-0000-0000000000f1', array['SCAN','MANUAL_CHECKIN'], :'g1') as asg \gset
select public.assign_staff(:'ses','00000000-0000-0000-0000-0000000000f2', array['POS'], :'g2') as asg_pos \gset
select 'POS without role: ' || pg_temp.t_expect(format('select public.assign_staff(%L,%L,%L)', :'ses','00000000-0000-0000-0000-0000000000f1','{POS}'), 'VALIDATION_FAILED');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000f1');
select 'staff workspaces: ' || public.list_my_workspaces()::text;
select 'set ws: ' || public.set_active_workspace('STAFF', :'org_a')::text;
select public.register_gate_device(:'org_a','fp-123','Pixel cong 1','ANDROID') ->> 'device_id' as dev \gset
select 'manifest tickets: ' || jsonb_array_length(public.get_session_manifest(:'ses', :'dev') -> 'tickets');
select 'checkin: ' || (public.check_in(:'t1', :'ses', :'g1', :'dev', 'scan-1') ->> 'result');
select 'checkin replay: ' || (public.check_in(:'t1', :'ses', :'g1', :'dev', 'scan-1') ->> 'result');
select 'checkin again: ' || (public.check_in(:'t1', :'ses', :'g1', :'dev', 'scan-2') ->> 'result');
select 'wrong gate: ' || (public.check_in(:'tfree', :'ses', :'g1', :'dev', 'scan-3') ->> 'result');
select 'offline sync: ' || public.sync_offline_scans(:'ses', :'dev', jsonb_build_array(
   jsonb_build_object('client_scan_id','off-1','ticket_id', :'t2','gate_id', :'g1','scanned_at', now() - interval '5 minutes','local_result','OK'),
   jsonb_build_object('client_scan_id','off-2','ticket_id', :'t2','gate_id', :'g1','scanned_at', now() - interval '4 minutes','local_result','OK'),
   jsonb_build_object('client_scan_id','off-3','ticket_id', :'t1','gate_id', :'g1','scanned_at', now() - interval '9 minutes','local_result','OK')))::text;
reset role;
select 'check: t1 used_at moved earlier (FWW) ' || (used_at < now() - interval '8 minutes') from public.tickets where id = :'t1';
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000f1');
select 'search: ' || jsonb_array_length(public.search_attendees(:'ses','Khach'));
select 'analytics by scanner: ' || pg_temp.t_expect(format('select public.get_gate_analytics(%L)', :'ses'), 'FORBIDDEN');
select 'scanner sells POS: ' || pg_temp.t_expect(format('select public.create_booking(%L,%L,%L,%L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_dung','quantity',1)), 'pos-f1-0001', '{"booking_type":"POS"}'), 'FORBIDDEN');
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select 'analytics: ' || (public.get_gate_analytics(:'ses') ->> 'checked_in');
select public.revoke_gate_device(:'dev','mat may');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000f1');
select 'revoked device: ' || pg_temp.t_expect(format('select public.check_in(%L,%L,%L,%L,%L)', :'t2', :'ses', :'g1', :'dev','scan-9'), 'DEVICE_REVOKED');
select 'staff reads bookings of org (should be 0): ' || count(*) from public.bookings;
-- ===== POS online (S6-BE1-1): Staff được phân công quyền POS, thanh toán qua cổng, phát vé ngay
select pg_temp.t_as('00000000-0000-0000-0000-0000000000f2');
select public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_dung','quantity',2)), 'pos-f2-0001', '{"booking_type":"POS","buyer_name":"Khach le","buyer_phone":"0909000111"}') ->> 'id' as bpos \gset
select public.begin_payment(:'bpos','VNPAY') -> 'payment' ->> 'order_ref' as refpos \gset
reset role; set role service_role;
select 'pos ipn: ' || (public.apply_payment_success(:'refpos','TXN-POS', 200000, '{"method":"QR"}') ->> 'result');
select public.attach_ticket_credentials(:'bpos', (select jsonb_agg(jsonb_build_object('ticket_id', x ->> 'ticket_id','kid','k1','payload', x ->> 'payload','signature','s')) from jsonb_array_elements(public.issue_tickets(:'bpos','k1')) x));
reset role; set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000f2');
select 'pos staff reads QR: ' || count(*) from public.ticket_credentials;
reset role;
select 'check: pos booking ' || (status = 'CONFIRMED' and booking_type = 'POS' and sold_by = '00000000-0000-0000-0000-0000000000f2' and user_id is null) from public.bookings where id = :'bpos';
-- ===== B2B
insert into public.corporate_accounts (id, name, tax_code, created_by) values ('11111111-1111-1111-1111-111111111111','Cong ty XYZ','0312345678','00000000-0000-0000-0000-0000000000e1');
insert into public.corporate_members values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000e1','ADMIN');
insert into public.corporate_agreements (tenant_id, corporate_account_id, discount_bp, min_tickets_per_order, valid_from, created_by)
 values (:'org_a','11111111-1111-1111-1111-111111111111', 1500, 1, now() - interval '1 day','00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000e1');
select 'b2b: ' || (public.create_booking(:'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s13')), 'key-b2b-0001', jsonb_build_object('corporate_account_id','11111111-1111-1111-1111-111111111111')) ->> 'total_amount');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select 'b2b by non member: ' || pg_temp.t_expect(format('select public.create_booking(%L,%L,%L,%L)', :'ses', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt_vip','seat_id', :'s13')), 'key-xx-0001', '{"corporate_account_id":"11111111-1111-1111-1111-111111111111"}'), 'FORBIDDEN');
-- ===== Report
reset role; update public.app_settings set value = '1' where key = 'dispute.report_threshold'; set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select 'report: ' || (public.submit_report(:'t1','NOT_AS_DESCRIBED','Am thanh rat te, khong nghe ro') ? 'dispute_case_id');
select 'report dup: ' || pg_temp.t_expect(format('select public.submit_report(%L,%L,%L)', :'t1','NOT_AS_DESCRIBED','Lan thu hai gui lai'), 'VALIDATION_FAILED');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select 'report on others ticket: ' || pg_temp.t_expect(format('select public.submit_report(%L,%L,%L)', :'t1','OTHER','khong phai ve cua toi'), 'NOT_FOUND');
reset role;
select 'hold: ' || status || ' case ' || (select status from public.dispute_cases) from public.fund_holds;
set role authenticated;
-- ===== Đình chỉ Org (tài liệu mục 6): hai Admin; dừng bán mọi Session, giữ payout
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select public.request_org_status_change(:'org_a','SUSPEND','Nghi van gian lan') as appr_s \gset
select 'suspend self vote: ' || pg_temp.t_expect(format('select public.vote_approval(%L,%L)', :'appr_s','APPROVE'), 'INVALID_STATE');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select 'suspend vote2: ' || (public.vote_approval(:'appr_s','APPROVE') ->> 'status');
reset role;
select 'check: suspended ' || ((select status from public.organizations where id = :'org_a') = 'SUSPENDED'
   and (select bool_and(sales_paused) from public.sessions where tenant_id = :'org_a')
   and exists (select 1 from public.fund_holds where tenant_id = :'org_a' and scope = 'ORG_BALANCE' and status = 'ACTIVE'));
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select 'book while suspended: ' || pg_temp.t_expect(format('select public.create_booking(%L,%L,%L)', :'ses2', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt2','seat_id', :'s11')), 'key-c2-0020'), 'SESSION_NOT_ON_SALE');
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select 'event while suspended: ' || pg_temp.t_expect(format('select public.save_event(%L)', jsonb_build_object('tenant_id', :'org_a','title','Su kien moi','slug','su-kien-moi')), 'INVALID_STATE');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select public.request_org_status_change(:'org_a','UNSUSPEND','Da xac minh') as appr_u \gset
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'unsuspend vote2: ' || (public.vote_approval(:'appr_u','APPROVE') ->> 'status');
reset role;
select 'check: unsuspended ' || ((select status from public.organizations where id = :'org_a') = 'APPROVED'
   and not (select bool_or(sales_paused) from public.sessions where tenant_id = :'org_a')
   and not exists (select 1 from public.fund_holds where tenant_id = :'org_a' and scope = 'ORG_BALANCE' and status = 'ACTIVE'));
set role authenticated;
-- ===== Hủy Session: dừng bán ngay, hai Admin duyệt, hoàn 100%
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select public.request_session_cancellation(:'ses','Nghe si om') as req \gset
select 'paused: ' || sales_paused from public.sessions where id = :'ses';
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select 'book after pause: ' || pg_temp.t_expect(format('select public.create_booking(%L,%L,%L)', :'ses', '[{"ticket_type_id":"00000000-0000-0000-0000-000000000000","seat_id":null,"quantity":1}]', 'key-c1-9999'), 'SESSION_NOT_ON_SALE');
reset role; select approval_id as appr from public.session_change_requests where id = :'req' \gset
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'vote1: ' || public.vote_approval(:'appr','APPROVE')::text;
select 'vote1 again: ' || pg_temp.t_expect(format('select public.vote_approval(%L,%L)', :'appr','APPROVE'), 'INVALID_STATE');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select 'vote2: ' || public.vote_approval(:'appr','APPROVE')::text;
reset role;
select 'session: ' || status from public.sessions where id = :'ses';
select 'bookings: ' || string_agg(booking_type || ':' || status, ', ' order by booking_type, status) from public.bookings;
select 'refunds: ' || string_agg(reason || ':' || status || ':' || amount, ', ' order by reason, amount) from public.refunds;
select 'tickets: ' || string_agg(status, ',' order by status) from public.tickets;
-- ===== Refund engine: worker nhận việc -> cổng; một Refund bị từ chối -> thu tài khoản (OTP)
select id as rf_c1 from public.refunds r where reason = 'SESSION_CANCELLED' and booking_id = :'b1' \gset
set role service_role;
select 'apply before processing: ' || pg_temp.t_expect(format('select public.apply_refund_result(%L, true)', :'rf_c1'), 'INVALID_STATE');
select count(public.start_refund_processing(id)) from public.refunds where status = 'REQUESTED';
select public.apply_refund_result(:'rf_c1', false, null, 'card closed', true);
select public.apply_refund_result(id, true, 'GW-' || left(id::text, 8)) from public.refunds where status = 'PROCESSING';
reset role; set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c1');
select 'bank info without otp: ' || pg_temp.t_expect(format('select public.submit_refund_bank_info(%L,%L,%L,%L)', :'rf_c1','VCB','0123456789','Khach Mot'), 'OTP_REQUIRED');
select pg_temp.t_as_otp('00000000-0000-0000-0000-0000000000c1');
select public.submit_refund_bank_info(:'rf_c1','VCB','0123456789','Khach Mot') as appr_mt \gset
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select 'org reads bank info: ' || count(*) from public.refund_bank_infos;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'transfer before approval: ' || pg_temp.t_expect(format('select public.confirm_manual_transfer(%L,%L)', :'rf_c1','FT001'), 'INVALID_STATE');
select public.vote_approval(:'appr_mt','APPROVE');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select public.vote_approval(:'appr_mt','APPROVE');
select public.confirm_manual_transfer(:'rf_c1','FT001');
reset role;
select 'after refunds bookings: ' || string_agg(status, ', ' order by status) from public.bookings where session_id = :'ses';
select 'check: all refunds succeeded ' || bool_and(status = 'SUCCEEDED') from public.refunds;
select 'check: cancelled session ledger is zero ' || (coalesce(sum(case e.direction when 'DEBIT' then e.amount else -e.amount end), 0) = 0)
  from public.ledger_entries e join public.ledger_transactions t on t.id = e.transaction_id
  join public.ledger_accounts a on a.id = e.account_id
 where t.session_id = :'ses' and a.code like 'ORG:%';
select 'settlement cancelled session: ' || (public.compute_settlement(:'ses') ->> 'status');
-- ===== Session 2: bán, thanh toán, cảnh báo phát vé, nhắc lịch, hoàn thủ công, chargeback
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000c2');
select public.create_booking(:'ses2', jsonb_build_array(jsonb_build_object('ticket_type_id', :'tt2','seat_id', :'s11'), jsonb_build_object('ticket_type_id', :'tt2','seat_id', :'s12')), 'key-c2-0030') ->> 'id' as b5 \gset
select public.begin_payment(:'b5','VNPAY') -> 'payment' ->> 'order_ref' as ref5 \gset
reset role; set role service_role;
select 'ipn s2: ' || (public.apply_payment_success(:'ref5','TXN-3', 400000, '{}') ->> 'result');
reset role;
update public.bookings set paid_at = now() - interval '10 minutes' where id = :'b5';
select 'confirm alerts: ' || public.alert_unconfirmed_bookings() || ' then ' || public.alert_unconfirmed_bookings();
set role service_role;
select public.attach_ticket_credentials(:'b5', (select jsonb_agg(jsonb_build_object('ticket_id', x ->> 'ticket_id','kid','k1','payload', x ->> 'payload','signature','s')) from jsonb_array_elements(public.issue_tickets(:'b5','k1')) x));
select 'claim issue jobs: ' || count(*) from public.claim_outbox('ISSUE_TICKETS', 'w1', 100);
reset role;
select 'reminders: ' || public.enqueue_session_reminders() || ' then ' || public.enqueue_session_reminders();
select 'check: 2h reminder for c2 ' || exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and template = 'SESSION_REMINDER_2H');
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'manual refund: ' || (public.create_manual_refund(:'b5', 100000, 'Ghe bi hong tay vin') ->> 'status');
reset role; update public.app_settings set value = '50000' where key = 'approval.refund_manual_threshold'; set role authenticated;
select public.create_manual_refund(:'b5', 50000, 'Bu tru phi gui xe') ->> 'approval_id' as appr_rf \gset
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select 'manual refund vote2: ' || (public.vote_approval(:'appr_rf','APPROVE') ->> 'status');
reset role; set role service_role;
select count(public.start_refund_processing(id)) from public.refunds where status = 'REQUESTED';
select public.apply_refund_result(id, true, 'GW-' || left(id::text, 8)) from public.refunds where status = 'PROCESSING';
reset role;
select 'check: b5 partially refunded ' || (status = 'PARTIALLY_REFUNDED') from public.bookings where id = :'b5';
select id as pay5 from public.payments where booking_id = :'b5' \gset
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select public.record_chargeback(:'pay5','CB-001', 200000, 'Khach khieu nai ngan hang') as cb \gset
select 'chargeback dup: ' || pg_temp.t_expect(format('select public.record_chargeback(%L,%L,%L,%L)', :'pay5','CB-001', 1000, 'x'), 'VALIDATION_FAILED');
select public.resolve_chargeback(:'cb','WON','Ngan hang chap nhan bang chung');
reset role;
select 'check: chargeback voids tickets, WON reversal posted ' || ((select bool_and(status = 'VOID') from public.tickets where booking_id = :'b5')
   and exists (select 1 from public.ledger_transactions where kind = 'REVERSAL' and reversal_of is not null));
-- ===== Kết thúc Session 2 -> đối soát -> payout (cooldown tài khoản, hai người duyệt)
update public.sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour',
       doors_open_at = now() - interval '4 hours', sales_start_at = now() - interval '5 hours',
       sales_end_at = now() - interval '2 hours' where id = :'ses2';
select public.run_session_status_transitions();
select 'session2: ' || status || ', event ' || (select status from public.events where id = :'ev') from public.sessions where id = :'ses2';
select 'cutoffs: ' || public.run_settlement_cutoffs();
select 'settlement before cutoff: ' || status from public.settlements where session_id = :'ses2';
update public.settlements set cutoff_at = now() - interval '1 minute' where session_id = :'ses2';
select public.run_settlement_cutoffs();
select 'settlement: ' || status || ' gross=' || gross_amount || ' refund=' || refund_amount || ' cb=' || chargeback_amount || ' fee=' || fee_amount || ' net=' || net_amount
  from public.settlements where session_id = :'ses2';
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal1');
select 'bank change without mfa: ' || pg_temp.t_expect(format('select public.request_bank_account_change(%L,%L,%L,%L)', :'org_a','VCB','9988776655','CONG TY A'), 'MFA_REQUIRED');
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select public.request_bank_account_change(:'org_a','VCB','9988776655','CONG TY A') as bank \gset
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'payout no account: ' || pg_temp.t_expect(format('select public.propose_payout(%L)', :'org_a'), 'INVALID_STATE');
select public.review_bank_account(:'bank','APPROVE');
select 'payout in cooldown: ' || pg_temp.t_expect(format('select public.propose_payout(%L)', :'org_a'), 'INVALID_STATE');
reset role; update public.org_bank_accounts set effective_at = now() - interval '1 minute' where id = :'bank'; set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select public.propose_payout(:'org_a') as po \gset
select (:'po'::jsonb) ->> 'approval_id' as appr_po \gset
select (:'po'::jsonb) ->> 'payout_id' as payout \gset
select 'payout proposer votes again: ' || pg_temp.t_expect(format('select public.vote_approval(%L,%L)', :'appr_po','APPROVE'), 'INVALID_STATE');
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a2','aal2');
select 'payout vote2: ' || (public.vote_approval(:'appr_po','APPROVE') ->> 'status');
reset role; set role service_role;
select public.mark_payout_sent(:'payout', 'PO-REF-1');
select public.confirm_payout(:'payout', true);
reset role;
select 'payout: ' || status || ' ' || amount from public.payouts where id = :'payout';
select 'check: settlement paid out, org balance zero ' || ((select status from public.settlements where session_id = :'ses2') = 'PAID_OUT'
   and public.org_payable_balance(:'org_a') = 0);
set role authenticated;
select pg_temp.t_as('00000000-0000-0000-0000-00000000000a','aal2');
select 'org finance: ' || (public.get_org_finance_summary(:'org_a') ->> 'paid_out');
select pg_temp.t_as('00000000-0000-0000-0000-00000000000b','aal2');
select 'orgB reads orgA settlements/payouts: ' || (select count(*) from public.settlements) + (select count(*) from public.payouts);
select 'orgB finance summary: ' || pg_temp.t_expect(format('select public.get_org_finance_summary(%L)', :'org_a'), 'FORBIDDEN');
-- ===== File đối soát cổng
select pg_temp.t_as('00000000-0000-0000-0000-0000000000a1','aal2');
select 'statement: ' || public.import_gateway_statement('VNPAY', (now() at time zone 'Asia/Ho_Chi_Minh')::date, jsonb_build_array(
   jsonb_build_object('txn_type','PAYMENT','gateway_txn_id','TXN-1','amount',1000000),
   jsonb_build_object('txn_type','PAYMENT','gateway_txn_id','TXN-2','amount',400000),
   jsonb_build_object('txn_type','PAYMENT','gateway_txn_id','TXN-3','amount',400000),
   jsonb_build_object('txn_type','PAYMENT','gateway_txn_id','TXN-FAKE','amount',5000)))::text;
reset role;
select 'negative balances: ' || public.refresh_negative_balances();
-- ===== Máy trạng thái, sổ cái bất biến, outbox
select 'booking back to PENDING: ' || pg_temp.t_expect(format('update public.bookings set status = %L where id = %L', 'PENDING', :'b1'), 'INVALID_STATE');
select 'ticket seat change: ' || pg_temp.t_expect(format('update public.tickets set seat_id = null where id = %L', :'t1'), 'INVALID_STATE');
select 'refund back to REQUESTED: ' || pg_temp.t_expect(format('update public.refunds set status = %L where id = %L', 'REQUESTED', :'rf_c1'), 'INVALID_STATE');
select 'ledger tamper: ' || pg_temp.t_expect('delete from public.ledger_entries', 'IMMUTABLE_ROW');
set role service_role;
select public.complete_outbox(min(id), 'gateway timeout') from public.outbox where status = 'PROCESSING';
reset role;
select 'outbox retry: ' || status || ' attempts=' || attempts || ' backoff=' || (next_attempt_at > now()) from public.outbox where last_error = 'gateway timeout';
select 'check: ledger balanced ' || (sum(case direction when 'DEBIT' then amount else -amount end) = 0) from public.ledger_entries;
select 'audit count: ' || count(*) from public.audit_logs;

rollback;
-- AC-01 (song song): mở 30 kết nối, mỗi kết nối gọi create_booking cho CÙNG một ghế với
-- user khác nhau; kỳ vọng đúng 1 PENDING và 29 SEAT_CONFLICT, ticket_type_inventory.locked = 1.
