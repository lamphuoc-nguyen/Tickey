-- ============================================================================
-- pgTAP: RPC thêm cho Portal (migration 20261021*).
--   save_gate: tạo / đổi tên / lưu trữ cổng của Venue, chỉ OWNER / EVENT_MANAGER / GATE_MANAGER cùng Org
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create temp table fx (k text primary key, v uuid);
grant all on fx to authenticated;
create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;
create function pg_temp.fx(p_k text) returns uuid language sql stable as $$ select v from fx where k = p_k $$;
grant execute on function pg_temp.act_as(uuid), pg_temp.fx(text) to authenticated;

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid, 'pr' || n || '@test.vn' from generate_series(1, 4) n;
insert into fx values ('owner_a', '00000000-0000-0000-0000-000000000001'), ('owner_b', '00000000-0000-0000-0000-000000000002'),
                      ('scanner_a', '00000000-0000-0000-0000-000000000003'), ('gm_a', '00000000-0000-0000-0000-000000000004');

do $$
begin
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  insert into fx values ('org_a', public.create_organization('Org PR A', 'pr-org-a'));
  perform pg_temp.act_as(pg_temp.fx('owner_b'));
  insert into fx values ('org_b', public.create_organization('Org PR B', 'pr-org-b'));
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  insert into fx values ('venue_a', public.save_venue(jsonb_build_object('tenant_id', pg_temp.fx('org_a'), 'name', 'Venue PR',
    'address_line', '1 Le Loi', 'city', 'TP.HCM', 'capacity', 100)));
end $$;
insert into public.memberships (user_id, scope, org_id, roles) values
  (pg_temp.fx('scanner_a'), 'ORG', pg_temp.fx('org_a'), array['SCANNER']),
  (pg_temp.fx('gm_a'), 'ORG', pg_temp.fx('org_a'), array['GATE_MANAGER']);

set local role authenticated;
do $$ begin
  perform pg_temp.act_as(pg_temp.fx('owner_a'));
  insert into fx values ('gate', public.save_gate(jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', ' g1 ', 'name', 'Cổng chính')));
end $$;
reset role;
select is((select code || '|' || name || '|' || status from public.gates where id = pg_temp.fx('gate')), 'G1|Cổng chính|ACTIVE',
          'Owner tạo cổng; mã viết hoa, bỏ khoảng trắng');
set local role authenticated;
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'G1', 'name', 'Trùng')),
                 'P0001', 'VALIDATION_FAILED', 'Mã cổng trùng trong cùng Venue bị từ chối');
select throws_ok(format('select public.save_gate(%L)', jsonb_build_object('venue_id', pg_temp.fx('venue_a'), 'code', 'G2', 'name', ' ')),
                 'P0001', 'VALIDATION_FAILED', 'Tên cổng rỗng bị từ chối');
do $$ begin perform pg_temp.act_as(pg_temp.fx('gm_a')); end $$;
select lives_ok(format('select public.save_gate(%L)', jsonb_build_object('id', pg_temp.fx('gate'), 'name', 'Cổng chính A')),
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
select is((select name || '|' || status from public.gates where id = pg_temp.fx('gate')), 'Cổng chính A|ARCHIVED',
          'Cổng giữ thay đổi hợp lệ, không bị Org B sửa');
select is((select count(*)::int from public.audit_logs where target_type = 'gate' and target_id = pg_temp.fx('gate')::text), 3,
          'Mỗi lần lưu cổng ghi audit');

select * from finish();
rollback;
