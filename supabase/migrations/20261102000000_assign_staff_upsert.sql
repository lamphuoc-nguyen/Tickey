-- BUG-004: phân công lại cùng người, cùng Session, cùng cổng phải cập nhật dòng đang ACTIVE, không tạo dòng trùng.
-- 1. Thu hồi các dòng trùng đang có, giữ dòng mới nhất.
-- 2. Unique index một phần trên (session, user, cổng); gate_id null = mọi cổng, tính là một giá trị riêng.
-- 3. assign_staff dùng on conflict.

update public.staff_assignments a
   set status = 'REVOKED', revoked_by = a.assigned_by, revoked_at = now()
  from (select id,
               row_number() over (partition by session_id, user_id, gate_id
                                  order by created_at desc, id desc) as n
        from public.staff_assignments
        where status = 'ACTIVE') d
 where a.id = d.id and d.n > 1;

create unique index if not exists uq_staff_assignment_active
  on public.staff_assignments (session_id, user_id, coalesce(gate_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'ACTIVE';

create or replace function public.assign_staff(p_session_id uuid, p_user_id uuid, p_permissions text[],
                                               p_gate_id uuid default null,
                                               p_valid_from timestamptz default null,
                                               p_valid_until timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s     public.sessions%rowtype;
  v_actor uuid;
  v_roles text[];
  v_id    uuid;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_actor := public.assert_org_role(v_s.tenant_id, array['OWNER','GATE_MANAGER']);
  if v_s.status in ('ENDED', 'CANCELLED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_s.status));
  end if;

  select roles into v_roles from public.memberships
  where user_id = p_user_id and org_id = v_s.tenant_id and scope = 'ORG' and status = 'ACTIVE';
  if v_roles is null or not v_roles && array['SCANNER','POS','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'user is not staff of this org'));
  end if;
  if 'POS' = any (p_permissions) and not v_roles && array['POS','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'POS permission requires POS role'));
  end if;
  if (p_permissions && array['SCAN','MANUAL_CHECKIN']) and not v_roles && array['SCANNER','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'scan permission requires SCANNER role'));
  end if;
  if p_gate_id is not null and not exists (select 1 from public.gates where id = p_gate_id and venue_id = v_s.venue_id) then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_gate_id'));
  end if;

  begin
    insert into public.staff_assignments (tenant_id, session_id, user_id, gate_id, permissions, valid_from,
                                          valid_until, assigned_by)
    values (v_s.tenant_id, p_session_id, p_user_id, p_gate_id, p_permissions,
            coalesce(p_valid_from, v_s.doors_open_at - make_interval(hours => public.setting_int('gate.presync_hours', 2))),
            coalesce(p_valid_until, v_s.ends_at + interval '1 hour'),
            v_actor)
    on conflict (session_id, user_id, (coalesce(gate_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      where status = 'ACTIVE'
    do update set permissions = excluded.permissions, valid_from = excluded.valid_from,
                  valid_until = excluded.valid_until, assigned_by = excluded.assigned_by, updated_at = now()
    returning id into v_id;
  exception when check_violation then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_permissions/valid_*'));
  end;

  perform public.enqueue('NOTIFY_USER', 'staff_assignment', v_id, jsonb_build_object('type', 'STAFF_ASSIGNED'));
  perform public.write_audit('STAFF.ASSIGN', 'staff_assignment', v_id::text, v_s.tenant_id, null,
                             jsonb_build_object('user_id', p_user_id, 'permissions', p_permissions, 'gate_id', p_gate_id));
  return v_id;
end;
$$;

grant execute on function public.assign_staff(uuid, uuid, text[], uuid, timestamptz, timestamptz) to authenticated;
