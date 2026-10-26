-- Migration: Fix PAYMENT_PENDING stuck state - allow repayment and add lock expiry check
-- Date: 2026-10-26
-- Related bugs: C-01, B-09

-- 1. Update begin_payment to allow repayment when payment FAILED or INITIATED expired
--    Also expire old INITIATED payment and create new one
create or replace function public.begin_payment(p_booking_id uuid, p_gateway text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.assert_authenticated();
  v_b          public.bookings%rowtype;
  v_s          public.sessions%rowtype;
  v_org_status text;
  v_pay        public.payments%rowtype;
  v_deadline   timestamptz;
  v_lock       timestamptz;
  v_minutes    int := public.setting_int('payment.session_minutes', 15);
  v_payment_count int;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found or (v_b.created_by <> v_user and v_b.user_id is distinct from v_user) then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_b.total_amount = 0 then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'free booking needs no payment'));
  end if;

  if v_b.status = 'PAYMENT_PENDING' then
    select * into v_pay from public.payments
    where booking_id = p_booking_id and status = 'INITIATED' order by initiated_at desc limit 1;
    if found and v_pay.initiated_at + make_interval(mins => v_minutes) > now() then
      return jsonb_build_object('booking', public.booking_to_json(p_booking_id),
        'payment', jsonb_build_object('order_ref', v_pay.order_ref, 'amount', v_pay.amount,
                                      'gateway', v_pay.gateway,
                                      'expires_at', v_pay.initiated_at + make_interval(mins => v_minutes)));
    end if;
    -- Old INITIATED payment expired: allow repayment
    -- Mark old INITIATED payments as EXPIRED
    update public.payments
       set status = 'EXPIRED'
     where booking_id = p_booking_id
       and status = 'INITIATED';
  end if;

  if v_b.status <> 'PENDING' and v_b.status <> 'PAYMENT_PENDING' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_b.status));
  end if;
  if v_b.lock_expires_at <= now() then
    perform public.app_error('BOOKING_EXPIRED');
  end if;

  -- Chặn thanh toán khi Session dừng bán, bị hủy hoặc Org bị đình chỉ (E-BKG-10)
  select * into v_s from public.sessions where id = v_b.session_id;
  select status into v_org_status from public.organizations where id = v_b.tenant_id;
  if v_s.sales_paused or v_org_status <> 'APPROVED'
     or v_s.status <> all (case when v_b.booking_type = 'POS' then array['ON_SALE','SALES_CLOSED','ONGOING']
                                else array['ON_SALE'] end) then
    perform public.app_error('SESSION_NOT_ON_SALE', jsonb_build_object('status', v_s.status,
                             'sales_paused', v_s.sales_paused, 'org_status', v_org_status));
  end if;

  v_deadline := v_b.created_at + make_interval(mins => public.setting_int('payment.max_hold_minutes', 30));
  -- Lock dài hơn phiên cổng 5 phút: phiên cổng luôn hết hạn trước lock
  v_lock := least(now() + make_interval(mins => v_minutes + 5), v_deadline);
  if v_lock <= now() + make_interval(mins => v_minutes) then
    perform public.app_error('BOOKING_EXPIRED', jsonb_build_object('reason', 'T_MAX reached'));
  end if;

  -- Count existing payments to generate order_ref suffix
  select count(*) into v_payment_count from public.payments where booking_id = p_booking_id;

  update public.bookings
     set status = 'PAYMENT_PENDING', lock_expires_at = v_lock, payment_deadline_at = v_deadline
   where id = p_booking_id and status in ('PENDING', 'PAYMENT_PENDING');
  update public.session_seats set lock_expires_at = v_lock, updated_at = now()
   where booking_id = p_booking_id and status = 'LOCKED';

  insert into public.payments (booking_id, org_id, gateway, order_ref, amount)
  values (p_booking_id, v_b.tenant_id, p_gateway,
          v_b.code || '-' || (v_payment_count + 1),
          v_b.total_amount)
  returning * into v_pay;

  return jsonb_build_object('booking', public.booking_to_json(p_booking_id),
    'payment', jsonb_build_object('order_ref', v_pay.order_ref, 'amount', v_pay.amount, 'gateway', v_pay.gateway,
                                  'expires_at', now() + make_interval(mins => v_minutes)));
end;
$$;

-- 2. Update list_payment_pending_to_query to add lock_expires_at < now() condition
--    This prevents querying gateway during the repayment window
create or replace function public.list_payment_pending_to_query(p_limit int default 100)
returns table (booking_id uuid, order_ref text, gateway text, amount bigint, initiated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, p.order_ref, p.gateway, p.amount, p.initiated_at
  from public.bookings b
  join lateral (select * from public.payments p
                where p.booking_id = b.id order by p.initiated_at desc limit 1) p on true
  where b.status = 'PAYMENT_PENDING'
    and p.initiated_at + make_interval(mins => public.setting_int('payment.session_minutes', 15)) < now()
    and b.lock_expires_at < now()
  order by p.initiated_at
  limit p_limit;
$$;

-- Grant execute to service_role (for Workers/API)
grant execute on function public.begin_payment(uuid, text) to authenticated;
grant execute on function public.list_payment_pending_to_query(int) to service_role;
grant execute on function public.expire_unpaid_booking(uuid) to service_role;

-- 3. Add get_payment_by_order_ref for idempotency check in test payment endpoint
create or replace function public.get_payment_by_order_ref(p_order_ref text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', id,
    'booking_id', booking_id,
    'order_ref', order_ref,
    'amount', amount,
    'gateway', gateway,
    'status', status,
    'gateway_txn_id', gateway_txn_id,
    'initiated_at', initiated_at,
    'paid_at', paid_at,
    'failure_reason', failure_reason
  )
  from public.payments
  where order_ref = p_order_ref;
$$;

grant execute on function public.get_payment_by_order_ref(text) to service_role;