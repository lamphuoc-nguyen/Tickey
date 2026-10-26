-- B-18: Validate duplicate recipient emails in issue_comp_tickets
-- Prevents creating multiple COMP bookings for the same email address in a single request.
-- The check is case-insensitive and trims whitespace. Null/empty emails are ignored for duplicate detection.

create or replace function public.issue_comp_tickets(
    p_session_id uuid,
    p_ticket_type_id uuid,
    p_recipients jsonb,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_tenant    uuid;
    v_res       jsonb := '[]'::jsonb;
    v_booking   jsonb;
    v_msg       text;
    v_detail    text;
    v_dup_emails text[];
    r record;
begin
    select tenant_id into v_tenant from public.sessions where id = p_session_id;
    if v_tenant is null then
        perform public.app_error('NOT_FOUND');
    end if;
    perform public.assert_org_role(v_tenant, array['OWNER','EVENT_MANAGER']);
    if jsonb_typeof(p_recipients) is distinct from 'array' or jsonb_array_length(p_recipients) = 0
       or jsonb_array_length(p_recipients) > 500 then
        perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_recipients'));
    end if;

    -- Check for duplicate emails (case-insensitive, trimmed) - B-18
    -- Ignore null/empty emails for duplicate detection
    select array_agg(email) into v_dup_emails
    from (
        select lower(trim(email)) as email, count(*)
        from jsonb_to_recordset(p_recipients) as x(email text)
        where nullif(trim(email), '') is not null
        group by lower(trim(email))
        having count(*) > 1
    ) d;
    if v_dup_emails is not null and cardinality(v_dup_emails) > 0 then
        perform public.app_error('VALIDATION_FAILED',
            jsonb_build_object('reason', 'duplicate recipient email', 'emails', to_jsonb(v_dup_emails)));
    end if;

    for r in
        select x.*, ord
        from rows from (jsonb_to_recordset(p_recipients)
                        as (email text, name text, phone text, seat_id uuid, zone_id uuid, quantity int))
             with ordinality as x(email, name, phone, seat_id, zone_id, quantity, ord)
        order by ord
    loop
        begin
            v_booking := public.create_booking(
                p_session_id,
                jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
                    'ticket_type_id', p_ticket_type_id, 'seat_id', r.seat_id, 'zone_id', r.zone_id,
                    'quantity', case when r.seat_id is null then coalesce(r.quantity, 1) end))),
                p_idempotency_key || ':' || r.ord,
                jsonb_build_object('booking_type', 'COMP', 'recipient_email', r.email, 'recipient_name', r.name,
                                   'recipient_phone', r.phone));
        exception when sqlstate 'P0001' then
            get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
            perform public.app_error(v_msg, coalesce(nullif(v_detail, '')::jsonb, '{}'::jsonb)
                                        || jsonb_build_object('recipient_index', r.ord - 1, 'email', r.email));
        end;
        v_res := v_res || jsonb_build_array(jsonb_build_object('email', r.email, 'booking_id', v_booking ->> 'id',
                                                               'status', v_booking ->> 'status'));
    end loop;
    return jsonb_build_object('bookings', v_res,
                              'remaining', (select quota - sold - locked from public.ticket_type_inventory
                                            where ticket_type_id = p_ticket_type_id));
end;
$$;

grant execute on function public.issue_comp_tickets(uuid, uuid, jsonb, text) to authenticated, service_role;