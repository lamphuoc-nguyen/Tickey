-- ============================================================================
-- Cổng soát vé của Venue: tạo, đổi tên, lưu trữ (ARCHIVED).
-- Trước đây cổng chỉ có trong seed.sql, Portal không có cách tạo.
-- p: {id?, venue_id (khi tạo), code, name, status?}
-- ============================================================================
create or replace function public.save_gate(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := public.try_uuid(p ->> 'id');
  v_before jsonb;
  v_row    public.gates%rowtype;
begin
  if v_id is null then
    v_row.venue_id := public.try_uuid(p ->> 'venue_id');
    select tenant_id into v_row.tenant_id from public.venues where id = v_row.venue_id;
    if v_row.tenant_id is null then
      perform public.app_error('NOT_FOUND', jsonb_build_object('field', 'venue_id'));
    end if;
  else
    select * into v_row from public.gates where id = v_id for update;
    if not found then
      perform public.app_error('NOT_FOUND');
    end if;
    v_before := to_jsonb(v_row);
  end if;
  perform public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER','GATE_MANAGER']);

  v_row.code   := upper(btrim(coalesce(p ->> 'code', v_row.code, '')));
  v_row.name   := btrim(coalesce(p ->> 'name', v_row.name, ''));
  v_row.status := coalesce(p ->> 'status', v_row.status, 'ACTIVE');
  if v_row.code = '' or v_row.name = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', case when v_row.code = '' then 'code' else 'name' end));
  end if;

  begin
    if v_id is null then
      insert into public.gates (tenant_id, venue_id, code, name, status)
      values (v_row.tenant_id, v_row.venue_id, v_row.code, v_row.name, v_row.status)
      returning id into v_id;
    else
      update public.gates set code = v_row.code, name = v_row.name, status = v_row.status where id = v_id;
    end if;
  exception
    when unique_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'code', 'reason', 'duplicate'));
    when check_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'status'));
  end;

  perform public.write_audit('GATE.SAVE', 'gate', v_id::text, v_row.tenant_id, v_before,
                             (select to_jsonb(g) from public.gates g where g.id = v_id));
  return v_id;
end;
$$;

grant execute on function public.save_gate(jsonb) to authenticated;
