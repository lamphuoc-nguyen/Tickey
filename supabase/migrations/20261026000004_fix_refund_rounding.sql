-- Migration: Fix refund rounding using largest remainder method
-- Date: 2026-10-26
-- Related bugs: C-07

-- Update create_refund to distribute refund amounts using largest remainder method
-- This ensures sum(refund_items.amount) = refunds.amount
create or replace function public.create_refund(p_booking_id uuid, p_amount bigint, p_reason text,
                                                p_source_type text, p_source_id uuid,
                                                p_requested_by uuid, p_ticket_ids jsonb default null,
                                                p_approval_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b          public.bookings%rowtype;
  v_payment    uuid;
  v_refundable bigint;
  v_ids        uuid[];
  v_base       bigint;
  v_refund     uuid;
  v_tickets    record;
  v_calculated bigint;
  v_remainder  bigint;
  v_ticket_count int;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_b.status not in ('PAID', 'CONFIRMED', 'PARTIALLY_REFUNDED', 'REFUND_PENDING') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_b.status));
  end if;
  select id into v_payment from public.payments
  where booking_id = p_booking_id and status = 'SUCCEEDED' order by paid_at limit 1;
  if v_payment is null then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'booking has no captured payment'));
  end if;

  select v_b.total_amount - coalesce(sum(amount), 0) into v_refundable
  from public.refunds
  where booking_id = p_booking_id and reason not in ('LATE_PAYMENT_NO_SEAT', 'DUPLICATE_PAYMENT');
  if coalesce(p_amount, 0) <= 0 or p_amount > v_refundable then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'amount', 'refundable', v_refundable));
  end if;

  if jsonb_typeof(p_ticket_ids) = 'array' and jsonb_array_length(p_ticket_ids) > 0 then
    select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p_ticket_ids) x;
    if exists (select 1 from unnest(v_ids) tid
               where not exists (select 1 from public.tickets t
                                 where t.id = tid and t.booking_id = p_booking_id
                                   and t.status in ('ISSUED', 'USED', 'NO_SHOW'))) then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'ticket_ids'));
    end if;
  end if;

  insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id,
                              requested_by, approval_id)
  values (v_b.tenant_id, p_booking_id, v_payment, p_amount, p_reason, p_source_type, p_source_id,
          p_requested_by, p_approval_id)
  returning id into v_refund;

  if v_ids is not null then
    -- Thu hoi ve ngay (dua vao revocation list), chia so tien theo gia tung ve
    -- Use largest remainder method to ensure sum = p_amount
    select sum(bi.unit_price) into v_base
    from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
    where t.id = any (v_ids);

    -- Validate: cannot refund tickets with zero total value (v_base = 0)
    if v_base = 0 then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'ticket_ids', 'reason', 'zero value tickets'));
    end if;

    v_ticket_count := cardinality(v_ids);
    
    -- First pass: calculate base amounts using integer division
    insert into public.refund_items (refund_id, ticket_id, amount)
    select v_refund, t.id,
           (bi.unit_price * p_amount) / v_base
    from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
    where t.id = any (v_ids);

    -- Calculate remainder and distribute using largest remainder method
    select sum(amount) into v_calculated from public.refund_items where refund_id = v_refund;
    v_remainder := p_amount - v_calculated;
    
    if v_remainder > 0 then
      -- Distribute based on proportional remainders (largest remainder method)
      with remainders as (
        select t.id,
               (bi.unit_price * p_amount) % v_base as remainder,
               row_number() over (order by (bi.unit_price * p_amount) % v_base desc, t.id) as rn
        from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
        where t.id = any (v_ids)
      )
      update public.refund_items ri
         set amount = ri.amount + 1
       from remainders r
      where ri.refund_id = v_refund
        and ri.ticket_id = r.id
        and r.rn <= v_remainder;
    end if;

    update public.tickets set status = 'REFUND_PENDING' where id = any (v_ids);
    update public.bookings set status = 'REFUND_PENDING'
     where id = p_booking_id and status in ('PAID', 'CONFIRMED', 'PARTIALLY_REFUNDED');
  end if;

  perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
  return v_refund;
end;
$$;

grant execute on function public.create_refund(uuid, bigint, text, text, uuid, uuid, jsonb, uuid) to service_role;