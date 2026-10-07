-- ============================================================================
-- pgTAP: quy tắc cấu trúc (tài liệu mục 7.1, 10, 20.1, 27.2). Chạy: supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'Mọi bảng trong public đều bật RLS');

select is_empty(
  $$ select c.table_name from information_schema.columns c
     join pg_tables t on t.schemaname = 'public' and t.tablename = c.table_name
     where c.table_schema = 'public' and c.column_name = 'tenant_id'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.table_name) $$,
  'Mọi bảng có tenant_id đều có policy đọc theo tenant');

-- Client chỉ đọc: chỉ các bảng dữ liệu cá nhân có policy ghi (ngoại lệ có chủ đích)
select results_eq(
  $$ select distinct tablename::text collate "default" from pg_policies
     where schemaname = 'public' and cmd <> 'SELECT' order by 1 $$,
  $$ values ('device_tokens'), ('notification_preferences'), ('profiles'), ('user_reminders') $$,
  'Không có policy ghi cho client trên bảng nghiệp vụ');

-- Tài liệu mục 1.1: dữ liệu cấp nền tảng không có tenant_id
select is_empty(
  $$ select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'tenant_id'
       and table_name in ('profiles', 'memberships', 'organizations', 'payments', 'refunds', 'chargebacks',
                          'ledger_accounts', 'ledger_transactions', 'ledger_entries', 'platform_fee_calculations',
                          'reports', 'report_attachments', 'dispute_cases', 'dispute_messages', 'approvals',
                          'support_requests', 'audit_logs', 'notifications') $$,
  'Bảng cấp nền tảng (Payment, Refund, Ledger, Report, Dispute...) không có tenant_id');

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'Mọi hàm security definer đều set search_path');

select results_eq(
  $$ select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1 $$,
  $$ values ('can_view_booking'), ('can_view_profile'), ('get_session_availability'), ('get_session_layout'),
            ('get_session_seat_pricing'), ('has_org_role'), ('has_platform_role'), ('has_staff_permission'),
            ('is_aal2'), ('is_corporate_member'), ('is_event_public'), ('is_layout_version_public'),
            ('is_org_member'), ('is_session_public'), ('is_venue_public'), ('setting_int'), ('try_uuid') $$,
  'anon chỉ gọi được các hàm đọc công khai');

-- Không có đường nào cho client tự ghi payments, tickets, ledger (mục 27.2)
select is_empty(
  $$ select f from unnest(array[
       'apply_payment_success(text,text,bigint,jsonb)', 'apply_payment_failure(text,text,jsonb)',
       'expire_unpaid_booking(uuid)', 'release_expired_bookings(uuid)', 'issue_tickets(uuid,text)',
       'attach_ticket_credentials(uuid,jsonb)', 'start_refund_processing(uuid)',
       'apply_refund_result(uuid,boolean,text,text,boolean)', 'finalize_refund_success(uuid,text)',
       'post_ledger_transaction(text,uuid,uuid,text,uuid,jsonb,text,uuid)', 'generate_session_inventory(uuid)',
       'compute_settlement(uuid)', 'run_settlement_cutoffs()', 'mark_payout_sent(uuid,text)',
       'confirm_payout(uuid,boolean,text)', 'claim_outbox(text,text,integer)', 'complete_outbox(bigint,text)',
       'create_refund(uuid,bigint,text,text,uuid,uuid,jsonb,uuid)', 'execute_session_cancellation(uuid)',
       'apply_org_status_change(uuid,text,text,uuid)', 'write_audit(text,text,text,uuid,jsonb,jsonb,jsonb)',
       'enqueue(text,text,uuid,jsonb)', 'run_session_status_transitions()', 'alert_unconfirmed_bookings()',
       'enqueue_session_reminders()', 'refresh_negative_balances()', 'list_payment_pending_to_query(integer)']) f
     where has_function_privilege('authenticated', ('public.' || f)::regprocedure, 'execute') $$,
  'authenticated không gọi được hàm chỉ dành cho server');

select ok(has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'Access token hook chỉ Auth gọi được');

select is_empty(
  $$ select id from storage.buckets where id in ('kyc-private', 'report-evidence') and public $$,
  'Bucket KYC và bằng chứng Report là riêng tư');

select * from finish();
rollback;
