-- ============================================================================
-- Xóa thành viên khỏi tổ chức và thu hồi các ca trực liên quan (OWNER only).
-- ============================================================================
create or replace function public.delete_org_member(p_org_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := public.assert_org_role(p_org_id, array['OWNER'], false);
  v_roles  text[];
begin
  -- Kiểm tra xem người bị xóa có trong Org không
  select roles into v_roles from public.memberships
  where org_id = p_org_id and user_id = p_user_id and scope = 'ORG';

  if v_roles is null then
    perform public.app_error('NOT_FOUND', jsonb_build_object('message', 'Không tìm thấy thành viên trong tổ chức.'));
  end if;

  -- Kiểm tra không cho phép xóa nếu là OWNER duy nhất còn lại
  if 'OWNER' = any (v_roles) and not exists (
    select 1 from public.memberships
    where org_id = p_org_id and user_id <> p_user_id and scope = 'ORG' and status = 'ACTIVE' and 'OWNER' = any (roles)
  ) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'Tổ chức phải giữ lại ít nhất 1 Chủ sở hữu (OWNER).'));
  end if;

  -- Thu hồi tất cả các ca trực đang ACTIVE của nhân sự này
  update public.staff_assignments
  set status = 'REVOKED', revoked_by = v_actor, revoked_at = now()
  where tenant_id = p_org_id and user_id = p_user_id and status = 'ACTIVE';

  -- Xóa bản ghi membership
  delete from public.memberships
  where org_id = p_org_id and user_id = p_user_id and scope = 'ORG';

  perform public.write_audit('ORG.MEMBER_DELETE', 'membership', p_user_id::text, p_org_id,
                             jsonb_build_object('roles', v_roles), null);

  return jsonb_build_object('user_id', p_user_id, 'deleted', true);
end;
$$;

grant execute on function public.delete_org_member to authenticated;
