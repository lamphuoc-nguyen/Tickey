-- Migration: IPN after AMOUNT_MISMATCH creates new payment + ADMIN_ALERT
-- Date: 2026-10-26
-- Related bugs: C-09

-- Update apply_payment_success to handle IPN after AMOUNT_MISMATCH
-- Creates a new payment row with order_ref = <original_ref>-DUP-<gateway_txn_id>
-- Preserves original payment's gateway_txn_id
-- Enqueues ADMIN_ALERT with PAYMENT_AFTER_AMOUNT_MISMATCH
create or replace function public.apply_payment_success(p_order_ref text, p_gateway_txn_id text, p_amount bigint,
                                                        p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay    public.payments%rowtype;
  v_b      public.bookings%rowtype;
  v_ok     boolean := false;
  v_fee    bigint;
  v_refund uuid;
  v_dup_pay public.payments%rowtype;
begin
  select * into v_pay from public.payments where order_ref = p_order_ref for update;
  if not found then
    perform public.app_error('NOT_FOUND', jsonb_build_object('order_ref', p_order_ref));
  end if;

  -- Load booking early so we can use v_b.session_id in ledger transactions
  select * into v_b from public.bookings where id = v_pay.booking_id for update;
  if not found then
    perform public.app_error('NOT_FOUND', jsonb_build_object('booking_id', v_pay.booking_id));
  end if;

  -- Check for duplicate gateway_txn_id globally FIRST (before any status check)
  -- This prevents retry IPN of the same gateway_txn_id from creating multiple refunds
  if exists (select 1 from public.payments where gateway_txn_id = p_gateway_txn_id) then
    -- Find the existing payment with this gateway_txn_id to return proper result
    select * into v_dup_pay from public.payments where gateway_txn_id = p_gateway_txn_id;
    return jsonb_build_object('result', 'DUPLICATE', 'booking_id', v_dup_pay.booking_id, 'payment_id', v_dup_pay.id);
  end if;

  -- IPN trùng (E-BKG-07): trả thành công cho cổng và dừng
  if v_pay.status = 'SUCCEEDED' then
    -- Second transaction with different gateway_txn_id: create a NEW payment record for the second txn
    -- Use a unique order_ref: original_order_ref || '-DUP-' || gateway_txn_id
    insert into public.payments (booking_id, org_id, gateway, order_ref, amount, status, gateway_txn_id, ipn_payload, paid_at)
    values (v_pay.booking_id, v_pay.org_id, v_pay.gateway,
            v_pay.order_ref || '-DUP-' || p_gateway_txn_id,
            p_amount, 'SUCCEEDED', p_gateway_txn_id, p_payload, now())
    returning * into v_dup_pay;

    -- Create DUPLICATE_PAYMENT refund pointing to the NEW payment (v_dup_pay)
    insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id)
    values (v_pay.org_id, v_pay.booking_id, v_dup_pay.id, p_amount, 'DUPLICATE_PAYMENT', 'PAYMENT', v_dup_pay.id)
    returning id into v_refund;
    perform public.enqueue('ADMIN_ALERT', 'payment', v_pay.id,
      jsonb_build_object('type', 'SECOND_TXN_SAME_ORDER', 'original_payment_id', v_pay.id, 'duplicate_payment_id', v_dup_pay.id, 'gateway_txn_id', p_gateway_txn_id));
    perform public.post_ledger_transaction('PAYMENT_CAPTURED', v_pay.org_id, v_b.session_id, 'PAYMENT', v_dup_pay.id,
      jsonb_build_array(
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'DEBIT', 'amount', p_amount),
        jsonb_build_object('account_code', 'PLATFORM:REFUND_PAYABLE', 'direction', 'CREDIT', 'amount', p_amount)),
      'duplicate payment');
    perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
    return jsonb_build_object('result', 'DUPLICATE_PAYMENT_REFUND', 'booking_id', v_pay.booking_id, 'refund_id', v_refund, 'duplicate_payment_id', v_dup_pay.id);
  end if;

  -- Sai số tiền (E-BKG-08): từ chối, cảnh báo, gắn cờ Booking
  if p_amount <> v_pay.amount then
    update public.payments
       set status = 'AMOUNT_MISMATCH', gateway_txn_id = p_gateway_txn_id, ipn_payload = p_payload,
           failure_reason = 'expected ' || v_pay.amount || ' got ' || p_amount
     where id = v_pay.id;
    update public.bookings set flagged = true, flag_reason = 'IPN_AMOUNT_MISMATCH' where id = v_pay.booking_id;
    perform public.enqueue('ADMIN_ALERT', 'payment', v_pay.id, jsonb_build_object('type', 'AMOUNT_MISMATCH'));
    return jsonb_build_object('result', 'AMOUNT_MISMATCH', 'booking_id', v_pay.booking_id);
  end if;

  -- If payment was in AMOUNT_MISMATCH state and correct amount comes in:
  -- Create a NEW payment row (preserving original gateway_txn_id), enqueue ADMIN_ALERT
  if v_pay.status = 'AMOUNT_MISMATCH' then
    -- Create new payment for the corrected transaction
    insert into public.payments (booking_id, org_id, gateway, order_ref, amount, status, gateway_txn_id, ipn_payload, paid_at)
    values (v_pay.booking_id, v_pay.org_id, v_pay.gateway,
            v_pay.order_ref || '-DUP-' || p_gateway_txn_id,
            p_amount, 'SUCCEEDED', p_gateway_txn_id, p_payload, now())
    returning * into v_dup_pay;

    -- Enqueue ADMIN_ALERT for payment after amount mismatch
    perform public.enqueue('ADMIN_ALERT', 'payment', v_pay.id,
      jsonb_build_object('type', 'PAYMENT_AFTER_AMOUNT_MISMATCH', 'original_payment_id', v_pay.id, 'corrected_payment_id', v_dup_pay.id, 'gateway_txn_id', p_gateway_txn_id));

    -- Ledger for corrected payment
    -- NOTE: This credits PLATFORM:REFUND_PAYABLE but does NOT create a refunds row or enqueue PROCESS_REFUND.
    -- This is intentional: the function returns NEEDS_REVIEW, so the corrected payment is recorded
    -- (money really arrived at gateway), but the refund is pending admin decision.
    -- Admin will manually create the refund via create_refund (service_role) on the booking if/when appropriate;
    -- admin_refund_action then operates on that refund row. This differs from DUPLICATE_PAYMENT /
    -- LATE_PAYMENT_NO_SEAT / duplicate session branches where both the ledger entry AND the refunds
    -- row + PROCESS_REFUND are created.
    perform public.post_ledger_transaction('PAYMENT_CAPTURED', v_pay.org_id, v_b.session_id, 'PAYMENT', v_dup_pay.id,
      jsonb_build_array(
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'DEBIT', 'amount', p_amount),
        jsonb_build_object('account_code', 'PLATFORM:REFUND_PAYABLE', 'direction', 'CREDIT', 'amount', p_amount)),
      'corrected payment after amount mismatch');

    -- Keep original payment in AMOUNT_MISMATCH (do NOT change its gateway_txn_id)
    -- Return NEEDS_REVIEW for the original payment reference, but indicate corrected payment was created
    return jsonb_build_object('result', 'NEEDS_REVIEW', 'booking_id', v_pay.booking_id, 'reason', 'amount_mismatch_corrected', 'corrected_payment_id', v_dup_pay.id);
  end if;

  update public.payments
     set status = 'SUCCEEDED', gateway_txn_id = p_gateway_txn_id, ipn_payload = p_payload,
         method = p_payload ->> 'method', paid_at = now()
   where id = v_pay.id;

  -- Booking đã được thanh toán bằng một phiên khác: hoàn khoản tiền thừa
  if v_b.status not in ('PENDING', 'PAYMENT_PENDING', 'EXPIRED', 'CANCELLED') then
    insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id)
    values (v_b.tenant_id, v_b.id, v_pay.id, p_amount, 'DUPLICATE_PAYMENT', 'PAYMENT', v_pay.id)
    returning id into v_refund;
    perform public.post_ledger_transaction('PAYMENT_CAPTURED', v_b.tenant_id, v_b.session_id, 'PAYMENT', v_pay.id,
      jsonb_build_array(
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'DEBIT', 'amount', p_amount),
        jsonb_build_object('account_code', 'PLATFORM:REFUND_PAYABLE', 'direction', 'CREDIT', 'amount', p_amount)),
      'duplicate payment');
    perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
    return jsonb_build_object('result', 'DUPLICATE_PAYMENT_REFUND', 'booking_id', v_b.id, 'refund_id', v_refund);
  end if;

  -- Booking đã hủy: không khóa lại chỗ, hoàn 100%. Còn lại: khóa lại đúng chỗ cũ nếu còn.
  v_ok := v_b.status <> 'CANCELLED' and public.secure_booking_inventory(v_b.id);

  if v_ok then
    perform public.mark_booking_paid(v_b.id);
    v_fee := public.compute_platform_fee(v_b.id);
    perform public.post_ledger_transaction('PAYMENT_CAPTURED', v_b.tenant_id, v_b.session_id, 'PAYMENT', v_pay.id,
      jsonb_build_array(
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'DEBIT', 'amount', p_amount),
        jsonb_build_object('account_code', public.org_payable_account(v_b.tenant_id), 'direction', 'CREDIT',
                           'amount', p_amount - v_fee),
        jsonb_build_object('account_code', 'PLATFORM:FEE_REVENUE', 'direction', 'CREDIT', 'amount', v_fee)),
      'booking ' || v_b.code);
    return jsonb_build_object('result', 'PAID', 'booking_id', v_b.id);
  end if;

  -- Trả muộn mà không còn chỗ, hoặc Session/Booking đã hủy: hoàn 100% (E-BKG-06)
  if v_b.status in ('PENDING', 'PAYMENT_PENDING') then
    perform public.release_booking(v_b.id, 'REFUND_PENDING');
  else
    update public.bookings set status = 'REFUND_PENDING' where id = v_b.id and status in ('EXPIRED', 'CANCELLED');
  end if;
  insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id)
  values (v_b.tenant_id, v_b.id, v_pay.id, p_amount, 'LATE_PAYMENT_NO_SEAT', 'PAYMENT', v_pay.id)
  returning id into v_refund;
  perform public.post_ledger_transaction('PAYMENT_CAPTURED', v_b.tenant_id, v_b.session_id, 'PAYMENT', v_pay.id,
    jsonb_build_array(
      jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'DEBIT', 'amount', p_amount),
      jsonb_build_object('account_code', 'PLATFORM:REFUND_PAYABLE', 'direction', 'CREDIT', 'amount', p_amount)),
    'late payment, no seat');
  perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
  perform public.enqueue('NOTIFY_USER', 'booking', v_b.id, jsonb_build_object('type', 'LATE_PAYMENT_REFUNDED'));
  return jsonb_build_object('result', 'REFUND_PENDING', 'booking_id', v_b.id, 'refund_id', v_refund);
end;
$$;

grant execute on function public.apply_payment_success(text, text, bigint, jsonb) to service_role;

