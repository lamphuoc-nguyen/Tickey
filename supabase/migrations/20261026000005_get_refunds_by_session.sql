-- Migration: Add RPC to get refunds by session for PROCESS_SESSION_REFUNDS worker
-- Date: 2026-10-26
-- Related bugs: C-02

-- Get refunds in REQUESTED status for a session (for PROCESS_SESSION_REFUNDS worker)
create or replace function public.get_refunds_by_session(p_session_id uuid)
returns table (refund_id uuid, idempotency_key uuid, amount bigint, gateway text, order_ref text, gateway_txn_id text, method text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.id, r.amount, p.gateway, p.order_ref, p.gateway_txn_id, p.method
  from public.refunds r
  join public.payments p on p.id = r.payment_id
  join public.bookings b on b.id = r.booking_id
  where b.session_id = p_session_id
    and r.status = 'REQUESTED'
  order by r.created_at;
$$;

grant execute on function public.get_refunds_by_session(uuid) to service_role;