-- Migration: Fix save_ticket_type seat pricing tier order logic
-- Date: 2026-10-26
-- Related bugs: C-05

-- Update save_ticket_type to:
-- 1. Only auto-assign seats for PAID and FREE PUBLIC types (not COMP)
-- 2. Not overwrite existing seat assignments (only assign to seats with ticket_type_id IS NULL)
-- 3. Prioritize PAID over FREE PUBLIC: if PAID exists in zone, FREE PUBLIC does not auto-assign
create or replace function public.save_ticket_type(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := public.try_uuid(p ->> 'id');
  v_row      public.ticket_types%rowtype;
  v_old      public.ticket_types%rowtype;
  v_session  public.sessions%rowtype;
  v_zone_ids uuid[];
  v_used     int := 0;
  v_constraint text;
  v_has_paid boolean := false;
  v_is_new   boolean := false;
begin
  v_is_new := (v_id is null);
  if v_id is null then
    select * into v_session from public.sessions where id = public.try_uuid(p ->> 'session_id');
    if not found then
      perform public.app_error('NOT_FOUND', jsonb_build_object('field', 'session_id'));
    end if;
    perform public.assert_org_role(v_session.tenant_id, array['OWNER','EVENT_MANAGER']);
    v_row.tenant_id := v_session.tenant_id;
    v_row.session_id := v_session.id;
    v_row.max_per_order := 10;
    v_row.refund_policy := 'ONLY_IF_CANCELLED';
    v_row.visibility := 'PUBLIC';
    v_row.status := 'ACTIVE';
    v_row.sort_order := 0;
    v_row.price_amount := 0;
  else
    select * into v_row from public.ticket_types where id = v_id for update;
    if not found then
      perform public.app_error('NOT_FOUND');
    end if;
    select * into v_session from public.sessions where id = v_row.session_id;
    perform public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER']);
    select locked + sold into v_used from public.ticket_type_inventory where ticket_type_id = v_id;
  end if;
  v_old := v_row;

  if v_session.status not in ('SCHEDULED', 'ON_SALE') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('session_status', v_session.status));
  end if;

  v_row.name                  := coalesce(p ->> 'name', v_row.name);
  v_row.description           := coalesce(p ->> 'description', v_row.description);
  v_row.kind                  := coalesce(p ->> 'kind', v_row.kind);
  v_row.price_amount          := coalesce((p ->> 'price_amount')::bigint, v_row.price_amount);
  v_row.quota                 := coalesce((p ->> 'quota')::int, v_row.quota);
  v_row.max_per_order         := coalesce((p ->> 'max_per_order')::int, v_row.max_per_order);
  v_row.sale_start_at         := coalesce((p ->> 'sale_start_at')::timestamptz, v_row.sale_start_at);
  v_row.sale_end_at           := coalesce((p ->> 'sale_end_at')::timestamptz, v_row.sale_end_at);
  v_row.refund_policy         := coalesce(p ->> 'refund_policy', v_row.refund_policy);
  v_row.refund_deadline_hours := coalesce((p ->> 'refund_deadline_hours')::int, v_row.refund_deadline_hours);
  v_row.visibility            := case when v_row.kind = 'COMP' then 'HIDDEN'
                                        else coalesce(p ->> 'visibility', v_row.visibility) end;
  v_row.status                := coalesce(p ->> 'status', v_row.status);
  v_row.sort_order            := coalesce((p ->> 'sort_order')::int, v_row.sort_order);

  -- Đã có người giữ/mua thì không đổi loại vé và giá (giá đã chụp vào Booking)
  if v_used > 0 and (v_row.kind is distinct from v_old.kind or v_row.price_amount is distinct from v_old.price_amount) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'ticket type already has bookings',
                                                                  'locked_or_sold', v_used));
  end if;

  if p ? 'zone_ids' then
    select array_agg(distinct x::uuid) into v_zone_ids from jsonb_array_elements_text(p -> 'zone_ids') x;
    if v_zone_ids is null or exists (
         select 1 from unnest(v_zone_ids) zid
         where not exists (select 1 from public.zones z
                           where z.id = zid and z.layout_version_id = v_session.layout_version_id)) then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'zone_ids'));
    end if;
    if v_used > 0 then
      perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'cannot change zones after bookings'));
    end if;
  elsif v_id is null then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'zone_ids', 'reason', 'required'));
  end if;

  begin
    if v_id is null then
      insert into public.ticket_types (tenant_id, session_id, name, description, kind, price_amount, quota,
                                       max_per_order, sale_start_at, sale_end_at, refund_policy,
                                       refund_deadline_hours, visibility, status, sort_order)
      values (v_row.tenant_id, v_row.session_id, v_row.name, v_row.description, v_row.kind, v_row.price_amount,
              v_row.quota, v_row.max_per_order, v_row.sale_start_at, v_row.sale_end_at, v_row.refund_policy,
              v_row.refund_deadline_hours, v_row.visibility, v_row.status, v_row.sort_order)
      returning id into v_id;
    else
      update public.ticket_types set
        name = v_row.name, description = v_row.description, kind = v_row.kind, price_amount = v_row.price_amount,
        quota = v_row.quota, max_per_order = v_row.max_per_order, sale_start_at = v_row.sale_start_at,
        sale_end_at = v_row.sale_end_at, refund_policy = v_row.refund_policy,
        refund_deadline_hours = v_row.refund_deadline_hours, visibility = v_row.visibility,
        status = v_row.status, sort_order = v_row.sort_order
      where id = v_id;
    end if;
  exception when not_null_violation or check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform public.raise_constraint_error(sqlstate, sqlerrm, v_constraint);
  end;

  if v_zone_ids is not null then
    delete from public.ticket_type_zones where ticket_type_id = v_id;
    insert into public.ticket_type_zones (ticket_type_id, zone_id, tenant_id)
    select v_id, zid, v_row.tenant_id from unnest(v_zone_ids) zid;

    -- Bỏ gán ở ghế không còn thuộc Zone
    update public.session_seats
       set ticket_type_id = null, updated_at = now()
     where session_id = v_row.session_id and ticket_type_id = v_id
       and zone_id <> all (v_zone_ids) and status in ('AVAILABLE', 'BLOCKED', 'HELD');
     
    -- Chỉ tự gán hạng cho ghế chưa có hạng (ticket_type_id IS NULL) trong Zone mới
    -- Chỉ áp dụng cho hạng PAID và FREE PUBLIC (không phải COMP/HIDDEN)
    -- COMP và các hạng visibility=HIDDEN không tự gán ghế, dùng assign_seats_ticket_type thay thế
    -- Ưu tiên PAID: nếu zone đã có PAID, FREE PUBLIC không tự gán ghế
    if v_row.kind in ('PAID', 'FREE') and v_row.visibility = 'PUBLIC' then
      -- Check if zone already has a PAID ticket type assigned to seats
      if v_row.kind = 'FREE' then
        select exists (
          select 1 from public.session_seats ss
          join public.ticket_types tt on tt.id = ss.ticket_type_id
          where ss.session_id = v_row.session_id
            and ss.zone_id = any (v_zone_ids)
            and ss.ticket_type_id is not null
            and tt.kind = 'PAID'
            and tt.visibility = 'PUBLIC'
        ) into v_has_paid;
      end if;
      
      if not (v_row.kind = 'FREE' and v_has_paid) then
        -- If creating PAID (only on INSERT), first reassign seats from FREE PUBLIC in the same zone
        if v_is_new and v_row.kind = 'PAID' then
          update public.session_seats
             set ticket_type_id = v_id, updated_at = now()
           where session_id = v_row.session_id
             and zone_id = any (v_zone_ids)
             and status in ('AVAILABLE', 'BLOCKED', 'HELD')
             and ticket_type_id in (
               select id from public.ticket_types
               where kind = 'FREE' and visibility = 'PUBLIC'
             );
        end if;
        
        -- Then assign remaining unassigned seats
        update public.session_seats
           set ticket_type_id = v_id, updated_at = now()
         where session_id = v_row.session_id and ticket_type_id is null
           and zone_id = any (v_zone_ids) and status in ('AVAILABLE', 'BLOCKED', 'HELD');
      end if;
    end if;
  end if;
  return v_id;
end;
$$;

grant execute on function public.save_ticket_type(jsonb) to authenticated;