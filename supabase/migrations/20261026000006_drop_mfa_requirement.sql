-- Migration: Drop MFA requirement for P1 (C-10)
-- Created: 2026-10-26
-- Description: Remove MFA_REQUIRED checks from assert_org_role, assert_platform_role, set_active_workspace,
-- request_session_cancellation, and list_my_workspaces. Keep function signatures for backward compatibility.

-- assert_org_role: bỏ qua p_require_mfa, chỉ kiểm vai trò
create or replace function public.assert_org_role(p_org_id uuid, p_roles text[], p_require_mfa boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
begin
  if p_org_id is null or not public.has_org_role(p_org_id, p_roles) then
    raise log 'SECURITY.FORBIDDEN user=% org=% roles=%', v_user, p_org_id, p_roles;
    perform public.app_error('FORBIDDEN');
  end if;
  -- p_require_mfa parameter kept for backward compatibility but ignored (MFA dropped for P1)
  return v_user;
end;
$$;

-- assert_platform_role: bỏ qua p_require_mfa, chỉ kiểm vai trò
create or replace function public.assert_platform_role(p_roles text[], p_require_mfa boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
begin
  if not public.has_platform_role(p_roles) then
    raise log 'SECURITY.FORBIDDEN user=% platform_roles=%', v_user, p_roles;
    perform public.app_error('FORBIDDEN');
  end if;
  -- p_require_mfa parameter kept for backward compatibility but ignored (MFA dropped for P1)
  return v_user;
end;
$$;

-- list_my_workspaces: requires_mfa luôn false
create or replace function public.list_my_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_list jsonb;
begin
  select coalesce(jsonb_agg(w order by w ->> 'kind', w ->> 'org_name'), '[]'::jsonb)
    into v_list
  from (
    select jsonb_build_object(
             'kind', 'ORG', 'org_id', o.id, 'org_name', o.name, 'org_status', o.status,
             'roles', to_jsonb(array(select unnest(m.roles)
                                     intersect select unnest(array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER']))),
             'requires_mfa', false) as w
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.status = 'ACTIVE' and o.status <> 'TERMINATED'
      and m.roles && array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER']
    union all
    select jsonb_build_object(
             'kind', 'STAFF', 'org_id', o.id, 'org_name', o.name, 'org_status', o.status,
             'roles', to_jsonb(array(select unnest(m.roles)
                                     intersect select unnest(array['SCANNER','POS','GATE_MANAGER']))),
             'requires_mfa', false) as w
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.status = 'ACTIVE' and o.status <> 'TERMINATED'
      and m.roles && array['SCANNER','POS','GATE_MANAGER']
    union all
    select jsonb_build_object('kind', 'ADMIN', 'roles', to_jsonb(m.roles), 'requires_mfa', false) as w
    from public.memberships m
    where m.user_id = v_user and m.scope = 'PLATFORM' and m.status = 'ACTIVE'
  ) x;

  -- CUSTOMER luôn có, đứng đầu danh sách
  return jsonb_build_array(jsonb_build_object('kind', 'CUSTOMER', 'requires_mfa', false)) || v_list;
end;
$$;

-- set_active_workspace: bỏ nhánh MFA_REQUIRED cho ORG OWNER/FINANCE và ADMIN
create or replace function public.set_active_workspace(p_kind text, p_org_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_roles text[];
begin
  if p_kind = 'CUSTOMER' then
    p_org_id := null;
  elsif p_kind in ('ORG', 'STAFF') then
    select m.roles into v_roles
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.org_id = p_org_id
      and m.status = 'ACTIVE' and o.status <> 'TERMINATED';
    if v_roles is null
       or (p_kind = 'ORG' and not v_roles && array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER'])
       or (p_kind = 'STAFF' and not v_roles && array['SCANNER','POS','GATE_MANAGER']) then
      perform public.app_error('FORBIDDEN');
    end if;
  elsif p_kind = 'ADMIN' then
    p_org_id := null;
    select roles into v_roles from public.memberships
    where user_id = v_user and scope = 'PLATFORM' and status = 'ACTIVE';
    if v_roles is null then
      perform public.app_error('FORBIDDEN');
    end if;
  else
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_kind'));
  end if;

  insert into public.user_active_workspace (user_id, kind, org_id, updated_at)
  values (v_user, p_kind, p_org_id, now())
  on conflict (user_id) do update set kind = excluded.kind, org_id = excluded.org_id, updated_at = now();

  return jsonb_build_object('kind', p_kind, 'org_id', p_org_id, 'roles', to_jsonb(v_roles),
                            'refresh_session_required', true);
end;
$$;

-- request_session_cancellation: bỏ nhánh is_aal2() cho PLATFORM role
create or replace function public.request_session_cancellation(p_session_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_authenticated();
  v_s        public.sessions%rowtype;
  v_origin   text;
  v_req      uuid;
  v_approval uuid;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  if public.has_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN']) then
    v_origin := 'PLATFORM';
  else
    perform public.assert_org_role(v_s.tenant_id, array['OWNER'], true);
    v_origin := 'ORG';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_reason'));
  end if;
  if v_s.status in ('ENDED', 'CANCELLED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_s.status));
  end if;
  if exists (select 1 from public.session_change_requests
             where session_id = p_session_id and status in ('REQUESTED', 'APPROVED')) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'a request is already open'));
  end if;

  -- Dừng bán ngay, trước khi Admin duyệt
  update public.sessions set sales_paused = true, sales_paused_reason = 'CANCELLATION_REQUESTED'
   where id = p_session_id;

  insert into public.session_change_requests (tenant_id, session_id, change_type, origin, reason, requested_by)
  values (v_s.tenant_id, p_session_id, 'CANCEL', v_origin, trim(p_reason), v_user)
  returning id into v_req;

  insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
  values ('SESSION_CANCELLATION', v_req, v_s.tenant_id, v_user,
          jsonb_build_object('session_id', p_session_id, 'reason', p_reason))
  returning id into v_approval;
  update public.session_change_requests set approval_id = v_approval where id = v_req;

  -- Admin chủ động hủy: phiếu của người tạo tính là phiếu thứ nhất
  if v_origin = 'PLATFORM' then
    insert into public.approval_votes (approval_id, voter_id, decision, note)
    values (v_approval, v_user, 'APPROVE', 'initiator');
  end if;

  perform public.enqueue('ADMIN_ALERT', 'session_change_request', v_req,
                         jsonb_build_object('type', 'SESSION_CANCELLATION_REQUESTED'));
  perform public.write_audit('SESSION.CANCEL_REQUEST', 'session', p_session_id::text, v_s.tenant_id,
                             null, jsonb_build_object('reason', p_reason, 'origin', v_origin));
  return v_req;
end;
$$;

-- Grant execute permissions (same as original)
grant execute on function public.assert_org_role(uuid, text[], boolean) to authenticated, service_role;
grant execute on function public.assert_platform_role(text[], boolean) to authenticated, service_role;
grant execute on function public.list_my_workspaces() to authenticated, service_role;
grant execute on function public.set_active_workspace(text, uuid) to authenticated, service_role;
grant execute on function public.request_session_cancellation(uuid, text) to authenticated, service_role;