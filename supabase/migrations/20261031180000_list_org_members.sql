-- ============================================================================
-- Danh sách thành viên tổ chức kèm email từ auth.users
-- ============================================================================
create or replace function public.list_org_members(p_org_id uuid)
returns table (
  id uuid,
  user_id uuid,
  roles text[],
  status text,
  created_at timestamptz,
  full_name text,
  phone text,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Chỉ Owner của Org hoặc Platform Admin mới được xem
  if not (public.has_org_role(p_org_id, array['OWNER']) or public.has_platform_role()) then
    perform public.app_error('FORBIDDEN');
  end if;

  return query
  select
    m.id,
    m.user_id,
    m.roles,
    m.status,
    m.created_at,
    p.full_name,
    p.phone,
    u.email::text
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id and m.scope = 'ORG'
  order by m.created_at;
end;
$$;

grant execute on function public.list_org_members to authenticated;
