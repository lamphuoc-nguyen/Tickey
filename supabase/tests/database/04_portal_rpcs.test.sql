-- ============================================================================
-- pgTAP: RPC thêm cho Portal (migration 20261021*, B-18).
--   save_gate: tạo / đổi tên / lưu trữ cổng của Venue, chỉ OWNER / EVENT_MANAGER / GATE_MANAGER cùng Org
--   issue_comp_tickets: validate duplicate recipient emails (B-18)
--   assign_seats_ticket_type: gán hạng giá cho ghế (S3-BE2-2)
--   set_session_seat_status: HOLD/BLOCK/RELEASE ghế (S3-BE2-2)
--   request_bank_account_change: đổi tài khoản nhận tiền có cooldown (S6-BE2-2, AC-16)
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create temp table fx (k text primary key, v uuid);
grant all on fx to authenticated;
create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;
create function pg_temp.fx(p_k text) returns uuid language sql stable as $$ select v from fx where k = p_k $$;
grant execute on function pg_temp.act_as(uuid), pg_temp.fx(text) to authenticated;

-- Setup: Self-contained fixture (like 02_core_flows.test.sql:47-75)
do $$
declare
  v_owner_a uuid;
  v_owner_b uuid;
  v_scanner_a uuid;
  v_gm_a uuid;
  v_staff_pos uuid;
  v_admin uuid;
  v_org_a uuid;
  v_org_b uuid;
  v_kyc_a uuid;
  v_kyc_b uuid;
  v_venue uuid;
  v_layout uuid;
  v_event uuid;
  v_session uuid;
  v_zone uuid;
  v_tt_paid uuid;
  v_tt_comp uuid;
begin
  -- Create users directly (as superuser)
  v_owner_a := ('00000000-0000-0000-0000-000000000011')::uuid;
  v_owner_b := ('00000000-0000-0000-0000-000000000012')::uuid;
  v_scanner_a := ('00000000-0000-0000-0000-000000000013')::uuid;
  v_gm_a := ('00000000-0000-0000-0000-000000000014')::uuid;
  v_staff_pos := ('00000000-0000-0000-0000-000000000015')::uuid;
  v_admin := ('00000000-0000-0000-0000-000000000003')::uuid;
  
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_owner_a, 'owner_a@test.vn', jsonb_build_object('full_name', 'Owner A')),
    (v_owner_b, 'owner_b@test.vn', jsonb_build_object('full_name', 'Owner B')),
    (v_scanner_a, 'scanner_a@test.vn', jsonb_build_object('full_name', 'Scanner A')),
    (v_gm_a, 'gm_a@test.vn', jsonb_build_object('full_name', 'Gate Manager A')),
    (v_staff_pos, 'staff_pos@test.vn', jsonb_build_object('full_name', 'Staff POS')),
    (v_admin, 'admin@test.vn', jsonb_build_object('full_name', 'Admin'))
  on conflict (id) do nothing;

  -- Admin platform role for KYC review (must be before review_kyc)
  insert into public.memberships (user_id, scope, roles, status)
  values (v_admin, 'PLATFORM', array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT'], 'ACTIVE')
  on conflict (user_id) where scope = 'PLATFORM' do nothing;

  -- Create organization A as owner_a
  perform pg_temp.act_as(v_owner_a);
  v_org_a := public.create_organization('Test Org A', 'test-org-a');
  -- Submit KYC and capture submission ID
  v_kyc_a := public.submit_kyc(v_org_a, '{}', 'test-org-a', jsonb_build_array(jsonb_build_object(
              'doc_type', 'BUSINESS_LICENSE', 'storage_path', v_org_a || '/gpkd.pdf')));
  -- Admin approves KYC using submission ID
  perform pg_temp.act_as(v_admin);
  perform public.review_kyc(v_kyc_a, 'APPROVED');
  
  insert into public.memberships (user_id, scope, org_id, roles, status)
  values (v_owner_a, 'ORG', v_org_a, array['OWNER'], 'ACTIVE'),
         (v_scanner_a, 'ORG', v_org_a, array['SCANNER'], 'ACTIVE'),
         (v_gm_a, 'ORG', v_org_a, array['GATE_MANAGER'], 'ACTIVE'),
         (v_staff_pos, 'ORG', v_org_a, array['SCANNER'], 'ACTIVE')
  on conflict (org_id, user_id) where scope = 'ORG' do nothing;

  -- Create organization B as owner_b (separate org)
  perform pg_temp.act_as(v_owner_b);
  v_org_b := public.create_organization('Test Org B', 'test-org-b');
  v_kyc_b := public.submit_kyc(v_org_b, '{}', 'test-org-b', jsonb_build_array(jsonb_build_object(
              'doc_type', 'BUSINESS_LICENSE', 'storage_path', v_org_b || '/gpkd.pdf')));
  perform pg_temp.act_as(v_admin);
  perform public.review_kyc(v_kyc_b, 'APPROVED');
  
  insert into public.memberships (user_id, scope, org_id, roles, status)
  values (v_owner_b, 'ORG', v_org_b, array['OWNER'], 'ACTIVE')
  on conflict (org_id, user_id) where scope = 'ORG' do nothing;

  -- Create venue for org_a
  perform pg_temp.act_as(v_owner_a);
  v_venue := public.save_venue(jsonb_build_object('tenant_id', v_org_a, 'name', 'Test Venue',
              'address_line', '1 Le Loi', 'city', 'TP.HCM', 'capacity', 1000));
  
  -- Create layout
  v_layout := (public.create_layout(v_venue, 'Main') ->> 'layout_version_id')::uuid;
  perform public.save_layout_draft(v_layout, '{"zones":[{"id":"A","name":"Khu A","type":"seated","seats":[{"id":"A-1","row":"1","number":"1","x":0,"y":0},{"id":"A-2","row":"1","number":"2","x":1,"y":0},{"id":"A-3","row":"1","number":"3","x":2,"y":0},{"id":"A-4","row":"1","number":"4","x":3,"y":0}]},{"id":"GA","name":"Khu dung","type":"standing","capacity":50}]}');
  perform public.publish_layout_version(v_layout);
  
  -- Create event
  v_event := public.save_event(jsonb_build_object('tenant_id', v_org_a, 'title', 'Test Event', 'slug', 'test-event'));
  
  -- Create session
  v_session := public.save_session(jsonb_build_object('event_id', v_event, 'venue_id', v_venue, 'layout_version_id', v_layout,
              'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 2 hours',
              'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '10 days'));
  
  -- Get zone
  v_zone := (select id from public.zones where layout_version_id = v_layout and code = 'GA');
  
  -- Create PAID ticket type
  v_tt_paid := public.save_ticket_type(jsonb_build_object(
    'session_id', v_session,
    'name', 'VIP',
    'kind', 'PAID',
    'price_amount', 500000,
    'quota', 100,
    'zone_ids', jsonb_build_array(v_zone::uuid)
  ));
  
  -- Create COMP ticket type using the same zone
  v_tt_comp := public.save_ticket_type(jsonb_build_object(
    'session_id', v_session,
    'name', 'Khach moi',
    'kind', 'COMP',
    'quota', 100,
    'zone_ids', jsonb_build_array(v_zone::uuid)
  ));
  
  perform public.run_session_status_transitions();
  
  insert into fx values ('org_a', v_org_a), ('org_b', v_org_b), ('owner_a', v_owner_a), ('owner_b', v_owner_b),
                        ('scanner_a', v_scanner_a), ('gm_a', v_gm_a), ('staff_pos', v_staff_pos),
                        ('venue_a', v_venue), ('layout_ver', v_layout), ('event_a', v_event),
                        ('session_a', v_session), ('zone_a', v_zone), ('tt_paid', v_tt_paid),
                        ('tt_comp', v_tt_comp);
end $$;

set local role authenticated;

-- save_gate tests
do $$
begin
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  insert into fx values ('gate', public.save_gate(jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'TEST', 'name', 'Cổng test')));
end $$;
reset role;

select is((select code || '|' || name || '|' || status from public.gates where id = pg_temp.fx('gate')), 'TEST|Cổng test|ACTIVE',
          'Owner tạo cổng; mã viết hoa, bỏ khoảng trắng');
set local role authenticated;
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'TEST', 'name', 'Trùng')),
                 'P0001', 'VALIDATION_FAILED', 'Mã cổng trùng trong cùng Venue bị từ chối');
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'G2', 'name', ' ')),
                 'P0001', 'VALIDATION_FAILED', 'Tên cổng rỗng bị từ chối');
do $$ begin perform pg_temp.act_as(pg_temp.fx('gm_a')); end $$;
select lives_ok(format('select public.save_gate(%L)', jsonb_build_object('id', pg_temp.fx('gate'), 'name', 'Cổng test A')),
                'Gate Manager đổi tên cổng');
select lives_ok(format('select public.save_gate(%L)', jsonb_build_object('id', pg_temp.fx('gate'), 'status', 'ARCHIVED')),
                'Gate Manager lưu trữ cổng');
do $$ begin perform pg_temp.act_as(pg_temp.fx('scanner_a')); end $$;
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'G9', 'name', 'X')),
                 'P0001', 'FORBIDDEN', 'Nhân sự soát vé không tạo cổng');
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_b')); end $$;
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('id', pg_temp.fx('gate'), 'name', 'hack')),
                 'P0001', 'FORBIDDEN', 'Org B không sửa cổng của Org A');
reset role;
select is((select name || '|' || status from public.gates where id = pg_temp.fx('gate')), 'Cổng test A|ARCHIVED',
          'Cổng giữ thay đổi hợp lệ, không bị Org B sửa');
select is((select count(*)::int from public.audit_logs where target_type = 'gate' and target_id = pg_temp.fx('gate')::text), 3,
          'Mỗi lần lưu cổng ghi audit');

-- B-18: issue_comp_tickets duplicate email validation
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
select throws_ok(
  format('select public.issue_comp_tickets(%L, %L, %L, %L)',
    pg_temp.fx('session_a'),
    pg_temp.fx('tt_comp'),
    jsonb_build_array(
      jsonb_build_object('email', 'test@example.com', 'name', 'Recipient 1', 'zone_id', pg_temp.fx('zone_a')),
      jsonb_build_object('email', 'TEST@EXAMPLE.COM', 'name', 'Recipient 2', 'zone_id', pg_temp.fx('zone_a'))
    ),
    'test-dup-1'
  ),
  'P0001', 'VALIDATION_FAILED',
  'Duplicate emails (case-insensitive) rejected'
);
select throws_ok(
  format('select public.issue_comp_tickets(%L, %L, %L, %L)',
    pg_temp.fx('session_a'),
    pg_temp.fx('tt_comp'),
    jsonb_build_array(
      jsonb_build_object('email', '  test@example.com  ', 'name', 'Recipient 3', 'zone_id', pg_temp.fx('zone_a')),
      jsonb_build_object('email', 'test@example.com', 'name', 'Recipient 4', 'zone_id', pg_temp.fx('zone_a'))
    ),
    'test-dup-2'
  ),
  'P0001', 'VALIDATION_FAILED',
  'Duplicate emails (trimmed) rejected'
);
-- Valid distinct emails should succeed
select lives_ok(
  format('select public.issue_comp_tickets(%L, %L, %L, %L)',
    pg_temp.fx('session_a'),
    pg_temp.fx('tt_comp'),
    jsonb_build_array(
      jsonb_build_object('email', 'a@example.com', 'name', 'Recipient A', 'zone_id', pg_temp.fx('zone_a')),
      jsonb_build_object('email', 'b@example.com', 'name', 'Recipient B', 'zone_id', pg_temp.fx('zone_a'))
    ),
    'test-dup-3'
  ),
  'Distinct emails accepted'
);
-- Recipients with null/empty emails should be filtered out (not treated as duplicates)
select lives_ok(
  format('select public.issue_comp_tickets(%L, %L, %L, %L)',
    pg_temp.fx('session_a'),
    pg_temp.fx('tt_comp'),
    jsonb_build_array(
      jsonb_build_object('email', 'valid1@example.com', 'name', 'Valid 1', 'zone_id', pg_temp.fx('zone_a')),
      jsonb_build_object('email', 'valid2@example.com', 'name', 'Valid 2', 'zone_id', pg_temp.fx('zone_a'))
    ),
    'test-dup-4'
  ),
  'Valid emails accepted'
);
reset role;

-- assign_seats_ticket_type tests
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
-- Get some seat IDs from the session
insert into fx values ('seat1', (select seat_id from public.session_seats where session_id = pg_temp.fx('session_a') and status = 'AVAILABLE' limit 1));
insert into fx values ('seat2', (select seat_id from public.session_seats where session_id = pg_temp.fx('session_a') and status = 'AVAILABLE' offset 1 limit 1));

select lives_ok(
  format('select public.assign_seats_ticket_type(%L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s,%s}', pg_temp.fx('seat1'), pg_temp.fx('seat2'))::uuid[],
    pg_temp.fx('tt_paid')
  ),
  'Owner can assign ticket type to seats'
);
do $$ begin perform pg_temp.act_as(pg_temp.fx('gm_a')); end $$;
select throws_ok(
  format('select public.assign_seats_ticket_type(%L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s}', pg_temp.fx('seat1'))::uuid[],
    pg_temp.fx('tt_paid')
  ),
  'P0001', 'FORBIDDEN',
  'GATE_MANAGER cannot assign ticket type'
);
reset role;

-- set_session_seat_status tests
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
insert into fx values ('seat3', (select seat_id from public.session_seats where session_id = pg_temp.fx('session_a') and status = 'AVAILABLE' offset 2 limit 1));
insert into fx values ('seat4', (select seat_id from public.session_seats where session_id = pg_temp.fx('session_a') and status = 'AVAILABLE' offset 3 limit 1));

select lives_ok(
  format('select public.set_session_seat_status(%L, %L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s}', pg_temp.fx('seat3'))::uuid[],
    'HOLD',
    'VIP reserved'
  ),
  'Owner can HOLD seats'
);
select is(
  (select status from public.session_seats where session_id = pg_temp.fx('session_a') and seat_id = pg_temp.fx('seat3')),
  'HELD',
  'Seat status changed to HELD'
);
select lives_ok(
  format('select public.set_session_seat_status(%L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s}', pg_temp.fx('seat3'))::uuid[],
    'RELEASE'
  ),
  'Owner can RELEASE held seats'
);
select is(
  (select status from public.session_seats where session_id = pg_temp.fx('session_a') and seat_id = pg_temp.fx('seat3')),
  'AVAILABLE',
  'Seat status changed back to AVAILABLE'
);
select throws_ok(
  format('select public.set_session_seat_status(%L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s}', pg_temp.fx('seat3'))::uuid[],
    'INVALID_ACTION'
  ),
  'P0001', 'VALIDATION_FAILED',
  'Invalid action rejected'
);
do $$ begin perform pg_temp.act_as(pg_temp.fx('gm_a')); end $$;
select throws_ok(
  format('select public.set_session_seat_status(%L, %L, %L)',
    pg_temp.fx('session_a'),
    format('{%s}', pg_temp.fx('seat4'))::uuid[],
    'BLOCK'
  ),
  'P0001', 'FORBIDDEN',
  'GATE_MANAGER cannot set seat status'
);
reset role;

-- request_bank_account_change tests
set local role authenticated;
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_a')); end $$;
select lives_ok(
  format('select public.request_bank_account_change(%L, %L, %L, %L)',
    pg_temp.fx('org_a'),
    'VCB',
    '0123456789',
    'NGUYEN VAN A'
  ),
  'Owner can request bank account change'
);
select throws_ok(
  format('select public.request_bank_account_change(%L, %L, %L, %L)',
    pg_temp.fx('org_a'),
    '',
    '0123456789',
    'NGUYEN VAN A'
  ),
  'P0001', 'VALIDATION_FAILED',
  'Empty bank code rejected'
);
select throws_ok(
  format('select public.request_bank_account_change(%L, %L, %L, %L)',
    pg_temp.fx('org_a'),
    'VCB',
    '123',
    'NGUYEN VAN A'
  ),
  'P0001', 'VALIDATION_FAILED',
  'Invalid account number rejected'
);
select throws_ok(
  format('select public.request_bank_account_change(%L, %L, %L, %L)',
    pg_temp.fx('org_a'),
    'VCB',
    '0123456789',
    ''
  ),
  'P0001', 'VALIDATION_FAILED',
  'Empty account holder rejected'
);
do $$ begin perform pg_temp.act_as(pg_temp.fx('owner_b')); end $$;
select throws_ok(
  format('select public.request_bank_account_change(%L, %L, %L, %L)',
    pg_temp.fx('org_a'),
    'VCB',
    '0123456789',
    'NGUYEN VAN A'
  ),
  'P0001', 'FORBIDDEN',
  'Other org owner cannot request bank account change'
);
reset role;

select * from finish();
rollback;