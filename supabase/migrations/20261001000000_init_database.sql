-- ============================================================================
-- Nền tảng đặt vé sự kiện đa tổ chức · DATABASE v2 (ERD v1)
-- Một file dựng toàn bộ database trên một project Supabase MỚI (chạy một lần).
--
--   supabase db reset                 -> chạy file này rồi seed.sql
--   hoặc Supabase Studio > SQL Editor -> dán toàn bộ file, Run
--   hoặc psql "<DB_URL>" -v ON_ERROR_STOP=1 -f 20261001000000_init_database.sql
--
-- Căn cứ: "Mô tả dự án và hướng dẫn phát triển" (MT) và "Phân công công việc GĐ1" (PC).
-- Thay đổi sau này: KHÔNG sửa file này khi đã triển khai; tạo migration mới
-- (supabase migration new <ten>) chạy sau file này.
--
-- Mục lục (theo thứ tự chạy; số trong ngoặc là mã phần mà các chú thích như
-- "migration 0400", "1600" bên dưới nhắc tới)
--    1. (0100) init_utils
--    2. (0200) identity_org
--    3. (0300) venue_layout
--    4. (0400) catalog
--    5. (0500) inventory
--    6. (0600) b2b
--    7. (0700) booking_payment_ticket
--    8. (0800) gate_staff
--    9. (0900) cancellation_refund
--   10. (1000) ledger_settlement_payout
--   11. (1100) reports_disputes_support
--   12. (1200) notifications_audit
--   13. (1300) storage
--   14. (1400) rpc_identity_org
--   15. (1500) rpc_venue_catalog
--   16. (1600) rpc_booking_payment
--   17. (1700) rpc_staff_gate
--   18. (1800) rpc_cancel_report_support
--   19. (1810) rpc_refund_chargeback
--   20. (1820) rpc_settlement_payout
--   21. (1850) jobs
--   22. (1900) cron_jobs
-- ============================================================================


-- ############################################################################
-- PHẦN 1 (0100) · init_utils
-- ############################################################################

-- ============================================================================
-- 0100 · Tiện ích dùng chung
-- Nền tảng đặt vé sự kiện đa tổ chức · ERD v1 (đề xuất cho Sprint 0)
--
-- Quy ước toàn bộ schema:
--   * Trạng thái là text IN HOA + CHECK (dễ thêm giá trị, map sang enum Dart).
--   * Tiền: bigint, đơn vị đồng (VND, không có phần lẻ). Chỉ một loại tiền.
--   * Thời gian: timestamptz (UTC); hiển thị theo venues.timezone.
--   * Bảng cấp Org có tenant_id = organizations.id và bật RLS.
--   * Client CHỈ ĐỌC qua RLS. Mọi thao tác ghi nghiệp vụ đi qua RPC
--     (security definer + set search_path) hoặc backend .NET (service_role).
--   * Hàm mới KHÔNG tự cấp quyền execute cho anon/authenticated (xem cuối file);
--     mỗi RPC phải grant tường minh.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Hàm tạo ra từ nay không còn execute mặc định cho PUBLIC/anon/authenticated.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Báo lỗi theo mã chuẩn (tài liệu mục 20.4). Frontend đọc message làm mã lỗi,
-- details là JSON.
-- ----------------------------------------------------------------------------
create or replace function public.app_error(p_code text, p_detail jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    message = p_code,
    errcode = 'P0001',
    detail  = coalesce(p_detail::text, '');
end;
$$;

-- ----------------------------------------------------------------------------
-- Trigger dùng chung
-- ----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bảng bất biến (log, sổ cái, lịch sử): chặn UPDATE/DELETE, kể cả service_role.
create or replace function public.tg_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    message = 'IMMUTABLE_ROW',
    errcode = 'P0001',
    detail  = jsonb_build_object('table', tg_table_name, 'op', tg_op)::text;
end;
$$;

-- ----------------------------------------------------------------------------
-- Máy trạng thái (tài liệu mục 6): mọi chuyển trạng thái phải nằm trong danh sách
-- cho phép, nếu không thì báo INVALID_STATE và không ghi đè. Tham số trigger là
-- JSON {"TỪ": ["ĐẾN", ...]}; trạng thái không có khóa là trạng thái kết thúc.
-- RPC vẫn phải dùng UPDATE ... WHERE status = '<hiện tại>'; trigger là hàng rào cuối.
-- ----------------------------------------------------------------------------
create or replace function public.tg_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not coalesce((tg_argv[0]::jsonb -> old.status) ? new.status, false) then
    raise exception using
      message = 'INVALID_STATE',
      errcode = 'P0001',
      detail  = jsonb_build_object('table', tg_table_name, 'from', old.status, 'to', new.status)::text;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tham số hệ thống (SRS: T_LOCK, T_MAX, REPORT_WINDOW...). Đọc công khai,
-- chỉ sửa bằng migration hoặc service_role.
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select using (true);

insert into public.app_settings (key, value, description) values
  ('booking.lock_minutes',            '10',       'T_LOCK: thời gian giữ chỗ khi tạo Booking'),
  ('payment.session_minutes',         '15',       'Thời hạn phiên cổng thanh toán; lock được gia hạn thêm 5 phút so với phiên'),
  ('payment.max_hold_minutes',        '30',       'T_MAX: tổng thời gian tối đa giữ ghế kể từ khi tạo Booking'),
  ('booking.confirm_alert_minutes',   '5',        'T_CONFIRM_ALERT: Booking PAID quá thời gian này chưa CONFIRMED thì cảnh báo vận hành'),
  ('fee.default_percent_bp',          '500',      'Platform Fee mặc định khi Org chưa có hợp đồng riêng (basis point, 500 = 5%)'),
  ('review.large_event_tickets',      '5000',     'Tổng quota từ ngưỡng này trở lên thì sự kiện bắt buộc kiểm duyệt'),
  ('report.window_hours',             '72',       'REPORT_WINDOW mặc định sau khi Session kết thúc'),
  ('dispute.report_threshold',        '5',        'Số Report trên một Session để kích hoạt hold và chuyển Admin xem xét'),
  ('dispute.org_response_hours',      '48',       'SLA Org phản hồi Dispute Case'),
  ('gate.presync_hours',              '2',        'GATE_PRESYNC: tải manifest trước giờ mở cổng'),
  ('gate.manual_checkin_per_hour',    '30',       'Giới hạn check-in thủ công mỗi Staff mỗi giờ'),
  ('gate.offline_alert_minutes',      '30',       'Cảnh báo thiết bị soát vé offline lâu hơn ngưỡng này'),
  ('payout.bank_change_cooldown_hours','72',      'Cooldown sau khi đổi tài khoản nhận tiền'),
  ('payout.negative_balance_grace_days','30',     'Số dư Org âm quá số ngày này thì khóa tạo/gửi duyệt sự kiện'),
  ('refund.otp_valid_minutes',        '10',       'Khách phải xác thực OTP trong khoảng này trước khi gửi tài khoản nhận hoàn tiền'),
  ('approval.refund_manual_threshold','10000000', 'Hoàn tiền thủ công từ mức này (đồng) cần hai Admin duyệt');

create or replace function public.setting_int(p_key text, p_default int)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default);
$$;


-- ############################################################################
-- PHẦN 2 (0200) · identity_org
-- ############################################################################

-- ============================================================================
-- 0200 · Danh tính, Membership, Organization, KYC   (chủ: Đinh Khôi)
--
-- Giải quyết "Login có 4 chức năng": chỉ có MỘT đăng nhập (Supabase Auth).
-- Quyền nằm ở memberships. Sau đăng nhập, app gọi list_my_workspaces() rồi
-- set_active_workspace(); token mang claim active_workspace qua
-- custom_access_token_hook. Bốn "không gian làm việc":
--   CUSTOMER  mọi user đều có, không cần dòng membership
--   ORG       portal Org   (OWNER, FINANCE, EVENT_MANAGER, GATE_MANAGER)
--   STAFF     app Staff    (SCANNER, POS, GATE_MANAGER)
--   ADMIN     portal Admin (KYC_REVIEWER, FINANCE_ADMIN, DISPUTE_ADMIN, SUPPORT)
-- Claim trong token chỉ phục vụ điều hướng; quyền thật luôn kiểm tra lại ở
-- bảng memberships (thu hồi có hiệu lực ngay, không chờ token hết hạn).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: hồ sơ cấp nền tảng, tạo tự động khi đăng ký (không cho client insert)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  locale      text not null default 'vi',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- organizations: Ban tổ chức = tenant
-- ----------------------------------------------------------------------------
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  logo_url       text,
  description    text,
  business_type  text not null default 'COMPANY'
                 check (business_type in ('INDIVIDUAL', 'HOUSEHOLD', 'COMPANY')),
  legal_name     text,
  tax_code       text,
  contact_email  text,
  contact_phone  text,
  status         text not null default 'DRAFT'
                 check (status in ('DRAFT', 'PENDING_REVIEW', 'NEEDS_INFO', 'APPROVED',
                                   'REJECTED', 'SUSPENDED', 'TERMINATED')),
  tier           text not null default 'NEW' check (tier in ('NEW', 'STANDARD', 'TRUSTED')),
  status_reason  text,
  approved_at    timestamptz,
  -- Số dư phải trả âm từ lúc nào (job refresh_negative_balances); quá hạn thì khóa tạo sự kiện
  negative_balance_since timestamptz,
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.tg_set_updated_at();
-- SUSPENDED: dừng bán mọi Session và giữ toàn bộ payout (request_org_status_change)
create trigger trg_organizations_status before update of status on public.organizations
  for each row execute function public.tg_guard_status('{
    "DRAFT":          ["PENDING_REVIEW"],
    "PENDING_REVIEW": ["APPROVED", "NEEDS_INFO", "REJECTED"],
    "NEEDS_INFO":     ["PENDING_REVIEW"],
    "REJECTED":       ["PENDING_REVIEW"],
    "APPROVED":       ["SUSPENDED", "TERMINATED"],
    "SUSPENDED":      ["APPROVED", "TERMINATED"]}');

-- ----------------------------------------------------------------------------
-- memberships: vai trò của user trong một Org hoặc ở cấp nền tảng
-- ----------------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  scope       text not null check (scope in ('ORG', 'PLATFORM')),
  org_id      uuid references public.organizations (id) on delete cascade,
  roles       text[] not null,
  status      text not null default 'ACTIVE' check (status in ('INVITED', 'ACTIVE', 'REVOKED')),
  invited_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint memberships_scope_roles_ck check (
    cardinality(roles) > 0 and (
      (scope = 'ORG' and org_id is not null
        and roles <@ array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER','SCANNER','POS']::text[])
      or
      (scope = 'PLATFORM' and org_id is null
        and roles <@ array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']::text[])
    )
  )
);
create unique index uq_memberships_org_user on public.memberships (org_id, user_id) where scope = 'ORG';
create unique index uq_memberships_platform_user on public.memberships (user_id) where scope = 'PLATFORM';
create index ix_memberships_user on public.memberships (user_id) where status = 'ACTIVE';
create trigger trg_memberships_updated before update on public.memberships
  for each row execute function public.tg_set_updated_at();

-- Workspace đang chọn; hook đọc bảng này khi phát token mới.
create table public.user_active_workspace (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('CUSTOMER', 'ORG', 'STAFF', 'ADMIN')),
  org_id      uuid references public.organizations (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  check ((kind in ('ORG', 'STAFF')) = (org_id is not null))
);

-- ----------------------------------------------------------------------------
-- Helper phân quyền cho RLS và RPC (security definer để không đệ quy RLS)
-- ----------------------------------------------------------------------------
create or replace function public.has_org_role(p_org_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.scope = 'ORG'
      and m.org_id = p_org_id
      and m.status = 'ACTIVE'
      and (p_roles is null or m.roles && p_roles)
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(p_org_id, null);
$$;

create or replace function public.has_platform_role(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.scope = 'PLATFORM'
      and m.status = 'ACTIVE'
      and (p_roles is null or m.roles && p_roles)
  );
$$;

-- 2FA: Supabase MFA đặt claim aal = 'aal2' sau khi xác thực yếu tố thứ hai.
create or replace function public.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- Thành viên quản lý của Org được xem hồ sơ (tên, SĐT) của thành viên khác cùng Org.
create or replace function public.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
      or public.has_platform_role()
      or exists (
        select 1
        from public.memberships target
        join public.memberships me
          on me.org_id = target.org_id
         and me.user_id = (select auth.uid())
         and me.status = 'ACTIVE'
         and me.roles && array['OWNER','EVENT_MANAGER','GATE_MANAGER']::text[]
        where target.user_id = p_user_id and target.scope = 'ORG'
      );
$$;

-- ----------------------------------------------------------------------------
-- KYC
-- ----------------------------------------------------------------------------
create table public.kyc_submissions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  status                text not null default 'SUBMITTED'
                        check (status in ('SUBMITTED', 'APPROVED', 'NEEDS_INFO', 'REJECTED')),
  legal_info            jsonb not null default '{}'::jsonb,  -- tên pháp lý, địa chỉ, người đại diện
  identity_number_hash  text,  -- sha256 của CCCD/MST đã chuẩn hóa, để phát hiện trùng
  submitted_by          uuid not null references public.profiles (id),
  reviewed_by           uuid references public.profiles (id),
  review_note           text,
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz
);
create index ix_kyc_submissions_org on public.kyc_submissions (org_id, submitted_at desc);
create index ix_kyc_submissions_identity on public.kyc_submissions (identity_number_hash);

create table public.kyc_documents (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  submission_id  uuid not null references public.kyc_submissions (id) on delete cascade,
  doc_type       text not null check (doc_type in ('ID_CARD_FRONT', 'ID_CARD_BACK', 'BUSINESS_LICENSE',
                                                   'BANK_PROOF', 'OTHER')),
  storage_path   text not null,  -- bucket riêng tư kyc-private, dạng <org_id>/<file>
  uploaded_by    uuid not null references public.profiles (id),
  created_at     timestamptz not null default now()
);
create index ix_kyc_documents_submission on public.kyc_documents (submission_id);

-- ----------------------------------------------------------------------------
-- Tài khoản nhận tiền và hợp đồng phí của Org
-- ----------------------------------------------------------------------------
create table public.org_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  bank_code       text not null,
  account_number  text not null,
  account_holder  text not null,
  status          text not null default 'PENDING'
                  check (status in ('PENDING', 'ACTIVE', 'RETIRED', 'REJECTED')),
  effective_at    timestamptz,  -- hết cooldown thì mới dùng cho payout
  created_by      uuid not null references public.profiles (id),
  verified_by     uuid references public.profiles (id),
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index uq_org_bank_active on public.org_bank_accounts (org_id) where status = 'ACTIVE';
create trigger trg_org_bank_accounts_updated before update on public.org_bank_accounts
  for each row execute function public.tg_set_updated_at();

create table public.org_fee_contracts (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  percent_bp         int not null check (percent_bp between 0 and 10000),
  fixed_per_ticket   bigint not null default 0 check (fixed_per_ticket >= 0),
  formula_version    text not null default 'v1',
  valid_from         timestamptz not null,
  valid_to           timestamptz,
  created_by         uuid not null references public.profiles (id),
  created_at         timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);
create index ix_org_fee_contracts_org on public.org_fee_contracts (org_id, valid_from desc);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.memberships           enable row level security;
alter table public.user_active_workspace enable row level security;
alter table public.kyc_submissions       enable row level security;
alter table public.kyc_documents         enable row level security;
alter table public.org_bank_accounts     enable row level security;
alter table public.org_fee_contracts     enable row level security;

create policy profiles_read on public.profiles for select
  using (public.can_view_profile(id));
-- Ngoại lệ có chủ đích: user tự sửa hồ sơ, giới hạn theo cột bằng GRANT.
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, locale) on public.profiles to authenticated;

create policy organizations_read on public.organizations for select
  using (public.is_org_member(id) or public.has_platform_role());

create policy memberships_read on public.memberships for select
  using (
    user_id = (select auth.uid())
    or (scope = 'ORG' and public.has_org_role(org_id, array['OWNER']))
    or public.has_platform_role()
  );

create policy user_active_workspace_read on public.user_active_workspace for select
  using (user_id = (select auth.uid()));

create policy kyc_submissions_read on public.kyc_submissions for select
  using (public.has_org_role(org_id, array['OWNER']) or public.has_platform_role(array['KYC_REVIEWER']));
create policy kyc_documents_read on public.kyc_documents for select
  using (public.has_org_role(org_id, array['OWNER']) or public.has_platform_role(array['KYC_REVIEWER']));

create policy org_bank_accounts_read on public.org_bank_accounts for select
  using (public.has_org_role(org_id, array['OWNER','FINANCE']) or public.has_platform_role(array['FINANCE_ADMIN']));
create policy org_fee_contracts_read on public.org_fee_contracts for select
  using (public.has_org_role(org_id, array['OWNER','FINANCE']) or public.has_platform_role(array['FINANCE_ADMIN']));

-- Thông tin Org công khai cho app khách: chỉ cột hiển thị, chỉ Org đã duyệt.
-- (view chạy với quyền owner để không lộ cột nhạy cảm như tax_code)
create view public.org_public as
  select id, name, slug, logo_url, description
  from public.organizations
  where status = 'APPROVED';
grant select on public.org_public to anon, authenticated;

grant execute on function
  public.has_org_role(uuid, text[]),
  public.is_org_member(uuid),
  public.has_platform_role(text[]),
  public.is_aal2(),
  public.can_view_profile(uuid),
  public.setting_int(text, int)
to anon, authenticated;


-- ############################################################################
-- PHẦN 3 (0300) · venue_layout
-- ############################################################################

-- ============================================================================
-- 0300 · Địa điểm, sơ đồ chỗ, cổng   (chủ: Lâm Phước)
--
-- Giải quyết "Sự kiện tổ chức ở đâu" và "khách ngồi ghế nào":
--   venues           địa điểm thật (địa chỉ, tọa độ, múi giờ, sức chứa)
--   layouts          một kiểu bố trí của địa điểm (vd. "Nhà hát - 3 tầng")
--   layout_versions  phiên bản sơ đồ; DRAFT sửa thoải mái, PUBLISHED bất biến
--   zones            khu ngồi (SEATED) hoặc khu đứng (STANDING)
--   seats            ghế cụ thể: khu, hàng, số, tọa độ vẽ, cờ (xe lăn, khuất tầm nhìn)
--   gates            cổng vật lý của địa điểm
-- zones và seats chỉ được sinh ra khi phát hành phiên bản (publish_layout_version),
-- nên mọi dòng trong hai bảng này đều thuộc phiên bản đã phát hành và bất biến.
-- ============================================================================

create table public.venues (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.organizations (id),
  name           text not null,
  venue_type     text not null default 'OTHER'
                 check (venue_type in ('THEATER', 'STADIUM', 'HALL', 'OUTDOOR', 'CLUB', 'OTHER')),
  address_line   text not null,
  ward           text,
  district       text,
  city           text not null,
  country_code   text not null default 'VN',
  latitude       double precision check (latitude between -90 and 90),
  longitude      double precision check (longitude between -180 and 180),
  timezone       text not null default 'Asia/Ho_Chi_Minh',
  capacity       int not null check (capacity > 0),
  description    text,
  map_image_url  text,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, tenant_id)
);
create index ix_venues_tenant on public.venues (tenant_id);
create index ix_venues_city on public.venues (city) where status = 'ACTIVE';
create trigger trg_venues_updated before update on public.venues
  for each row execute function public.tg_set_updated_at();

create table public.layouts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  venue_id    uuid not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, tenant_id),
  unique (id, venue_id),
  foreign key (venue_id, tenant_id) references public.venues (id, tenant_id)
);
create trigger trg_layouts_updated before update on public.layouts
  for each row execute function public.tg_set_updated_at();

create table public.layout_versions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  layout_id       uuid not null,
  venue_id        uuid not null,
  version_no      int not null check (version_no > 0),
  status          text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  -- JSON schema Layout (tài liệu mục 22), chốt cùng FE3 ở S0-FE3-2
  definition      jsonb not null default '{"zones": []}'::jsonb,
  total_capacity  int,
  published_at    timestamptz,
  published_by    uuid references public.profiles (id),
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (layout_id, version_no),
  unique (id, venue_id),
  unique (id, tenant_id),
  foreign key (layout_id, tenant_id) references public.layouts (id, tenant_id),
  foreign key (layout_id, venue_id) references public.layouts (id, venue_id)
);
create trigger trg_layout_versions_updated before update on public.layout_versions
  for each row execute function public.tg_set_updated_at();

-- Phiên bản đã phát hành là bất biến; chỉ được chuyển PUBLISHED -> ARCHIVED.
create or replace function public.tg_layout_version_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception using message = 'INVALID_STATE', errcode = 'P0001',
        detail = jsonb_build_object('status', old.status)::text;
    end if;
    return old;
  end if;

  if old.status = 'PUBLISHED' then
    if new.status = 'ARCHIVED'
       and new.definition = old.definition
       and new.version_no = old.version_no then
      return new;
    end if;
    raise exception using message = 'INVALID_STATE', errcode = 'P0001',
      detail = jsonb_build_object('status', old.status, 'reason', 'published layout is immutable')::text;
  elsif old.status = 'ARCHIVED' then
    raise exception using message = 'INVALID_STATE', errcode = 'P0001',
      detail = jsonb_build_object('status', old.status)::text;
  end if;
  return new;
end;
$$;
create trigger trg_layout_versions_guard before update or delete on public.layout_versions
  for each row execute function public.tg_layout_version_guard();

create table public.zones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  layout_version_id  uuid not null references public.layout_versions (id),
  code               text not null,  -- id trong JSON, vd "A", "GA"
  name               text not null,
  kind               text not null check (kind in ('SEATED', 'STANDING')),
  capacity           int not null check (capacity > 0),
  color              text,
  sort_order         int not null default 0,
  unique (layout_version_id, code),
  unique (id, layout_version_id)
);
create trigger trg_zones_immutable before update or delete on public.zones
  for each row execute function public.tg_immutable();

create table public.seats (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  layout_version_id  uuid not null,
  zone_id            uuid not null,
  seat_code          text not null,  -- id trong JSON, vd "A-1-1"; in trên vé
  section            text,           -- tầng / lô, vd "Tầng 1"
  row_label          text not null,
  seat_number        text not null,
  x                  numeric not null,
  y                  numeric not null,
  flags              text[] not null default '{}',  -- wheelchair, restricted_view, companion
  default_blocked    boolean not null default false, -- vị trí kỹ thuật, mặc định không bán
  unique (layout_version_id, seat_code),
  foreign key (zone_id, layout_version_id) references public.zones (id, layout_version_id)
);
create index ix_seats_zone on public.seats (zone_id);
create trigger trg_seats_immutable before update or delete on public.seats
  for each row execute function public.tg_immutable();

create table public.gates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  venue_id    uuid not null,
  code        text not null,
  name        text not null,
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_at  timestamptz not null default now(),
  unique (venue_id, code),
  unique (id, tenant_id),
  foreign key (venue_id, tenant_id) references public.venues (id, tenant_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.venues          enable row level security;
alter table public.layouts         enable row level security;
alter table public.layout_versions enable row level security;
alter table public.zones           enable row level security;
alter table public.seats           enable row level security;
alter table public.gates           enable row level security;

-- Dữ liệu cấp tenant (tài liệu mục 1.1): chỉ thành viên Org và Admin đọc.
-- Khách chỉ thấy Venue / Zone / ghế của Session đã công bố: policy *_public_read ở
-- migration 0400 (cần bảng sessions); sơ đồ ghế tải qua RPC get_session_layout().
create policy venues_read on public.venues for select
  using (public.is_org_member(tenant_id) or (select public.has_platform_role()));

create policy layouts_read on public.layouts for select
  using (public.is_org_member(tenant_id) or (select public.has_platform_role()));
create policy layout_versions_read on public.layout_versions for select
  using (public.is_org_member(tenant_id) or (select public.has_platform_role()));

create policy zones_read on public.zones for select
  using (public.is_org_member(tenant_id) or (select public.has_platform_role()));
create policy seats_read on public.seats for select
  using (public.is_org_member(tenant_id) or (select public.has_platform_role()));

create policy gates_read on public.gates for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());


-- ############################################################################
-- PHẦN 4 (0400) · catalog
-- ############################################################################

-- ============================================================================
-- 0400 · Event, Session, Ticket Type   (chủ: Đinh Khôi)
--
-- Giải quyết "một sự kiện tổ chức ở nhiều nơi": Event chỉ là vỏ thông tin
-- chung; mỗi Session (suất diễn) gắn với MỘT Venue và MỘT Layout version.
-- Một Event có thể có nhiều Session ở nhiều Venue, nhiều thành phố.
-- Bán vé, soát vé, hủy và đối soát đều làm ở cấp Session.
--
-- Giải quyết "vé miễn phí phải có số lượng cố định": mọi Ticket Type đều có
-- quota bắt buộc, kể cả FREE và COMP (vé mời). Vé 0đ vẫn đi qua create_booking,
-- vẫn giữ chỗ, vẫn bị giới hạn mỗi tài khoản và vẫn phát QR như vé trả phí.
-- ============================================================================

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  sort_order  int not null default 0
);

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.organizations (id),
  title            text not null,
  slug             text not null check (slug ~ '^[a-z0-9-]{3,120}$'),
  summary          text,
  description      text,
  category_id      uuid references public.categories (id),
  cover_image_url  text,
  age_limit        int check (age_limit between 0 and 21),
  terms            text,
  status           text not null default 'DRAFT'
                   check (status in ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'REJECTED',
                                     'PUBLISHED', 'CANCELLED', 'ENDED')),
  requires_review  boolean not null default true,
  is_featured      boolean not null default false,  -- chỉ Admin bật
  published_at     timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, slug)
);
create index ix_events_public on public.events (status, created_at desc) where status = 'PUBLISHED';
create trigger trg_events_updated before update on public.events
  for each row execute function public.tg_set_updated_at();
create trigger trg_events_status before update of status on public.events
  for each row execute function public.tg_guard_status('{
    "DRAFT":             ["PENDING_REVIEW", "PUBLISHED", "CANCELLED"],
    "CHANGES_REQUESTED": ["PENDING_REVIEW", "PUBLISHED", "CANCELLED"],
    "PENDING_REVIEW":    ["PUBLISHED", "CHANGES_REQUESTED", "REJECTED"],
    "PUBLISHED":         ["CANCELLED", "ENDED"]}');

-- Giấy phép, tài liệu kèm theo khi gửi kiểm duyệt
create table public.event_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  event_id      uuid not null,
  doc_type      text not null check (doc_type in ('PERFORMANCE_PERMIT', 'VENUE_CONTRACT', 'OTHER')),
  storage_path  text not null,
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),
  foreign key (event_id, tenant_id) references public.events (id, tenant_id) on delete cascade
);

-- Lịch sử kiểm duyệt (bất biến)
create table public.event_reviews (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  event_id    uuid not null,
  action      text not null check (action in ('SUBMITTED', 'AUTO_PUBLISHED', 'APPROVED',
                                               'CHANGES_REQUESTED', 'REJECTED')),
  actor_id    uuid references public.profiles (id),
  note        text,
  created_at  timestamptz not null default now(),
  foreign key (event_id, tenant_id) references public.events (id, tenant_id) on delete cascade
);
create trigger trg_event_reviews_immutable before update on public.event_reviews
  for each row execute function public.tg_immutable();

create table public.sessions (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null,
  event_id                uuid not null,
  venue_id                uuid not null,
  layout_version_id       uuid not null,
  title                   text,  -- vd "Đêm 2 - TP.HCM"
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null,
  doors_open_at           timestamptz not null,
  sales_start_at          timestamptz not null,
  sales_end_at            timestamptz not null,
  status                  text not null default 'SCHEDULED'
                          check (status in ('SCHEDULED', 'ON_SALE', 'SALES_CLOSED', 'ONGOING',
                                            'ENDED', 'POSTPONED', 'CANCELLED')),
  -- Dừng bán ngay lập tức (vd. khi Org yêu cầu hủy, chờ Admin duyệt)
  sales_paused            boolean not null default false,
  sales_paused_reason     text,
  max_tickets_per_account int not null default 10 check (max_tickets_per_account > 0),
  report_window_hours     int not null default 72 check (report_window_hours >= 0),
  inventory_generated_at  timestamptz,
  created_by              uuid references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (event_id, tenant_id) references public.events (id, tenant_id),
  foreign key (venue_id, tenant_id) references public.venues (id, tenant_id),
  -- Layout version phải thuộc đúng Venue của Session
  foreign key (layout_version_id, venue_id) references public.layout_versions (id, venue_id),
  check (ends_at > starts_at),
  check (doors_open_at <= starts_at),
  check (sales_start_at < sales_end_at),
  check (sales_end_at <= ends_at)
);
create index ix_sessions_event on public.sessions (event_id, starts_at);
create index ix_sessions_status_time on public.sessions (status, sales_start_at, sales_end_at, starts_at, ends_at);
create index ix_sessions_venue on public.sessions (venue_id, starts_at);
create trigger trg_sessions_updated before update on public.sessions
  for each row execute function public.tg_set_updated_at();
create trigger trg_sessions_status before update of status on public.sessions
  for each row execute function public.tg_guard_status('{
    "SCHEDULED":    ["ON_SALE", "SALES_CLOSED", "ONGOING", "ENDED", "POSTPONED", "CANCELLED"],
    "ON_SALE":      ["SALES_CLOSED", "ONGOING", "ENDED", "POSTPONED", "CANCELLED"],
    "SALES_CLOSED": ["ONGOING", "ENDED", "POSTPONED", "CANCELLED"],
    "ONGOING":      ["ENDED", "CANCELLED"],
    "POSTPONED":    ["SCHEDULED", "ON_SALE", "CANCELLED"]}');

create table public.ticket_types (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  session_id             uuid not null,
  name                   text not null,
  description            text,
  kind                   text not null check (kind in ('PAID', 'FREE', 'COMP')),
  price_amount           bigint not null default 0,
  quota                  int not null check (quota > 0),       -- số vé cố định của hạng này
  max_per_order          int not null default 10 check (max_per_order > 0),
  sale_start_at          timestamptz,  -- null = theo Session
  sale_end_at            timestamptz,
  refund_policy          text not null default 'ONLY_IF_CANCELLED'
                         check (refund_policy in ('ONLY_IF_CANCELLED', 'REFUNDABLE_BEFORE_DEADLINE')),
  refund_deadline_hours  int check (refund_deadline_hours >= 0),
  visibility             text not null default 'PUBLIC' check (visibility in ('PUBLIC', 'HIDDEN')),
  status                 text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  sort_order             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, session_id),
  unique (id, tenant_id),
  foreign key (session_id, tenant_id) references public.sessions (id, tenant_id) on delete cascade,
  check ((kind = 'PAID' and price_amount > 0) or (kind in ('FREE', 'COMP') and price_amount = 0)),
  check (kind <> 'COMP' or visibility = 'HIDDEN'),  -- vé mời không bán công khai
  check (sale_start_at is null or sale_end_at is null or sale_start_at < sale_end_at)
);
create index ix_ticket_types_session on public.ticket_types (session_id, sort_order);
create trigger trg_ticket_types_updated before update on public.ticket_types
  for each row execute function public.tg_set_updated_at();

-- Hạng vé áp dụng cho những Zone nào (Zone thuộc layout version của Session)
create table public.ticket_type_zones (
  ticket_type_id  uuid not null references public.ticket_types (id) on delete cascade,
  zone_id         uuid not null references public.zones (id),
  tenant_id       uuid not null,
  primary key (ticket_type_id, zone_id)
);
create index ix_ticket_type_zones_zone on public.ticket_type_zones (zone_id);

-- ----------------------------------------------------------------------------
-- Helper hiển thị công khai
-- ----------------------------------------------------------------------------
create or replace function public.is_event_public(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = p_event_id and status in ('PUBLISHED', 'CANCELLED', 'ENDED')
  );
$$;

create or replace function public.is_session_public(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.events e on e.id = s.event_id
    where s.id = p_session_id and e.status in ('PUBLISHED', 'CANCELLED', 'ENDED')
  );
$$;

-- Venue / Layout version đang được dùng bởi một Session đã công bố
create or replace function public.is_venue_public(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.events e on e.id = s.event_id
    where s.venue_id = p_venue_id and e.status in ('PUBLISHED', 'CANCELLED', 'ENDED')
  );
$$;

create or replace function public.is_layout_version_public(p_layout_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.events e on e.id = s.event_id
    where s.layout_version_id = p_layout_version_id and e.status in ('PUBLISHED', 'CANCELLED', 'ENDED')
  );
$$;
create index ix_sessions_layout_version on public.sessions (layout_version_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.categories        enable row level security;
alter table public.events            enable row level security;
alter table public.event_documents   enable row level security;
alter table public.event_reviews     enable row level security;
alter table public.sessions          enable row level security;
alter table public.ticket_types      enable row level security;
alter table public.ticket_type_zones enable row level security;

create policy categories_read on public.categories for select using (true);

create policy events_read on public.events for select
  using (
    status in ('PUBLISHED', 'CANCELLED', 'ENDED')
    or public.is_org_member(tenant_id)
    or public.has_platform_role()
  );

create policy event_documents_read on public.event_documents for select
  using (public.has_org_role(tenant_id, array['OWNER','EVENT_MANAGER'])
         or public.has_platform_role(array['KYC_REVIEWER','SUPPORT']));
create policy event_reviews_read on public.event_reviews for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());

create policy sessions_read on public.sessions for select
  using (public.is_event_public(event_id) or public.is_org_member(tenant_id) or public.has_platform_role());

create policy ticket_types_read on public.ticket_types for select
  using (
    (visibility = 'PUBLIC' and status = 'ACTIVE' and public.is_session_public(session_id))
    or public.is_org_member(tenant_id)
    or public.has_platform_role()
  );

create policy ticket_type_zones_read on public.ticket_type_zones for select
  using (
    public.is_org_member(tenant_id)
    or public.has_platform_role()
    or exists (
      select 1 from public.ticket_types tt
      where tt.id = ticket_type_id and tt.visibility = 'PUBLIC'
        and public.is_session_public(tt.session_id)
    )
  );

-- Khách xem địa điểm và sơ đồ của Session đã công bố (tài liệu mục 20.1); dữ liệu
-- Venue / Zone / ghế của Org chưa công bố vẫn chỉ thành viên Org thấy.
create policy venues_public_read on public.venues for select
  using (public.is_venue_public(id));
create policy zones_public_read on public.zones for select
  using (public.is_layout_version_public(layout_version_id));
create policy seats_public_read on public.seats for select
  using (public.is_layout_version_public(layout_version_id));

grant execute on function public.is_event_public(uuid), public.is_session_public(uuid),
                          public.is_venue_public(uuid), public.is_layout_version_public(uuid)
  to anon, authenticated;


-- ############################################################################
-- PHẦN 5 (0500) · inventory
-- ############################################################################

-- ============================================================================
-- 0500 · Tồn kho theo Session   (chủ: Lâm Phước)
--
--   session_seats           trạng thái từng ghế của từng Session (database là
--                           nguồn chân lý; khóa bằng UPDATE có điều kiện)
--   session_zone_inventory  bộ đếm sức chứa khu đứng
--   ticket_type_inventory   bộ đếm quota của từng hạng vé (kể cả vé FREE, COMP)
-- Ghế (theo Session) và Vé là hai vòng đời tách biệt.
-- ============================================================================

create table public.session_seats (
  session_id       uuid not null references public.sessions (id) on delete cascade,
  seat_id          uuid not null references public.seats (id),
  tenant_id        uuid not null,
  zone_id          uuid not null references public.zones (id),
  ticket_type_id   uuid,  -- hạng giá của ghế này; null = chưa gán
  status           text not null default 'AVAILABLE'
                   check (status in ('AVAILABLE', 'LOCKED', 'SOLD', 'BLOCKED', 'HELD')),
  booking_id       uuid,  -- FK thêm ở migration 0700
  lock_expires_at  timestamptz,
  hold_reason      text,  -- HELD: tài trợ, nghệ sĩ, đơn B2B; BLOCKED: kỹ thuật, khuất tầm nhìn
  held_by          uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),
  primary key (session_id, seat_id),
  foreign key (ticket_type_id, session_id) references public.ticket_types (id, session_id),
  check ((status in ('LOCKED', 'SOLD')) = (booking_id is not null)),
  check ((status = 'LOCKED') = (lock_expires_at is not null))
);
create index ix_session_seats_status on public.session_seats (session_id, status);
create index ix_session_seats_booking on public.session_seats (booking_id) where booking_id is not null;
create index ix_session_seats_zone on public.session_seats (session_id, zone_id);

create table public.session_zone_inventory (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  zone_id     uuid not null references public.zones (id),
  tenant_id   uuid not null,
  capacity    int not null check (capacity >= 0),
  locked      int not null default 0 check (locked >= 0),
  sold        int not null default 0 check (sold >= 0),
  held        int not null default 0 check (held >= 0),
  updated_at  timestamptz not null default now(),
  primary key (session_id, zone_id),
  check (locked + sold + held <= capacity)
);

create table public.ticket_type_inventory (
  ticket_type_id  uuid primary key references public.ticket_types (id) on delete cascade,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  tenant_id       uuid not null,
  quota           int not null check (quota >= 0),
  locked          int not null default 0 check (locked >= 0),
  sold            int not null default 0 check (sold >= 0),
  updated_at      timestamptz not null default now(),
  check (locked + sold <= quota)
);

-- Tạo / cập nhật bộ đếm khi Ticket Type thay đổi quota.
-- CHECK (locked + sold <= quota) chặn việc giảm quota xuống dưới số đã bán.
create or replace function public.tg_ticket_type_inventory_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_type_inventory (ticket_type_id, session_id, tenant_id, quota)
    values (new.id, new.session_id, new.tenant_id, new.quota);
  elsif new.quota <> old.quota then
    update public.ticket_type_inventory
       set quota = new.quota, updated_at = now()
     where ticket_type_id = new.id;
  end if;
  return new;
end;
$$;
create trigger trg_ticket_types_inventory
  after insert or update of quota on public.ticket_types
  for each row execute function public.tg_ticket_type_inventory_sync();

-- ----------------------------------------------------------------------------
-- Sinh tồn kho cho Session từ Layout version (S1-BE1-3). Idempotent.
-- Gọi nội bộ từ save_session(); không cấp cho client.
-- ----------------------------------------------------------------------------
create or replace function public.generate_session_inventory(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  insert into public.session_seats (session_id, seat_id, tenant_id, zone_id, status)
  select v_session.id, s.id, v_session.tenant_id, s.zone_id,
         case when s.default_blocked then 'BLOCKED' else 'AVAILABLE' end
  from public.seats s
  join public.zones z on z.id = s.zone_id and z.kind = 'SEATED'
  where s.layout_version_id = v_session.layout_version_id
  on conflict (session_id, seat_id) do nothing;

  insert into public.session_zone_inventory (session_id, zone_id, tenant_id, capacity)
  select v_session.id, z.id, v_session.tenant_id, z.capacity
  from public.zones z
  where z.layout_version_id = v_session.layout_version_id and z.kind = 'STANDING'
  on conflict (session_id, zone_id) do nothing;

  update public.sessions set inventory_generated_at = now() where id = p_session_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS: chỉ Org và Admin đọc trực tiếp. Khách xem tình trạng ghế qua RPC
-- get_session_availability() (gọn hơn và không phải chạy RLS trên 50.000 dòng).
-- ----------------------------------------------------------------------------
alter table public.session_seats          enable row level security;
alter table public.session_zone_inventory enable row level security;
alter table public.ticket_type_inventory  enable row level security;

create policy session_seats_read on public.session_seats for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());
create policy session_zone_inventory_read on public.session_zone_inventory for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());
create policy ticket_type_inventory_read on public.ticket_type_inventory for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());


-- ############################################################################
-- PHẦN 6 (0600) · b2b
-- ############################################################################

-- ============================================================================
-- 0600 · Khách hàng doanh nghiệp (B2B)   (P1 theo SRS, mô hình dữ liệu có sẵn từ P0)
--
-- Giải quyết "vé mua cho tổ chức, doanh nghiệp":
--   * corporate_accounts   công ty mua vé (tên, MST, địa chỉ xuất hóa đơn)
--   * corporate_members    nhân viên được phép đặt vé thay công ty
--   * corporate_agreements thỏa thuận chiết khấu giữa Org bán và công ty mua,
--                          áp dụng cho toàn Org, một Event hoặc một Session
-- Một đơn B2B là MỘT Booking (một hóa đơn, booking_type = 'B2B') nhưng phát
-- N vé, mỗi vé một QR riêng. Lý do: cổng soát vé đếm người theo QR, hoàn tiền
-- và khiếu nại tính theo từng vé. Công ty phân vé cho nhân viên bằng
-- assign_ticket_holder() (ghi tên người dùng vé, không đổi QR).
-- Giá chụp vào booking_items: giá niêm yết, chiết khấu, giá sau chiết khấu.
-- Platform Fee tính trên giá sau chiết khấu.
-- ============================================================================

create table public.corporate_accounts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  tax_code         text,
  billing_address  text,
  invoice_email    text,
  contact_phone    text,
  status           text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index uq_corporate_accounts_tax on public.corporate_accounts (tax_code) where tax_code is not null;
create trigger trg_corporate_accounts_updated before update on public.corporate_accounts
  for each row execute function public.tg_set_updated_at();

create table public.corporate_members (
  corporate_account_id  uuid not null references public.corporate_accounts (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  role                  text not null default 'BUYER' check (role in ('ADMIN', 'BUYER')),
  created_at            timestamptz not null default now(),
  primary key (corporate_account_id, user_id)
);
create index ix_corporate_members_user on public.corporate_members (user_id);

create table public.corporate_agreements (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.organizations (id),  -- Org bán
  corporate_account_id  uuid not null references public.corporate_accounts (id),
  event_id              uuid references public.events (id),
  session_id            uuid references public.sessions (id),
  discount_bp           int not null check (discount_bp between 0 and 10000),  -- 1500 = 15%
  min_tickets_per_order int not null default 1 check (min_tickets_per_order > 0),
  max_tickets_total     int check (max_tickets_total > 0),
  valid_from            timestamptz not null,
  valid_to              timestamptz,
  status                text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by            uuid not null references public.profiles (id),
  created_at            timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);
create index ix_corporate_agreements_lookup
  on public.corporate_agreements (corporate_account_id, tenant_id) where status = 'ACTIVE';

create or replace function public.is_corporate_member(p_corporate_account_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.corporate_members
    where corporate_account_id = p_corporate_account_id
      and user_id = (select auth.uid())
      and (p_roles is null or role = any (p_roles))
  );
$$;
grant execute on function public.is_corporate_member(uuid, text[]) to anon, authenticated;

alter table public.corporate_accounts   enable row level security;
alter table public.corporate_members    enable row level security;
alter table public.corporate_agreements enable row level security;

create policy corporate_accounts_read on public.corporate_accounts for select
  using (
    public.is_corporate_member(id)
    or public.has_platform_role()
    or exists (
      select 1 from public.corporate_agreements a
      where a.corporate_account_id = corporate_accounts.id
        and public.has_org_role(a.tenant_id, array['OWNER','FINANCE','EVENT_MANAGER'])
    )
  );
create policy corporate_members_read on public.corporate_members for select
  using (public.is_corporate_member(corporate_account_id, array['ADMIN'])
         or user_id = (select auth.uid())
         or public.has_platform_role());
create policy corporate_agreements_read on public.corporate_agreements for select
  using (
    public.is_corporate_member(corporate_account_id)
    or public.has_org_role(tenant_id, array['OWNER','FINANCE','EVENT_MANAGER'])
    or public.has_platform_role()
  );


-- ############################################################################
-- PHẦN 7 (0700) · booking_payment_ticket
-- ############################################################################

-- ============================================================================
-- 0700 · Booking, Payment, Ticket, Outbox   (chủ: Lâm Phước)
--
-- Không có policy INSERT/UPDATE/DELETE nào cho client trên các bảng này.
-- Booking do create_booking() tạo; Payment do server ghi khi nhận IPN;
-- Ticket do worker phát sau khi Booking PAID; QR do worker .NET ký Ed25519.
--
-- Phạm vi (tài liệu mục 1.1): Booking, Ticket là bảng "giao nhau" nên có tenant_id
-- (Org thấy đơn/vé của sự kiện mình). Payment là bảng cấp nền tảng: không có
-- tenant_id, chỉ có org_id để Org xem phần liên quan đến mình.
-- ============================================================================

create table public.bookings (
  id                      uuid primary key default gen_random_uuid(),
  -- Mã đơn ngắn để khách đọc cho nhân viên / tra cứu check-in thủ công
  code                    text not null unique
                          default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  tenant_id               uuid not null,
  session_id              uuid not null,
  user_id                 uuid references public.profiles (id),  -- người mua (null: khách vãng lai mua tại POS)
  created_by              uuid not null references public.profiles (id),  -- auth.uid() lúc tạo
  booking_type            text not null default 'CUSTOMER'
                          check (booking_type in ('CUSTOMER', 'COMP', 'POS', 'B2B')),
  status                  text not null default 'PENDING'
                          check (status in ('PENDING', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'CANCELLED',
                                            'EXPIRED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED')),
  idempotency_key         text not null,
  item_count              int not null default 0 check (item_count >= 0),
  list_amount             bigint not null default 0 check (list_amount >= 0),
  discount_amount         bigint not null default 0 check (discount_amount >= 0),
  total_amount            bigint not null default 0 check (total_amount >= 0),
  currency                text not null default 'VND' check (currency = 'VND'),
  discount_bp             int not null default 0 check (discount_bp between 0 and 10000),
  corporate_account_id    uuid references public.corporate_accounts (id),
  corporate_agreement_id  uuid references public.corporate_agreements (id),
  buyer_snapshot          jsonb not null default '{}'::jsonb,  -- tên, email, SĐT, công ty, MST cho hóa đơn
  sold_by                 uuid references public.profiles (id),  -- Staff bán tại POS
  lock_expires_at         timestamptz,
  payment_deadline_at     timestamptz,  -- T_MAX
  paid_at                 timestamptz,
  confirmed_at            timestamptz,
  expired_at              timestamptz,
  cancelled_at            timestamptz,
  flagged                 boolean not null default false,
  flag_reason             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (created_by, idempotency_key),
  foreign key (session_id, tenant_id) references public.sessions (id, tenant_id),
  check (total_amount = list_amount - discount_amount),
  check (booking_type <> 'CUSTOMER' or user_id is not null),
  check (booking_type <> 'B2B' or (corporate_account_id is not null and user_id is not null)),
  check (booking_type <> 'POS' or sold_by is not null)
);
create index ix_bookings_user on public.bookings (user_id, created_at desc);
create index ix_bookings_session_status on public.bookings (session_id, status);
create index ix_bookings_pending_expiry on public.bookings (lock_expires_at)
  where status in ('PENDING', 'PAYMENT_PENDING');
create index ix_bookings_tenant on public.bookings (tenant_id, created_at desc);
create index ix_bookings_paid on public.bookings (paid_at) where status = 'PAID';
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.tg_set_updated_at();
-- SRS 3.4. PAYMENT_PENDING không tự sang EXPIRED (chỉ khi cổng xác nhận chưa thu);
-- EXPIRED vẫn sang PAID khi IPN đến muộn mà còn ghế, không còn thì REFUND_PENDING.
-- PAID/CONFIRMED -> CANCELLED chỉ dùng cho đơn 0đ khi Session bị hủy.
create trigger trg_bookings_status before update of status on public.bookings
  for each row execute function public.tg_guard_status('{
    "PENDING":            ["PAYMENT_PENDING", "PAID", "CANCELLED", "EXPIRED", "REFUND_PENDING"],
    "PAYMENT_PENDING":    ["PAID", "EXPIRED", "REFUND_PENDING"],
    "EXPIRED":            ["PAID", "REFUND_PENDING"],
    "CANCELLED":          ["REFUND_PENDING"],
    "PAID":               ["CONFIRMED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"],
    "CONFIRMED":          ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"],
    "REFUND_PENDING":     ["REFUNDED", "PARTIALLY_REFUNDED"],
    "PARTIALLY_REFUNDED": ["REFUND_PENDING", "REFUNDED"]}');

alter table public.session_seats
  add constraint session_seats_booking_fk foreign key (booking_id) references public.bookings (id);

create table public.booking_items (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  tenant_id        uuid not null,
  session_id       uuid not null,
  ticket_type_id   uuid not null,
  zone_id          uuid not null references public.zones (id),
  seat_id          uuid references public.seats (id),  -- null = khu đứng
  quantity         int not null check (quantity > 0),
  unit_list_price  bigint not null check (unit_list_price >= 0),
  unit_discount    bigint not null default 0 check (unit_discount >= 0),
  unit_price       bigint not null check (unit_price >= 0),
  created_at       timestamptz not null default now(),
  foreign key (ticket_type_id, session_id) references public.ticket_types (id, session_id),
  check (seat_id is null or quantity = 1),
  check (unit_price = unit_list_price - unit_discount)
);
create index ix_booking_items_booking on public.booking_items (booking_id);
create unique index uq_booking_items_seat on public.booking_items (booking_id, seat_id) where seat_id is not null;

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings (id),
  org_id          uuid not null references public.organizations (id),  -- Org bán (để báo cáo), không phải tenant
  gateway         text not null,  -- chốt ở OQ-02
  order_ref       text not null unique,      -- mã đơn gửi sang cổng
  gateway_txn_id  text unique,               -- chống xử lý IPN trùng (E-BKG-07)
  amount          bigint not null check (amount > 0),
  currency        text not null default 'VND' check (currency = 'VND'),
  status          text not null default 'INITIATED'
                  check (status in ('INITIATED', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'AMOUNT_MISMATCH')),
  method          text,
  ipn_payload     jsonb,
  failure_reason  text,
  initiated_at    timestamptz not null default now(),
  paid_at         timestamptz,
  updated_at      timestamptz not null default now()
);
create index ix_payments_booking on public.payments (booking_id);
create index ix_payments_initiated on public.payments (initiated_at) where status = 'INITIATED';
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.tg_set_updated_at();
-- Phiên EXPIRED/FAILED vẫn có thể nhận IPN thành công đến muộn; SUCCEEDED là cuối
create trigger trg_payments_status before update of status on public.payments
  for each row execute function public.tg_guard_status('{
    "INITIATED": ["SUCCEEDED", "FAILED", "EXPIRED", "AMOUNT_MISMATCH"],
    "EXPIRED":   ["SUCCEEDED", "AMOUNT_MISMATCH"],
    "FAILED":    ["SUCCEEDED", "AMOUNT_MISMATCH"]}');

-- Khóa công khai Ed25519; khóa bí mật chỉ nằm trong secret của backend .NET.
create table public.signing_keys (
  kid         text primary key,
  algorithm   text not null default 'Ed25519' check (algorithm = 'Ed25519'),
  public_key  text not null,
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'RETIRED')),
  created_at  timestamptz not null default now(),
  retired_at  timestamptz
);

create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  booking_id         uuid not null references public.bookings (id),
  booking_item_id    uuid not null references public.booking_items (id),
  session_id         uuid not null references public.sessions (id),
  ticket_type_id     uuid not null references public.ticket_types (id),
  zone_id            uuid not null references public.zones (id),
  seat_id            uuid references public.seats (id),
  owner_id           uuid references public.profiles (id),  -- tài khoản giữ vé
  holder_name        text,   -- người dùng vé (B2B phân cho nhân viên)
  holder_email       text,
  holder_phone       text,
  status             text not null default 'ISSUED'
                     check (status in ('ISSUED', 'USED', 'NO_SHOW', 'VOID', 'REFUND_PENDING', 'REFUNDED')),
  status_changed_at  timestamptz not null default now(),  -- dùng cho manifest delta
  used_at            timestamptz,
  used_gate_id       uuid references public.gates (id),
  used_device_id     uuid,
  used_by            uuid references public.profiles (id),
  void_reason        text,
  replaced_by        uuid references public.tickets (id),
  issued_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (status <> 'USED' or used_at is not null)
);
-- Hàng rào cuối cùng chống bán trùng ghế (tài liệu mục 20.3)
create unique index uq_ticket_seat_active on public.tickets (session_id, seat_id)
  where status in ('ISSUED', 'USED') and seat_id is not null;
create index ix_tickets_owner on public.tickets (owner_id, created_at desc);
create index ix_tickets_booking on public.tickets (booking_id);
create index ix_tickets_session_changed on public.tickets (session_id, status_changed_at);
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_ticket_status_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_tickets_status_changed before update of status on public.tickets
  for each row execute function public.tg_ticket_status_changed();

-- QR chỉ hợp lệ khi ISSUED. NO_SHOW -> USED: log quét offline đồng bộ sau khi Session kết thúc.
create trigger trg_tickets_status before update of status on public.tickets
  for each row execute function public.tg_guard_status('{
    "ISSUED":         ["USED", "NO_SHOW", "VOID", "REFUND_PENDING"],
    "USED":           ["REFUND_PENDING", "VOID"],
    "NO_SHOW":        ["USED", "REFUND_PENDING", "VOID"],
    "REFUND_PENDING": ["REFUNDED"]}');

-- Không sửa vé đã phát: đổi người giữ hoặc đổi ghế thì VOID vé cũ và phát vé mới.
-- Ngoại lệ: ghi tên người dùng vé lần đầu (B2B, vé mời).
create or replace function public.tg_ticket_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_id <> old.booking_id or new.booking_item_id <> old.booking_item_id
     or new.session_id <> old.session_id or new.ticket_type_id <> old.ticket_type_id
     or new.zone_id <> old.zone_id or new.seat_id is distinct from old.seat_id
     or new.owner_id is distinct from old.owner_id
     or (old.holder_name is not null and (new.holder_name is distinct from old.holder_name
                                          or new.holder_email is distinct from old.holder_email
                                          or new.holder_phone is distinct from old.holder_phone)) then
    raise exception using message = 'INVALID_STATE', errcode = 'P0001',
      detail = jsonb_build_object('reason', 'issued ticket is immutable; void and re-issue instead')::text;
  end if;
  return new;
end;
$$;
create trigger trg_tickets_immutable_fields before update on public.tickets
  for each row execute function public.tg_ticket_immutable_fields();

-- Payload QR đã ký, tách riêng để chỉ chủ vé đọc được (Org/Staff không chụp lại QR được)
create table public.ticket_credentials (
  ticket_id   uuid primary key references public.tickets (id) on delete cascade,
  tenant_id   uuid not null,
  kid         text not null references public.signing_keys (kid),
  payload     text not null,  -- chỉ chứa id, không chứa dữ liệu cá nhân
  signature   text not null,
  created_at  timestamptz not null default now()
);

-- Outbox: ghi cùng transaction nghiệp vụ, worker xử lý sau (tài liệu mục 20.6)
create table public.outbox (
  id               bigint generated always as identity primary key,
  topic            text not null,  -- ISSUE_TICKETS, PROCESS_REFUND, NOTIFY_*, GATE_ALERT, ADMIN_ALERT...
  aggregate_type   text not null,
  aggregate_id     uuid not null,
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'PENDING'
                   check (status in ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD')),
  attempts         int not null default 0,
  max_attempts     int not null default 10,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  locked_by        text,
  last_error       text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);
create index ix_outbox_ready on public.outbox (topic, next_attempt_at) where status in ('PENDING', 'FAILED', 'PROCESSING');
-- Việc chỉ được sinh một lần cho mỗi đối tượng
create unique index uq_outbox_dedupe on public.outbox (topic, aggregate_id)
  where topic in ('ISSUE_TICKETS', 'BOOKING_CONFIRM_ALERT', 'PROCESS_SESSION_REFUNDS', 'NOTIFY_SESSION_CANCELLED');

create or replace function public.enqueue(p_topic text, p_aggregate_type text, p_aggregate_id uuid,
                                          p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.outbox (topic, aggregate_type, aggregate_id, payload)
  values (p_topic, p_aggregate_type, p_aggregate_id, coalesce(p_payload, '{}'::jsonb))
  on conflict do nothing;
$$;

-- Worker (.NET, service_role) nhận việc: SKIP LOCKED để nhiều worker chạy song song;
-- việc kẹt PROCESSING quá 5 phút (worker chết) được nhận lại.
create or replace function public.claim_outbox(p_topic text, p_worker text, p_limit int default 20)
returns setof public.outbox
language sql
security definer
set search_path = ''
as $$
  update public.outbox o
     set status = 'PROCESSING', locked_at = now(), locked_by = p_worker, attempts = o.attempts + 1
   where o.id in (
     select id from public.outbox
      where topic = p_topic
        and next_attempt_at <= now()
        and (status in ('PENDING', 'FAILED')
             or (status = 'PROCESSING' and locked_at < now() - interval '5 minutes'))
      order by id
      limit p_limit
      for update skip locked)
  returning o.*;
$$;

-- Báo kết quả: lỗi thì thử lại với backoff 30s, 1m, 2m... tối đa 1 giờ; quá max_attempts thì DEAD.
create or replace function public.complete_outbox(p_id bigint, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outbox
     set status = case when p_error is null then 'DONE'
                       when attempts >= max_attempts then 'DEAD'
                       else 'FAILED' end,
         processed_at = case when p_error is null then now() end,
         last_error = p_error,
         next_attempt_at = now() + least(interval '30 seconds' * power(2, greatest(attempts - 1, 0)), interval '1 hour'),
         locked_at = null, locked_by = null
   where id = p_id and status = 'PROCESSING';
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
create or replace function public.can_view_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (
        b.user_id = (select auth.uid())
        or b.created_by = (select auth.uid())
        or public.has_org_role(b.tenant_id, array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER'])
        or (b.corporate_account_id is not null and public.is_corporate_member(b.corporate_account_id, array['ADMIN']))
        or public.has_platform_role(array['SUPPORT','FINANCE_ADMIN','DISPUTE_ADMIN'])
      )
  );
$$;
grant execute on function public.can_view_booking(uuid) to anon, authenticated;

alter table public.bookings           enable row level security;
alter table public.booking_items      enable row level security;
alter table public.payments           enable row level security;
alter table public.signing_keys       enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_credentials enable row level security;
alter table public.outbox             enable row level security;  -- không policy: chỉ server

create policy bookings_read on public.bookings for select
  using (
    user_id = (select auth.uid())
    or created_by = (select auth.uid())
    or public.has_org_role(tenant_id, array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER'])
    or (corporate_account_id is not null and public.is_corporate_member(corporate_account_id, array['ADMIN']))
    or public.has_platform_role(array['SUPPORT','FINANCE_ADMIN','DISPUTE_ADMIN'])
  );
create policy booking_items_read on public.booking_items for select
  using (public.can_view_booking(booking_id));
create policy payments_read on public.payments for select
  using (public.can_view_booking(booking_id));

create policy signing_keys_read on public.signing_keys for select using (true);

create policy tickets_read on public.tickets for select
  using (owner_id = (select auth.uid()) or public.can_view_booking(booking_id));

-- Chủ vé; hoặc Staff đã bán vé POS cho khách vãng lai (in / hiển thị QR tại cổng)
create policy ticket_credentials_read on public.ticket_credentials for select
  using (exists (
    select 1 from public.tickets t
    join public.bookings b on b.id = t.booking_id
    where t.id = ticket_credentials.ticket_id
      and (t.owner_id = (select auth.uid())
           or (b.booking_type = 'POS' and b.user_id is null and b.sold_by = (select auth.uid())))
  ));


-- ############################################################################
-- PHẦN 8 (0800) · gate_staff
-- ############################################################################

-- ============================================================================
-- 0800 · Staff và vận hành cổng   (chủ: Lâm Phước - scan; Đinh Khôi - phân công)
--
-- Giải quyết "Staff mờ nhạt": Staff là một vai trò hoàn chỉnh, gồm
--   1. Vai trò trong Org (memberships.roles):
--        SCANNER       soát vé
--        POS           bán vé tại cổng
--        GATE_MANAGER  quản lý cổng: phân công, thu hồi thiết bị, duyệt check-in
--                      thủ công vượt ngưỡng, xem lưu lượng
--   2. Workspace STAFF riêng (app Staff), đăng nhập chung với các vai trò khác
--   3. Phân công theo Session + cổng + quyền + khung giờ (staff_assignments);
--      không được phân công thì không quét được, kể cả là thành viên Org
--   4. Thiết bị soát vé đăng ký, thu hồi từ xa được (gate_devices)
--   5. Mọi lượt quét (online, offline, thủ công) ghi vào scan_logs bất biến,
--      truy được ai quét, ở cổng nào, thiết bị nào, lúc nào
--   6. Doanh số POS gắn với Staff qua bookings.sold_by
-- ============================================================================

-- Cổng nào cho vào Zone nào, theo từng Session
create table public.session_gate_zones (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  gate_id     uuid not null references public.gates (id),
  zone_id     uuid not null references public.zones (id),
  tenant_id   uuid not null,
  primary key (session_id, gate_id, zone_id)
);

create table public.staff_assignments (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  session_id         uuid not null,
  user_id            uuid not null references public.profiles (id),
  gate_id            uuid references public.gates (id),  -- null = mọi cổng của Session
  permissions        text[] not null,
  valid_from         timestamptz not null,
  valid_until        timestamptz not null,
  status             text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  assigned_by        uuid not null references public.profiles (id),
  revoked_by         uuid references public.profiles (id),
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (session_id, tenant_id) references public.sessions (id, tenant_id) on delete cascade,
  check (cardinality(permissions) > 0
         and permissions <@ array['SCAN','MANUAL_CHECKIN','POS','VIEW_ANALYTICS']::text[]),
  check (valid_until > valid_from)
);
create index ix_staff_assignments_user on public.staff_assignments (user_id, session_id) where status = 'ACTIVE';
create index ix_staff_assignments_session on public.staff_assignments (session_id);
create trigger trg_staff_assignments_updated before update on public.staff_assignments
  for each row execute function public.tg_set_updated_at();

create table public.gate_devices (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.organizations (id),
  device_fingerprint  text not null,
  name                text not null,
  platform            text not null check (platform in ('ANDROID', 'IOS')),
  registered_by       uuid not null references public.profiles (id),
  status              text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  revoked_by          uuid references public.profiles (id),
  revoked_at          timestamptz,
  revoke_reason       text,
  last_seen_at        timestamptz,
  last_sync_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (tenant_id, device_fingerprint)
);

alter table public.tickets
  add constraint tickets_used_device_fk foreign key (used_device_id) references public.gate_devices (id);

create table public.scan_logs (
  id                  bigint generated always as identity primary key,
  tenant_id           uuid not null,
  session_id          uuid not null references public.sessions (id),
  ticket_id           uuid references public.tickets (id),
  gate_id             uuid references public.gates (id),
  device_id           uuid references public.gate_devices (id),
  staff_id            uuid not null references public.profiles (id),
  mode                text not null check (mode in ('ONLINE', 'OFFLINE', 'MANUAL')),
  result              text not null check (result in ('OK', 'ALREADY_USED', 'WRONG_SESSION', 'WRONG_ZONE',
                                                       'REVOKED', 'INVALID_SIGNATURE', 'OUTSIDE_TIME',
                                                       'DUPLICATE_ENTRY')),
  scanned_at          timestamptz not null,  -- giờ trên thiết bị (First Write Wins theo cột này)
  received_at         timestamptz not null default now(),
  client_scan_id      text,  -- idempotency khi đồng bộ log offline
  details             jsonb not null default '{}'::jsonb,
  unique (device_id, client_scan_id)
);
create index ix_scan_logs_session on public.scan_logs (session_id, scanned_at);
create index ix_scan_logs_ticket on public.scan_logs (ticket_id);
create index ix_scan_logs_staff_manual on public.scan_logs (staff_id, received_at) where mode = 'MANUAL';
create trigger trg_scan_logs_immutable before update or delete on public.scan_logs
  for each row execute function public.tg_immutable();

-- Staff có đang được phân công cho Session (và cổng) với quyền này không
create or replace function public.has_staff_permission(p_session_id uuid, p_permission text,
                                                       p_gate_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments a
    join public.memberships m
      on m.user_id = a.user_id and m.org_id = a.tenant_id and m.status = 'ACTIVE'
     and m.roles && array['SCANNER','POS','GATE_MANAGER']::text[]
    where a.session_id = p_session_id
      and a.user_id = (select auth.uid())
      and a.status = 'ACTIVE'
      and now() between a.valid_from and a.valid_until
      and p_permission = any (a.permissions)
      and (p_gate_id is null or a.gate_id is null or a.gate_id = p_gate_id)
  );
$$;
grant execute on function public.has_staff_permission(uuid, text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.session_gate_zones enable row level security;
alter table public.staff_assignments  enable row level security;
alter table public.gate_devices       enable row level security;
alter table public.scan_logs          enable row level security;

create policy session_gate_zones_read on public.session_gate_zones for select
  using (public.is_org_member(tenant_id) or public.has_platform_role());

create policy staff_assignments_read on public.staff_assignments for select
  using (
    user_id = (select auth.uid())
    or public.has_org_role(tenant_id, array['OWNER','EVENT_MANAGER','GATE_MANAGER'])
    or public.has_platform_role()
  );

create policy gate_devices_read on public.gate_devices for select
  using (
    registered_by = (select auth.uid())
    or public.has_org_role(tenant_id, array['OWNER','GATE_MANAGER'])
    or public.has_platform_role()
  );

create policy scan_logs_read on public.scan_logs for select
  using (
    staff_id = (select auth.uid())
    or public.has_org_role(tenant_id, array['OWNER','EVENT_MANAGER','GATE_MANAGER'])
    or public.has_platform_role()
  );


-- ############################################################################
-- PHẦN 9 (0900) · cancellation_refund
-- ############################################################################

-- ============================================================================
-- 0900 · Duyệt hai người, hủy Session, hoàn tiền, chargeback
--        (chủ: Đinh Khôi - luồng hủy; Lâm Phước - refund engine)
--
-- Giải quyết "lỡ sự kiện bị hủy":
--   1. Org (OWNER) hoặc Admin gọi request_session_cancellation()
--      -> Session bị dừng bán NGAY (sales_paused), tạo yêu cầu + phiếu duyệt
--   2. Hai Admin khác nhau duyệt (approvals / approval_votes)
--   3. execute_session_cancellation(): Session CANCELLED, vé sang REFUND_PENDING,
--      tạo Refund 100% cho từng Booking, vé 0đ thì VOID
--   4. Worker hoàn tiền qua cổng (idempotency key = refund.id); khi hoàn xong
--      mới gửi thông báo cho khách
--   Hủy cả Event = hủy lần lượt từng Session (request_event_cancellation).
--
-- approvals, refunds, chargebacks là bảng cấp nền tảng (tài liệu mục 1.1): không có
-- tenant_id; org_id chỉ để Org xem phần liên quan đến mình.
-- ============================================================================

create table public.approvals (
  id              uuid primary key default gen_random_uuid(),
  -- ORG_SUSPENSION: đình chỉ / gỡ đình chỉ / chấm dứt Org (payload.action)
  subject_type    text not null check (subject_type in ('SESSION_CANCELLATION', 'PAYOUT', 'REFUND_MANUAL',
                                                         'ORG_SUSPENSION', 'HOLD_RELEASE', 'MANUAL_TRANSFER')),
  subject_id      uuid not null,
  org_id          uuid references public.organizations (id),
  required_votes  int not null default 2 check (required_votes between 1 and 5),
  status          text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by    uuid not null references public.profiles (id),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
create unique index uq_approvals_open_subject on public.approvals (subject_type, subject_id) where status = 'PENDING';
create trigger trg_approvals_status before update of status on public.approvals
  for each row execute function public.tg_guard_status('{"PENDING": ["APPROVED", "REJECTED", "CANCELLED"]}');

create table public.approval_votes (
  approval_id  uuid not null references public.approvals (id) on delete cascade,
  voter_id     uuid not null references public.profiles (id),
  decision     text not null check (decision in ('APPROVE', 'REJECT')),
  note         text,
  created_at   timestamptz not null default now(),
  primary key (approval_id, voter_id)  -- mỗi Admin chỉ bỏ một phiếu: hai phiếu = hai người khác nhau
);
create trigger trg_approval_votes_immutable before update or delete on public.approval_votes
  for each row execute function public.tg_immutable();

create table public.session_change_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  session_id    uuid not null,
  change_type   text not null check (change_type in ('CANCEL', 'POSTPONE')),  -- POSTPONE: P1
  origin        text not null check (origin in ('ORG', 'PLATFORM')),
  reason        text not null,
  status        text not null default 'REQUESTED'
                check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTED')),
  approval_id   uuid references public.approvals (id),
  requested_by  uuid not null references public.profiles (id),
  executed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (session_id, tenant_id) references public.sessions (id, tenant_id)
);
create unique index uq_session_change_open on public.session_change_requests (session_id)
  where status in ('REQUESTED', 'APPROVED');
create trigger trg_session_change_requests_updated before update on public.session_change_requests
  for each row execute function public.tg_set_updated_at();
create trigger trg_session_change_requests_status before update of status on public.session_change_requests
  for each row execute function public.tg_guard_status('{"REQUESTED": ["APPROVED", "REJECTED"], "APPROVED": ["EXECUTED"]}');

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),  -- = idempotency key gửi sang cổng
  org_id             uuid not null references public.organizations (id),
  booking_id         uuid not null references public.bookings (id),
  payment_id         uuid references public.payments (id),
  amount             bigint not null check (amount > 0),
  reason             text not null check (reason in ('SESSION_CANCELLED', 'LATE_PAYMENT_NO_SEAT', 'DISPUTE',
                                                     'MANUAL', 'DUPLICATE_PAYMENT', 'CUSTOMER_REQUEST')),
  source_type        text,  -- SESSION_CHANGE_REQUEST, DISPUTE_CASE, PAYMENT...
  source_id          uuid,
  status             text not null default 'REQUESTED'
                     check (status in ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED',
                                       'AWAITING_BANK_INFO', 'MANUAL_TRANSFER')),
  gateway_refund_id  text unique,
  attempts           int not null default 0,
  last_error         text,
  approval_id        uuid references public.approvals (id),
  requested_by       uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  succeeded_at       timestamptz
);
create index ix_refunds_booking on public.refunds (booking_id);
create index ix_refunds_status on public.refunds (status, created_at);
create index ix_refunds_org on public.refunds (org_id, created_at desc);
create trigger trg_refunds_updated before update on public.refunds
  for each row execute function public.tg_set_updated_at();
-- SRS 3.6. Worker chuyển REQUESTED -> PROCESSING trước khi gọi cổng (start_refund_processing);
-- hoàn về phương thức gốc bị từ chối -> AWAITING_BANK_INFO -> MANUAL_TRANSFER -> SUCCEEDED.
create trigger trg_refunds_status before update of status on public.refunds
  for each row execute function public.tg_guard_status('{
    "REQUESTED":          ["PROCESSING"],
    "PROCESSING":         ["SUCCEEDED", "FAILED", "AWAITING_BANK_INFO"],
    "FAILED":             ["PROCESSING", "AWAITING_BANK_INFO"],
    "AWAITING_BANK_INFO": ["MANUAL_TRANSFER"],
    "MANUAL_TRANSFER":    ["SUCCEEDED"]}');

create table public.refund_items (
  refund_id  uuid not null references public.refunds (id) on delete cascade,
  ticket_id  uuid not null references public.tickets (id),
  amount     bigint not null check (amount >= 0),
  primary key (refund_id, ticket_id)
);
create index ix_refund_items_ticket on public.refund_items (ticket_id);

-- Hoàn về phương thức gốc bị từ chối -> thu tài khoản ngân hàng của khách (OTP)
create table public.refund_bank_infos (
  refund_id       uuid primary key references public.refunds (id) on delete cascade,
  bank_code       text not null,
  account_number  text not null,
  account_holder  text not null,
  submitted_by    uuid not null references public.profiles (id),
  otp_verified_at timestamptz,
  transferred_by  uuid references public.profiles (id),
  transferred_at  timestamptz,
  transfer_ref    text,
  created_at      timestamptz not null default now()
);

-- Chargeback xử lý thủ công ở P0 (FR-CBK-01/03): Admin ghi nhận, vé VOID, bút toán trừ Org
create table public.chargebacks (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  payment_id       uuid not null references public.payments (id),
  booking_id       uuid not null references public.bookings (id),
  gateway_case_id  text unique,
  amount           bigint not null check (amount > 0),
  reason           text,
  status           text not null default 'OPEN' check (status in ('OPEN', 'ACCEPTED', 'WON', 'LOST')),
  recorded_by      uuid not null references public.profiles (id),
  resolution_note  text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index ix_chargebacks_org on public.chargebacks (org_id, status);
create trigger trg_chargebacks_status before update of status on public.chargebacks
  for each row execute function public.tg_guard_status('{"OPEN": ["ACCEPTED", "WON", "LOST"]}');

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.approvals               enable row level security;
alter table public.approval_votes          enable row level security;
alter table public.session_change_requests enable row level security;
alter table public.refunds                 enable row level security;
alter table public.refund_items            enable row level security;
alter table public.refund_bank_infos       enable row level security;
alter table public.chargebacks             enable row level security;

create policy approvals_read on public.approvals for select
  using (public.has_platform_role()
         or (org_id is not null and public.has_org_role(org_id, array['OWNER'])));
create policy approval_votes_read on public.approval_votes for select
  using (public.has_platform_role());

create policy session_change_requests_read on public.session_change_requests for select
  using (public.has_org_role(tenant_id, array['OWNER','EVENT_MANAGER','FINANCE']) or public.has_platform_role());

create policy refunds_read on public.refunds for select
  using (public.can_view_booking(booking_id));
create policy refund_items_read on public.refund_items for select
  using (exists (select 1 from public.refunds r
                 where r.id = refund_items.refund_id and public.can_view_booking(r.booking_id)));
create policy refund_bank_infos_read on public.refund_bank_infos for select
  using (submitted_by = (select auth.uid()) or public.has_platform_role(array['FINANCE_ADMIN']));

create policy chargebacks_read on public.chargebacks for select
  using (public.has_org_role(org_id, array['OWNER','FINANCE'])
         or public.has_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN']));


-- ############################################################################
-- PHẦN 10 (1000) · ledger_settlement_payout
-- ############################################################################

-- ============================================================================
-- 1000 · Sổ cái kép, Platform Fee, đối soát, payout   (chủ: Đinh Khôi)
--
-- Nguyên tắc (tài liệu mục 20.7):
--   * Mỗi sự kiện tài chính là một ledger_transaction gồm nhiều ledger_entries;
--     tổng Nợ = tổng Có, kiểm tra ở cuối transaction (constraint trigger).
--   * Không UPDATE/DELETE bút toán; sửa sai bằng bút toán đảo (reversal_of).
--   * Mỗi (kind, reference) chỉ ghi một lần: IPN trùng không ghi hai bút toán.
--   * Sổ cái là dữ liệu cấp nền tảng (tài liệu mục 1.1): không có tenant_id, chỉ
--     có org_id để Org xem phần của mình. settlements, fund_holds, payouts là dữ
--     liệu cấp tenant (Payout) nên giữ tenant_id.
--   * Số dư luôn tính từ bút toán, không tính từ bảng Booking.
--
-- Tài khoản chuẩn:
--   PLATFORM:GATEWAY_CLEARING  tài sản  tiền đang nằm ở đối tác thanh toán (escrow)
--   PLATFORM:FEE_REVENUE       doanh thu Platform Fee
--   PLATFORM:REFUND_PAYABLE    nợ phải hoàn cho khách (trả muộn không còn ghế...)
--   PLATFORM:CHARGEBACK_LOSS   chi phí chargeback nền tảng gánh
--   ORG:<org_id>:PAYABLE       nợ phải trả cho Org
-- ============================================================================

create table public.ledger_accounts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  account_type  text not null check (account_type in ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE')),
  owner_type    text not null check (owner_type in ('PLATFORM', 'ORG')),
  org_id        uuid references public.organizations (id),
  created_at    timestamptz not null default now(),
  check ((owner_type = 'ORG') = (org_id is not null))
);

insert into public.ledger_accounts (code, name, account_type, owner_type) values
  ('PLATFORM:GATEWAY_CLEARING', 'Tiền tại đối tác thanh toán', 'ASSET',     'PLATFORM'),
  ('PLATFORM:FEE_REVENUE',      'Doanh thu Platform Fee',      'REVENUE',   'PLATFORM'),
  ('PLATFORM:REFUND_PAYABLE',   'Phải hoàn cho khách',         'LIABILITY', 'PLATFORM'),
  ('PLATFORM:CHARGEBACK_LOSS',  'Tổn thất chargeback',         'EXPENSE',   'PLATFORM');

create table public.ledger_transactions (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('PAYMENT_CAPTURED', 'REFUND_ISSUED', 'CHARGEBACK',
                                                'PAYOUT_SENT', 'FEE_ADJUSTMENT', 'REVERSAL')),
  org_id          uuid references public.organizations (id),  -- Org liên quan (không phải tenant)
  session_id      uuid references public.sessions (id),
  reference_type  text not null,  -- PAYMENT, REFUND, CHARGEBACK, PAYOUT...
  reference_id    uuid not null,
  reversal_of     uuid references public.ledger_transactions (id),
  memo            text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (kind, reference_type, reference_id)
);
create index ix_ledger_transactions_session on public.ledger_transactions (session_id);
create index ix_ledger_transactions_org on public.ledger_transactions (org_id, created_at);
create trigger trg_ledger_transactions_immutable before update or delete on public.ledger_transactions
  for each row execute function public.tg_immutable();

create table public.ledger_entries (
  id              bigint generated always as identity primary key,
  transaction_id  uuid not null references public.ledger_transactions (id),
  account_id      uuid not null references public.ledger_accounts (id),
  direction       text not null check (direction in ('DEBIT', 'CREDIT')),
  amount          bigint not null check (amount > 0),
  created_at      timestamptz not null default now()
);
create index ix_ledger_entries_tx on public.ledger_entries (transaction_id);
create index ix_ledger_entries_account on public.ledger_entries (account_id, created_at);
create trigger trg_ledger_entries_immutable before update or delete on public.ledger_entries
  for each row execute function public.tg_immutable();

create or replace function public.tg_ledger_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diff bigint;
begin
  select coalesce(sum(case when direction = 'DEBIT' then amount else -amount end), 0)
    into v_diff
  from public.ledger_entries
  where transaction_id = new.transaction_id;

  if v_diff <> 0 then
    raise exception using message = 'LEDGER_UNBALANCED', errcode = 'P0001',
      detail = jsonb_build_object('transaction_id', new.transaction_id, 'diff', v_diff)::text;
  end if;
  return null;
end;
$$;
create constraint trigger trg_ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.tg_ledger_balanced();

-- Số dư (dương = số dư theo bản chất tài khoản)
create view public.ledger_account_balances
with (security_invoker = true) as
  select a.id as account_id, a.code, a.owner_type, a.org_id, a.account_type,
         coalesce(sum(case when e.direction = 'DEBIT' then e.amount else 0 end), 0) as debit_total,
         coalesce(sum(case when e.direction = 'CREDIT' then e.amount else 0 end), 0) as credit_total,
         case when a.account_type in ('ASSET', 'EXPENSE')
              then coalesce(sum(case when e.direction = 'DEBIT' then e.amount else -e.amount end), 0)
              else coalesce(sum(case when e.direction = 'CREDIT' then e.amount else -e.amount end), 0)
         end as balance
  from public.ledger_accounts a
  left join public.ledger_entries e on e.account_id = a.id
  group by a.id;

-- Tài khoản phải trả của một Org (tự tạo nếu chưa có)
create or replace function public.org_payable_account(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := 'ORG:' || p_org_id::text || ':PAYABLE';
begin
  insert into public.ledger_accounts (code, name, account_type, owner_type, org_id)
  values (v_code, 'Phải trả Org', 'LIABILITY', 'ORG', p_org_id)
  on conflict (code) do nothing;
  return v_code;
end;
$$;

-- Ghi một bút toán. Idempotent theo (kind, reference_type, reference_id).
-- p_lines: [{"account_code": "...", "direction": "DEBIT|CREDIT", "amount": 123}]
create or replace function public.post_ledger_transaction(
  p_kind text, p_org_id uuid, p_session_id uuid,
  p_reference_type text, p_reference_id uuid, p_lines jsonb, p_memo text default null,
  p_reversal_of uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expected int;
  v_inserted int;
begin
  select id into v_id from public.ledger_transactions
  where kind = p_kind and reference_type = p_reference_type and reference_id = p_reference_id;
  if found then
    return v_id;
  end if;

  insert into public.ledger_transactions (kind, org_id, session_id, reference_type, reference_id, memo, reversal_of, created_by)
  values (p_kind, p_org_id, p_session_id, p_reference_type, p_reference_id, p_memo, p_reversal_of, auth.uid())
  returning id into v_id;

  select count(*) into v_expected
  from jsonb_to_recordset(p_lines) l(account_code text, direction text, amount bigint)
  where l.amount > 0;

  insert into public.ledger_entries (transaction_id, account_id, direction, amount)
  select v_id, a.id, l.direction, l.amount
  from jsonb_to_recordset(p_lines) l(account_code text, direction text, amount bigint)
  join public.ledger_accounts a on a.code = l.account_code
  where l.amount > 0;
  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected or v_inserted < 2 then
    perform public.app_error('LEDGER_INVALID_LINES', jsonb_build_object('expected', v_expected, 'inserted', v_inserted));
  end if;
  return v_id;
end;
$$;

-- Lần tính Platform Fee nào cũng lưu đầu vào, phiên bản công thức và kết quả
create table public.platform_fee_calculations (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null unique references public.bookings (id),
  org_id           uuid not null,
  contract_id      uuid references public.org_fee_contracts (id),
  formula_version  text not null,
  inputs           jsonb not null,
  fee_amount       bigint not null check (fee_amount >= 0),
  created_at       timestamptz not null default now()
);
create trigger trg_platform_fee_calculations_immutable before update or delete on public.platform_fee_calculations
  for each row execute function public.tg_immutable();

-- ----------------------------------------------------------------------------
-- Đối soát theo Session, tạm giữ, payout
-- ----------------------------------------------------------------------------
create table public.settlements (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  session_id         uuid not null unique,
  status             text not null default 'OPEN'
                     check (status in ('OPEN', 'ON_HOLD', 'READY', 'PAID_OUT', 'CLOSED')),
  cutoff_at          timestamptz,  -- ends_at + thời hạn khiếu nại
  gross_amount       bigint not null default 0,
  refund_amount      bigint not null default 0,
  chargeback_amount  bigint not null default 0,
  fee_amount         bigint not null default 0,
  net_amount         bigint not null default 0,
  report             jsonb not null default '{}'::jsonb,
  computed_at        timestamptz,
  computed_by        uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (session_id, tenant_id) references public.sessions (id, tenant_id)
);
create trigger trg_settlements_updated before update on public.settlements
  for each row execute function public.tg_set_updated_at();
-- OPEN: chưa tới cutoff; ON_HOLD: có Dispute/hold; READY: đủ điều kiện payout;
-- PAID_OUT: đã chi; CLOSED: không còn gì để chi (net = 0)
create trigger trg_settlements_status before update of status on public.settlements
  for each row execute function public.tg_guard_status('{
    "OPEN":     ["ON_HOLD", "READY", "CLOSED"],
    "ON_HOLD":  ["OPEN", "READY", "CLOSED"],
    "READY":    ["ON_HOLD", "PAID_OUT", "CLOSED"],
    "PAID_OUT": ["CLOSED"]}');

create table public.fund_holds (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.organizations (id),
  scope                text not null check (scope in ('SESSION', 'ORG_BALANCE')),
  session_id           uuid references public.sessions (id),
  reason               text not null,
  dispute_case_id      uuid,  -- FK thêm ở migration 1100
  status               text not null default 'ACTIVE' check (status in ('ACTIVE', 'RELEASED')),
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  released_at          timestamptz,
  release_approval_id  uuid references public.approvals (id),
  check (scope <> 'SESSION' or session_id is not null)
);
create index ix_fund_holds_active on public.fund_holds (tenant_id, session_id) where status = 'ACTIVE';

create table public.payouts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.organizations (id),
  bank_account_id     uuid not null references public.org_bank_accounts (id),
  amount              bigint not null check (amount > 0),
  status              text not null default 'PROPOSED'
                      check (status in ('PROPOSED', 'APPROVED', 'SENT', 'CONFIRMED', 'FAILED', 'CANCELLED')),
  approval_id         uuid references public.approvals (id),
  gateway_payout_ref  text unique,
  proposed_by         uuid references public.profiles (id),
  failure_reason      text,
  sent_at             timestamptz,
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index ix_payouts_tenant on public.payouts (tenant_id, created_at desc);
create trigger trg_payouts_updated before update on public.payouts
  for each row execute function public.tg_set_updated_at();
-- Duyệt hai người (approvals) -> APPROVED; lệnh chi -> SENT; cổng xác nhận -> CONFIRMED (ghi sổ cái)
create trigger trg_payouts_status before update of status on public.payouts
  for each row execute function public.tg_guard_status('{
    "PROPOSED": ["APPROVED", "CANCELLED"],
    "APPROVED": ["SENT", "CANCELLED"],
    "SENT":     ["CONFIRMED", "FAILED"],
    "FAILED":   ["SENT", "CANCELLED"]}');

-- Settlement có net âm (hoàn/chargeback sau payout) được bù trừ vào payout kỳ sau
create table public.payout_items (
  payout_id      uuid not null references public.payouts (id) on delete cascade,
  settlement_id  uuid not null unique references public.settlements (id),
  amount         bigint not null check (amount <> 0),
  primary key (payout_id, settlement_id)
);

-- File đối soát hằng ngày của cổng
create table public.gateway_statement_lines (
  id              uuid primary key default gen_random_uuid(),
  gateway         text not null,
  statement_date  date not null,
  txn_type        text not null check (txn_type in ('PAYMENT', 'REFUND', 'PAYOUT', 'CHARGEBACK')),
  gateway_txn_id  text not null,
  amount          bigint not null,
  payment_id      uuid references public.payments (id),
  refund_id       uuid references public.refunds (id),
  match_status    text not null default 'UNMATCHED'
                  check (match_status in ('UNMATCHED', 'MATCHED', 'MISSING_IN_SYSTEM', 'AMOUNT_MISMATCH')),
  raw             jsonb,
  imported_at     timestamptz not null default now(),
  unique (gateway, txn_type, gateway_txn_id)
);

-- ----------------------------------------------------------------------------
-- RLS: Org xem phần của mình (OWNER, FINANCE); Admin tài chính xem tất cả
-- ----------------------------------------------------------------------------
alter table public.ledger_accounts           enable row level security;
alter table public.ledger_transactions       enable row level security;
alter table public.ledger_entries            enable row level security;
alter table public.platform_fee_calculations enable row level security;
alter table public.settlements               enable row level security;
alter table public.fund_holds                enable row level security;
alter table public.payouts                   enable row level security;
alter table public.payout_items              enable row level security;
alter table public.gateway_statement_lines   enable row level security;

create policy ledger_accounts_read on public.ledger_accounts for select
  using (public.has_platform_role(array['FINANCE_ADMIN'])
         or (org_id is not null and public.has_org_role(org_id, array['OWNER','FINANCE'])));
create policy ledger_transactions_read on public.ledger_transactions for select
  using (public.has_platform_role(array['FINANCE_ADMIN'])
         or (org_id is not null and public.has_org_role(org_id, array['OWNER','FINANCE'])));
create policy ledger_entries_read on public.ledger_entries for select
  using (exists (select 1 from public.ledger_accounts a
                 where a.id = ledger_entries.account_id
                   and (public.has_platform_role(array['FINANCE_ADMIN'])
                        or (a.org_id is not null and public.has_org_role(a.org_id, array['OWNER','FINANCE'])))));
create policy platform_fee_calculations_read on public.platform_fee_calculations for select
  using (public.has_platform_role(array['FINANCE_ADMIN']) or public.has_org_role(org_id, array['OWNER','FINANCE']));
create policy settlements_read on public.settlements for select
  using (public.has_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN'])
         or public.has_org_role(tenant_id, array['OWNER','FINANCE']));
create policy fund_holds_read on public.fund_holds for select
  using (public.has_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN'])
         or public.has_org_role(tenant_id, array['OWNER','FINANCE']));
create policy payouts_read on public.payouts for select
  using (public.has_platform_role(array['FINANCE_ADMIN']) or public.has_org_role(tenant_id, array['OWNER','FINANCE']));
create policy payout_items_read on public.payout_items for select
  using (exists (select 1 from public.payouts p where p.id = payout_items.payout_id
                 and (public.has_platform_role(array['FINANCE_ADMIN'])
                      or public.has_org_role(p.tenant_id, array['OWNER','FINANCE']))));
create policy gateway_statement_lines_read on public.gateway_statement_lines for select
  using (public.has_platform_role(array['FINANCE_ADMIN']));

grant select on public.ledger_account_balances to authenticated;


-- ############################################################################
-- PHẦN 11 (1100) · reports_disputes_support
-- ############################################################################

-- ============================================================================
-- 1100 · Report, Dispute Case, hỗ trợ khách hàng   (chủ: Đinh Khôi)
--
-- Giải quyết "khách gặp vấn đề thì ghi nhận ở đâu, ai tiếp nhận":
--   Kênh 1 · Report (submit_report): vấn đề VỀ SỰ KIỆN (không đúng mô tả,
--            không diễn ra, bị từ chối vào cổng, mất an toàn, sai ghế).
--            Chỉ người có vé của Session mới gửi được, trong REPORT_WINDOW.
--            Report của cùng một Session gom vào MỘT Dispute Case.
--            Tiếp nhận: Admin vai trò DISPUTE_ADMIN (portal Admin > Dispute),
--            Org được thông báo và phản hồi trong dispute_messages.
--            Đủ ngưỡng Report -> tạm giữ tiền của Session (fund_holds).
--            Kết luận có thể tạo Refund toàn phần hoặc một phần.
--   Kênh 2 · Yêu cầu hỗ trợ (create_support_request): vấn đề VỀ ĐƠN / TIỀN /
--            TÀI KHOẢN (trừ tiền mà chưa có vé, không thấy vé, lỗi app...).
--            Tiếp nhận: Admin vai trò SUPPORT (portal Admin > Hỗ trợ).
-- Report và Dispute Case là dữ liệu cấp nền tảng (tài liệu mục 1.1): không có
-- tenant_id; org_id là Org của Session bị khiếu nại, để Org xem và phản hồi.
-- ============================================================================

create table public.dispute_cases (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id),
  session_id            uuid not null,
  status                text not null default 'OPEN'
                        check (status in ('OPEN', 'UNDER_REVIEW', 'AWAITING_ORG', 'RESOLVED', 'DISMISSED', 'APPEALED')),
  report_count          int not null default 0,
  threshold_reached_at  timestamptz,
  assigned_admin_id     uuid references public.profiles (id),
  org_response_due_at   timestamptz,
  resolution            text check (resolution in ('FULL_REFUND', 'PARTIAL_REFUND', 'NO_ACTION')),
  refund_percent_bp     int check (refund_percent_bp between 0 and 10000),
  resolution_note       text,
  resolved_by           uuid references public.profiles (id),
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (session_id, org_id) references public.sessions (id, tenant_id)
);
-- Mỗi Session chỉ có một case đang mở
create unique index uq_dispute_open_per_session on public.dispute_cases (session_id)
  where status in ('OPEN', 'UNDER_REVIEW', 'AWAITING_ORG', 'APPEALED');
create trigger trg_dispute_cases_updated before update on public.dispute_cases
  for each row execute function public.tg_set_updated_at();
-- Hold theo Session; APPEALED (khiếu nại lại) là P1 nhưng trạng thái có sẵn
create trigger trg_dispute_cases_status before update of status on public.dispute_cases
  for each row execute function public.tg_guard_status('{
    "OPEN":         ["UNDER_REVIEW", "AWAITING_ORG", "RESOLVED", "DISMISSED"],
    "AWAITING_ORG": ["UNDER_REVIEW", "RESOLVED", "DISMISSED"],
    "UNDER_REVIEW": ["AWAITING_ORG", "RESOLVED", "DISMISSED"],
    "RESOLVED":     ["APPEALED"],
    "DISMISSED":    ["APPEALED"],
    "APPEALED":     ["UNDER_REVIEW", "AWAITING_ORG", "RESOLVED", "DISMISSED"]}');

alter table public.fund_holds
  add constraint fund_holds_dispute_fk foreign key (dispute_case_id) references public.dispute_cases (id);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  session_id       uuid not null references public.sessions (id),
  ticket_id        uuid not null references public.tickets (id),
  reporter_id      uuid not null references public.profiles (id),
  category         text not null check (category in ('NOT_AS_DESCRIBED', 'EVENT_NOT_HELD', 'ENTRY_DENIED',
                                                     'SAFETY', 'SEAT_ISSUE', 'OTHER')),
  description      text not null check (length(description) >= 10),
  status           text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'IN_CASE', 'CLOSED')),
  dispute_case_id  uuid references public.dispute_cases (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (ticket_id, category)  -- một vé không gửi trùng một loại vấn đề
);
create index ix_reports_case on public.reports (dispute_case_id);
create index ix_reports_reporter on public.reports (reporter_id, created_at desc);
create trigger trg_reports_updated before update on public.reports
  for each row execute function public.tg_set_updated_at();

create table public.report_attachments (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.reports (id) on delete cascade,
  org_id        uuid not null,
  storage_path  text not null,  -- bucket report-evidence, dạng <user_id>/<file>
  mime_type     text,
  created_at    timestamptz not null default now()
);

create table public.dispute_messages (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.dispute_cases (id) on delete cascade,
  org_id       uuid not null,
  author_id    uuid not null references public.profiles (id),
  author_side  text not null check (author_side in ('ORG', 'ADMIN')),
  body         text not null,
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index ix_dispute_messages_case on public.dispute_messages (case_id, created_at);
create trigger trg_dispute_messages_immutable before update or delete on public.dispute_messages
  for each row execute function public.tg_immutable();

create table public.support_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id),
  booking_id   uuid references public.bookings (id),
  org_id       uuid references public.organizations (id),
  category     text not null check (category in ('PAYMENT', 'TICKET', 'REFUND', 'ACCOUNT', 'APP_BUG', 'OTHER')),
  subject      text not null,
  status       text not null default 'OPEN'
               check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')),
  assigned_to  uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index ix_support_requests_status on public.support_requests (status, created_at);
create index ix_support_requests_user on public.support_requests (user_id, created_at desc);
create trigger trg_support_requests_updated before update on public.support_requests
  for each row execute function public.tg_set_updated_at();

create table public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.support_requests (id) on delete cascade,
  author_id    uuid not null references public.profiles (id),
  author_side  text not null check (author_side in ('CUSTOMER', 'SUPPORT')),
  body         text not null,
  created_at   timestamptz not null default now()
);
create index ix_support_messages_request on public.support_messages (request_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.dispute_cases      enable row level security;
alter table public.reports            enable row level security;
alter table public.report_attachments enable row level security;
alter table public.dispute_messages   enable row level security;
alter table public.support_requests   enable row level security;
alter table public.support_messages   enable row level security;

create policy reports_read on public.reports for select
  using (
    reporter_id = (select auth.uid())
    or public.has_org_role(org_id, array['OWNER','EVENT_MANAGER','FINANCE'])
    or public.has_platform_role(array['DISPUTE_ADMIN','SUPPORT'])
  );
create policy report_attachments_read on public.report_attachments for select
  using (exists (select 1 from public.reports r where r.id = report_attachments.report_id
                 and (r.reporter_id = (select auth.uid())
                      or public.has_org_role(r.org_id, array['OWNER','EVENT_MANAGER'])
                      or public.has_platform_role(array['DISPUTE_ADMIN']))));

create policy dispute_cases_read on public.dispute_cases for select
  using (
    public.has_org_role(org_id, array['OWNER','EVENT_MANAGER','FINANCE'])
    or public.has_platform_role(array['DISPUTE_ADMIN','SUPPORT','FINANCE_ADMIN'])
    or exists (select 1 from public.reports r
               where r.dispute_case_id = dispute_cases.id and r.reporter_id = (select auth.uid()))
  );
create policy dispute_messages_read on public.dispute_messages for select
  using (public.has_org_role(org_id, array['OWNER','EVENT_MANAGER'])
         or public.has_platform_role(array['DISPUTE_ADMIN']));

create policy support_requests_read on public.support_requests for select
  using (user_id = (select auth.uid()) or public.has_platform_role(array['SUPPORT']));
create policy support_messages_read on public.support_messages for select
  using (exists (select 1 from public.support_requests s where s.id = support_messages.request_id
                 and (s.user_id = (select auth.uid()) or public.has_platform_role(array['SUPPORT']))));


-- ############################################################################
-- PHẦN 12 (1200) · notifications_audit
-- ############################################################################

-- ============================================================================
-- 1200 · Thông báo, nhắc lịch, audit log   (chủ: Đinh Khôi)
-- ============================================================================

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  channel     text not null check (channel in ('IN_APP', 'EMAIL', 'PUSH')),
  template    text not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  status      text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'FAILED')),
  attempts    int not null default 0,
  last_error  text,
  -- Chống gửi trùng (vd. REMINDER_24H:<ticket_id>); null = không cần chống trùng
  dedupe_key  text unique,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  read_at     timestamptz
);
create index ix_notifications_user on public.notifications (user_id, created_at desc);
create index ix_notifications_queue on public.notifications (status, created_at) where status = 'QUEUED';

create table public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  token         text not null unique,
  platform      text not null check (platform in ('ANDROID', 'IOS', 'WEB')),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table public.notification_preferences (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  push_enabled   boolean not null default true,
  email_enabled  boolean not null default true,
  reminder_24h   boolean not null default true,
  reminder_2h    boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Nhắc lịch tùy chỉnh (giữ tính năng reminder của app cũ, đổi sang giờ Session)
create table public.user_reminders (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  session_id             uuid not null references public.sessions (id) on delete cascade,
  remind_before_minutes  int not null check (remind_before_minutes between 5 and 10080),
  enabled                boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (user_id, session_id, remind_before_minutes)
);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  actor_scope  text,  -- CUSTOMER / ORG / STAFF / ADMIN / SYSTEM
  action       text not null,  -- vd KYC.APPROVE, SESSION.CANCEL_REQUEST, CHECKIN.MANUAL, SECURITY.FORBIDDEN
  target_type  text,
  target_id    text,
  org_id       uuid,
  before       jsonb,
  after        jsonb,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index ix_audit_logs_org on public.audit_logs (org_id, created_at desc);
create index ix_audit_logs_target on public.audit_logs (target_type, target_id);
create trigger trg_audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.tg_immutable();

-- Chỉ RPC phía server ghi audit (client không có quyền insert)
create or replace function public.write_audit(
  p_action text, p_target_type text, p_target_id text, p_org_id uuid,
  p_before jsonb default null, p_after jsonb default null, p_meta jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, actor_scope, action, target_type, target_id, org_id, before, after, meta)
  values (
    auth.uid(),
    coalesce((select auth.jwt()) -> 'active_workspace' ->> 'kind', case when auth.uid() is null then 'SYSTEM' end),
    p_action, p_target_type, p_target_id, p_org_id, p_before, p_after, p_meta
  );
$$;

alter table public.notifications            enable row level security;
alter table public.device_tokens            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_reminders           enable row level security;
alter table public.audit_logs               enable row level security;

create policy notifications_read on public.notifications for select
  using (user_id = (select auth.uid()));

-- Dữ liệu cá nhân không mang nghiệp vụ: cho user tự ghi bản ghi của chính mình.
create policy device_tokens_own on public.device_tokens for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_own on public.notification_preferences for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_reminders_own on public.user_reminders for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_logs_read on public.audit_logs for select
  using (public.has_platform_role()
         or (org_id is not null and public.has_org_role(org_id, array['OWNER'])));


-- ############################################################################
-- PHẦN 13 (1300) · storage
-- ############################################################################

-- ============================================================================
-- 1300 · Storage buckets và policy
--   kyc-private      riêng tư; đường dẫn <org_id>/...; OWNER tải lên, KYC_REVIEWER xem
--   report-evidence  riêng tư; đường dẫn <user_id>/...; khách tải lên, DISPUTE_ADMIN xem
--   event-assets     công khai đọc; đường dẫn <org_id>/...; OWNER, EVENT_MANAGER tải lên
-- Client không cache ảnh giấy tờ KYC; portal dùng signed URL có thời hạn.
-- ============================================================================

create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function public.try_uuid(text) to anon, authenticated;

insert into storage.buckets (id, name, public) values
  ('kyc-private',     'kyc-private',     false),
  ('report-evidence', 'report-evidence', false),
  ('event-assets',    'event-assets',    true)
on conflict (id) do nothing;

create policy kyc_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-private'
              and public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['OWNER']));
create policy kyc_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc-private'
         and (public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['OWNER'])
              or public.has_platform_role(array['KYC_REVIEWER'])));

create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'report-evidence'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'report-evidence'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.has_platform_role(array['DISPUTE_ADMIN'])));

create policy event_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-assets'
              and public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['OWNER','EVENT_MANAGER']));
create policy event_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'event-assets'
         and public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['OWNER','EVENT_MANAGER']));
create policy event_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-assets'
         and public.has_org_role(public.try_uuid((storage.foldername(name))[1]), array['OWNER','EVENT_MANAGER']));


-- ############################################################################
-- PHẦN 14 (1400) · rpc_identity_org
-- ############################################################################

-- ============================================================================
-- 1400 · RPC: đăng nhập theo workspace, Org, thành viên, KYC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper kiểm tra quyền dùng ở đầu mọi RPC. Lần bị từ chối được ghi vào log
-- Postgres (raise log) vì audit_logs sẽ bị rollback cùng exception.
-- ----------------------------------------------------------------------------
create or replace function public.assert_authenticated()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    perform public.app_error('UNAUTHENTICATED');
  end if;
  return v_user;
end;
$$;

create or replace function public.assert_org_role(p_org_id uuid, p_roles text[], p_require_mfa boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
begin
  if p_org_id is null or not public.has_org_role(p_org_id, p_roles) then
    raise log 'SECURITY.FORBIDDEN user=% org=% roles=%', v_user, p_org_id, p_roles;
    perform public.app_error('FORBIDDEN');
  end if;
  if p_require_mfa and not public.is_aal2() then
    perform public.app_error('MFA_REQUIRED');
  end if;
  return v_user;
end;
$$;

create or replace function public.assert_platform_role(p_roles text[], p_require_mfa boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
begin
  if not public.has_platform_role(p_roles) then
    raise log 'SECURITY.FORBIDDEN user=% platform_roles=%', v_user, p_roles;
    perform public.app_error('FORBIDDEN');
  end if;
  if p_require_mfa and not public.is_aal2() then
    perform public.app_error('MFA_REQUIRED');
  end if;
  return v_user;
end;
$$;

-- ----------------------------------------------------------------------------
-- Workspace
-- ----------------------------------------------------------------------------
create or replace function public.list_my_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_list jsonb;
begin
  select coalesce(jsonb_agg(w order by w ->> 'kind', w ->> 'org_name'), '[]'::jsonb)
    into v_list
  from (
    select jsonb_build_object(
             'kind', 'ORG', 'org_id', o.id, 'org_name', o.name, 'org_status', o.status,
             'roles', to_jsonb(array(select unnest(m.roles)
                                     intersect select unnest(array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER']))),
             'requires_mfa', m.roles && array['OWNER','FINANCE']) as w
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.status = 'ACTIVE' and o.status <> 'TERMINATED'
      and m.roles && array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER']
    union all
    select jsonb_build_object(
             'kind', 'STAFF', 'org_id', o.id, 'org_name', o.name, 'org_status', o.status,
             'roles', to_jsonb(array(select unnest(m.roles)
                                     intersect select unnest(array['SCANNER','POS','GATE_MANAGER']))),
             'requires_mfa', false)
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.status = 'ACTIVE' and o.status <> 'TERMINATED'
      and m.roles && array['SCANNER','POS','GATE_MANAGER']
    union all
    select jsonb_build_object('kind', 'ADMIN', 'roles', to_jsonb(m.roles), 'requires_mfa', true)
    from public.memberships m
    where m.user_id = v_user and m.scope = 'PLATFORM' and m.status = 'ACTIVE'
  ) x;

  -- CUSTOMER luôn có, đứng đầu danh sách
  return jsonb_build_array(jsonb_build_object('kind', 'CUSTOMER', 'requires_mfa', false)) || v_list;
end;
$$;

-- Chọn workspace; sau đó client gọi supabase.auth.refreshSession() để nhận token mới
create or replace function public.set_active_workspace(p_kind text, p_org_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_roles text[];
begin
  if p_kind = 'CUSTOMER' then
    p_org_id := null;
  elsif p_kind in ('ORG', 'STAFF') then
    select m.roles into v_roles
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and m.scope = 'ORG' and m.org_id = p_org_id
      and m.status = 'ACTIVE' and o.status <> 'TERMINATED';
    if v_roles is null
       or (p_kind = 'ORG' and not v_roles && array['OWNER','FINANCE','EVENT_MANAGER','GATE_MANAGER'])
       or (p_kind = 'STAFF' and not v_roles && array['SCANNER','POS','GATE_MANAGER']) then
      perform public.app_error('FORBIDDEN');
    end if;
    if p_kind = 'ORG' and v_roles && array['OWNER','FINANCE'] and not public.is_aal2() then
      perform public.app_error('MFA_REQUIRED');
    end if;
  elsif p_kind = 'ADMIN' then
    p_org_id := null;
    select roles into v_roles from public.memberships
    where user_id = v_user and scope = 'PLATFORM' and status = 'ACTIVE';
    if v_roles is null then
      perform public.app_error('FORBIDDEN');
    end if;
    if not public.is_aal2() then
      perform public.app_error('MFA_REQUIRED');
    end if;
  else
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_kind'));
  end if;

  insert into public.user_active_workspace (user_id, kind, org_id, updated_at)
  values (v_user, p_kind, p_org_id, now())
  on conflict (user_id) do update set kind = excluded.kind, org_id = excluded.org_id, updated_at = now();

  return jsonb_build_object('kind', p_kind, 'org_id', p_org_id, 'roles', to_jsonb(v_roles),
                            'refresh_session_required', true);
end;
$$;

-- Supabase Auth Hook (Dashboard > Authentication > Hooks > Custom Access Token)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_kind   text;
  v_org    uuid;
  v_roles  text[];
begin
  select kind, org_id into v_kind, v_org from public.user_active_workspace where user_id = v_user;

  if v_kind = 'ADMIN' then
    select roles into v_roles from public.memberships
    where user_id = v_user and scope = 'PLATFORM' and status = 'ACTIVE';
  elsif v_kind in ('ORG', 'STAFF') then
    select roles into v_roles from public.memberships
    where user_id = v_user and scope = 'ORG' and org_id = v_org and status = 'ACTIVE';
  end if;

  if v_kind is null or v_kind = 'CUSTOMER' or v_roles is null then
    -- Chưa chọn hoặc membership đã bị thu hồi: về CUSTOMER
    v_claims := v_claims || jsonb_build_object('active_workspace', jsonb_build_object('kind', 'CUSTOMER'));
  else
    v_claims := v_claims || jsonb_build_object('active_workspace',
                  jsonb_build_object('kind', v_kind, 'org_id', v_org, 'roles', to_jsonb(v_roles)));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- ----------------------------------------------------------------------------
-- Organization và thành viên
-- ----------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text,
                                                      p_business_type text default 'COMPANY')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_org  uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_name'));
  end if;

  begin
    insert into public.organizations (name, slug, business_type, created_by)
    values (trim(p_name), lower(p_slug), p_business_type, v_user)
    returning id into v_org;
  exception
    when unique_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_slug', 'reason', 'taken'));
    when check_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_slug'));
  end;

  insert into public.memberships (user_id, scope, org_id, roles, invited_by)
  values (v_user, 'ORG', v_org, array['OWNER'], v_user);

  perform public.write_audit('ORG.CREATE', 'organization', v_org::text, v_org);
  return v_org;
end;
$$;

-- Thêm / đổi vai trò / gỡ thành viên (p_roles rỗng = gỡ). Chỉ OWNER, cần 2FA.
create or replace function public.set_org_member(p_org_id uuid, p_email text, p_roles text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := public.assert_org_role(p_org_id, array['OWNER'], true);
  v_target uuid;
  v_before text[];
begin
  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then
    perform public.app_error('NOT_FOUND', jsonb_build_object('email', p_email));
  end if;

  select roles into v_before from public.memberships
  where org_id = p_org_id and user_id = v_target and scope = 'ORG';

  if coalesce(cardinality(p_roles), 0) = 0 then
    update public.memberships set status = 'REVOKED'
    where org_id = p_org_id and user_id = v_target and scope = 'ORG';
    update public.staff_assignments set status = 'REVOKED', revoked_by = v_actor, revoked_at = now()
    where tenant_id = p_org_id and user_id = v_target and status = 'ACTIVE';
  else
    begin
      insert into public.memberships (user_id, scope, org_id, roles, invited_by)
      values (v_target, 'ORG', p_org_id, p_roles, v_actor)
      on conflict (org_id, user_id) where scope = 'ORG'
      do update set roles = excluded.roles, status = 'ACTIVE';
    exception when check_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_roles'));
    end;
  end if;

  if not exists (select 1 from public.memberships
                 where org_id = p_org_id and scope = 'ORG' and status = 'ACTIVE' and 'OWNER' = any (roles)) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'org must keep at least one OWNER'));
  end if;

  perform public.write_audit('ORG.MEMBER_SET', 'membership', v_target::text, p_org_id,
                             jsonb_build_object('roles', v_before), jsonb_build_object('roles', p_roles));
  return jsonb_build_object('user_id', v_target, 'roles', p_roles);
end;
$$;

-- ----------------------------------------------------------------------------
-- KYC
-- p_documents: [{"doc_type": "ID_CARD_FRONT", "storage_path": "<org_id>/cccd-front.jpg"}]
-- ----------------------------------------------------------------------------
create or replace function public.submit_kyc(p_org_id uuid, p_legal_info jsonb, p_identity_number text,
                                             p_documents jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := public.assert_org_role(p_org_id, array['OWNER'], true);
  v_status text;
  v_sub    uuid;
begin
  select status into v_status from public.organizations where id = p_org_id for update;
  if v_status not in ('DRAFT', 'NEEDS_INFO', 'REJECTED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_status));
  end if;
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0
     or exists (select 1 from jsonb_array_elements(p_documents) d
                where (d ->> 'storage_path') not like p_org_id::text || '/%') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_documents'));
  end if;

  insert into public.kyc_submissions (org_id, legal_info, identity_number_hash, submitted_by)
  values (p_org_id, coalesce(p_legal_info, '{}'::jsonb),
          encode(extensions.digest(upper(regexp_replace(coalesce(p_identity_number, ''), '\s', '', 'g')), 'sha256'), 'hex'),
          v_user)
  returning id into v_sub;

  insert into public.kyc_documents (org_id, submission_id, doc_type, storage_path, uploaded_by)
  select p_org_id, v_sub, d ->> 'doc_type', d ->> 'storage_path', v_user
  from jsonb_array_elements(p_documents) d;

  update public.organizations set status = 'PENDING_REVIEW' where id = p_org_id;
  perform public.enqueue('ADMIN_ALERT', 'kyc_submission', v_sub, jsonb_build_object('type', 'KYC_SUBMITTED'));
  perform public.write_audit('KYC.SUBMIT', 'kyc_submission', v_sub::text, p_org_id);
  return v_sub;
end;
$$;

create or replace function public.review_kyc(p_submission_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_platform_role(array['KYC_REVIEWER']);
  v_sub  public.kyc_submissions%rowtype;
begin
  if p_decision not in ('APPROVED', 'NEEDS_INFO', 'REJECTED') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_decision'));
  end if;
  if p_decision <> 'APPROVED' and coalesce(trim(p_note), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_note', 'reason', 'required'));
  end if;

  select * into v_sub from public.kyc_submissions where id = p_submission_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_sub.status <> 'SUBMITTED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_sub.status));
  end if;

  update public.kyc_submissions
     set status = p_decision, reviewed_by = v_user, review_note = p_note, reviewed_at = now()
   where id = p_submission_id;

  update public.organizations
     set status = p_decision,
         status_reason = p_note,
         approved_at = case when p_decision = 'APPROVED' then now() else approved_at end
   where id = v_sub.org_id;

  if p_decision = 'APPROVED' then
    perform public.org_payable_account(v_sub.org_id);
  end if;

  perform public.enqueue('NOTIFY_ORG', 'organization', v_sub.org_id,
                         jsonb_build_object('type', 'KYC_' || p_decision, 'note', p_note));
  perform public.write_audit('KYC.' || p_decision, 'kyc_submission', p_submission_id::text, v_sub.org_id,
                             null, jsonb_build_object('note', p_note));
end;
$$;

-- ----------------------------------------------------------------------------
-- Đình chỉ / gỡ đình chỉ / chấm dứt Org (S4-FE2-3, tài liệu mục 6): cần hai Admin.
-- SUSPENDED: dừng bán mọi Session ngay khi được duyệt và giữ toàn bộ payout
-- (fund_holds phạm vi ORG_BALANCE). Gỡ đình chỉ thì mở bán lại và nhả hold đó.
-- ----------------------------------------------------------------------------
create or replace function public.request_org_status_change(p_org_id uuid, p_action text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_platform_role(array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN']);
  v_status   text;
  v_approval uuid;
begin
  select status into v_status from public.organizations where id = p_org_id;
  if v_status is null then
    perform public.app_error('NOT_FOUND');
  end if;
  if coalesce(trim(p_reason), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_reason'));
  end if;
  if not ((p_action = 'SUSPEND' and v_status = 'APPROVED')
          or (p_action = 'UNSUSPEND' and v_status = 'SUSPENDED')
          or (p_action = 'TERMINATE' and v_status in ('APPROVED', 'SUSPENDED'))) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_status, 'action', p_action));
  end if;

  begin
    insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
    values ('ORG_SUSPENSION', p_org_id, p_org_id, v_user,
            jsonb_build_object('action', p_action, 'reason', trim(p_reason)))
    returning id into v_approval;
  exception when unique_violation then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'a request is already pending'));
  end;
  -- Người đề nghị tính là phiếu thứ nhất; cần thêm một Admin khác
  insert into public.approval_votes (approval_id, voter_id, decision, note)
  values (v_approval, v_user, 'APPROVE', 'initiator');

  perform public.write_audit('ORG.' || p_action || '_REQUEST', 'organization', p_org_id::text, p_org_id,
                             null, jsonb_build_object('reason', p_reason));
  return v_approval;
end;
$$;

-- Gọi từ vote_approval khi đủ phiếu
create or replace function public.apply_org_status_change(p_org_id uuid, p_action text, p_reason text,
                                                          p_approval_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action in ('SUSPEND', 'TERMINATE') then
    update public.organizations
       set status = case p_action when 'SUSPEND' then 'SUSPENDED' else 'TERMINATED' end, status_reason = p_reason
     where id = p_org_id;
    update public.sessions
       set sales_paused = true, sales_paused_reason = 'ORG_' || p_action
     where tenant_id = p_org_id and status in ('SCHEDULED', 'ON_SALE', 'SALES_CLOSED', 'ONGOING')
       and not sales_paused;
    insert into public.fund_holds (tenant_id, scope, reason, created_by)
    select p_org_id, 'ORG_BALANCE', 'ORG_' || p_action, (select requested_by from public.approvals where id = p_approval_id)
    where not exists (select 1 from public.fund_holds
                      where tenant_id = p_org_id and scope = 'ORG_BALANCE' and status = 'ACTIVE'
                        and reason like 'ORG_%');
    -- Payout chưa chi thì hủy, các kỳ đối soát quay lại chờ (release_payout ở migration 1820)
    perform public.release_payout(p.id)
       from public.payouts p where p.tenant_id = p_org_id and p.status in ('PROPOSED', 'APPROVED');
  elsif p_action = 'UNSUSPEND' then
    update public.organizations set status = 'APPROVED', status_reason = p_reason where id = p_org_id;
    update public.sessions set sales_paused = false, sales_paused_reason = null
     where tenant_id = p_org_id and sales_paused_reason = 'ORG_SUSPEND';
    update public.fund_holds set status = 'RELEASED', released_at = now(), release_approval_id = p_approval_id
     where tenant_id = p_org_id and scope = 'ORG_BALANCE' and status = 'ACTIVE' and reason = 'ORG_SUSPEND';
  else
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'action'));
  end if;

  perform public.enqueue('NOTIFY_ORG', 'organization', p_org_id, jsonb_build_object('type', 'ORG_' || p_action,
                                                                                     'reason', p_reason));
  perform public.write_audit('ORG.' || p_action, 'organization', p_org_id::text, p_org_id,
                             null, jsonb_build_object('reason', p_reason, 'approval_id', p_approval_id));
end;
$$;

-- ----------------------------------------------------------------------------
-- Quyền thực thi
-- ----------------------------------------------------------------------------
grant execute on function public.list_my_workspaces(),
                          public.set_active_workspace(text, uuid),
                          public.create_organization(text, text, text),
                          public.set_org_member(uuid, text, text[]),
                          public.submit_kyc(uuid, jsonb, text, jsonb),
                          public.review_kyc(uuid, text, text),
                          public.request_org_status_change(uuid, text, text)
  to authenticated;

-- Custom access token hook: chỉ Auth gọi (Supabase docs: grant cho supabase_auth_admin)
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;


-- ############################################################################
-- PHẦN 15 (1500) · rpc_venue_catalog
-- ############################################################################

-- ============================================================================
-- 1500 · RPC: Venue, Layout, Event, Session, Ticket Type, giữ/chặn ghế
-- Tất cả thao tác ghi của portal Org đi qua các hàm này (client chỉ đọc).
-- ============================================================================

-- Đổi lỗi ràng buộc của Postgres thành VALIDATION_FAILED cho frontend
create or replace function public.raise_constraint_error(p_sqlstate text, p_message text, p_constraint text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.app_error('VALIDATION_FAILED',
    jsonb_build_object('sqlstate', p_sqlstate, 'constraint', p_constraint, 'message', p_message));
end;
$$;

-- Số dư Org âm quá hạn (S6-BE2-4) thì khóa tạo / gửi duyệt sự kiện mới.
-- negative_balance_since do job refresh_negative_balances() cập nhật (migration 1820).
create or replace function public.assert_no_overdue_negative_balance(p_org_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  select negative_balance_since into v_since from public.organizations where id = p_org_id;
  if v_since is not null
     and v_since < now() - make_interval(days => public.setting_int('payout.negative_balance_grace_days', 30)) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'NEGATIVE_BALANCE_OVERDUE',
                                                                 'negative_since', v_since));
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Venue
-- p: {id?, tenant_id (khi tạo), name, venue_type, address_line, ward, district, city,
--     country_code, latitude, longitude, timezone, capacity, description, map_image_url, status}
-- ----------------------------------------------------------------------------
create or replace function public.save_venue(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := public.try_uuid(p ->> 'id');
  v_row    public.venues%rowtype;
  v_user   uuid;
  v_constraint text;
begin
  if v_id is null then
    v_user := public.assert_org_role(public.try_uuid(p ->> 'tenant_id'), array['OWNER','EVENT_MANAGER']);
    v_row.tenant_id := (p ->> 'tenant_id')::uuid;
    v_row.timezone  := coalesce(p ->> 'timezone', 'Asia/Ho_Chi_Minh');
    v_row.status    := 'ACTIVE';
    v_row.venue_type := 'OTHER';
    v_row.country_code := 'VN';
  else
    select * into v_row from public.venues where id = v_id for update;
    if not found then
      perform public.app_error('NOT_FOUND');
    end if;
    v_user := public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER']);
  end if;

  v_row.name          := coalesce(p ->> 'name', v_row.name);
  v_row.venue_type    := coalesce(p ->> 'venue_type', v_row.venue_type);
  v_row.address_line  := coalesce(p ->> 'address_line', v_row.address_line);
  v_row.ward          := coalesce(p ->> 'ward', v_row.ward);
  v_row.district      := coalesce(p ->> 'district', v_row.district);
  v_row.city          := coalesce(p ->> 'city', v_row.city);
  v_row.country_code  := coalesce(p ->> 'country_code', v_row.country_code);
  v_row.latitude      := coalesce((p ->> 'latitude')::double precision, v_row.latitude);
  v_row.longitude     := coalesce((p ->> 'longitude')::double precision, v_row.longitude);
  v_row.timezone      := coalesce(p ->> 'timezone', v_row.timezone);
  v_row.capacity      := coalesce((p ->> 'capacity')::int, v_row.capacity);
  v_row.description   := coalesce(p ->> 'description', v_row.description);
  v_row.map_image_url := coalesce(p ->> 'map_image_url', v_row.map_image_url);
  v_row.status        := coalesce(p ->> 'status', v_row.status);

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_row.timezone) then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'timezone'));
  end if;

  begin
    if v_id is null then
      insert into public.venues (tenant_id, name, venue_type, address_line, ward, district, city, country_code,
                                 latitude, longitude, timezone, capacity, description, map_image_url, status, created_by)
      values (v_row.tenant_id, v_row.name, v_row.venue_type, v_row.address_line, v_row.ward, v_row.district,
              v_row.city, v_row.country_code, v_row.latitude, v_row.longitude, v_row.timezone, v_row.capacity,
              v_row.description, v_row.map_image_url, v_row.status, v_user)
      returning id into v_id;
    else
      update public.venues set
        name = v_row.name, venue_type = v_row.venue_type, address_line = v_row.address_line, ward = v_row.ward,
        district = v_row.district, city = v_row.city, country_code = v_row.country_code,
        latitude = v_row.latitude, longitude = v_row.longitude, timezone = v_row.timezone,
        capacity = v_row.capacity, description = v_row.description, map_image_url = v_row.map_image_url,
        status = v_row.status
      where id = v_id;
    end if;
  exception when not_null_violation or check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform public.raise_constraint_error(sqlstate, sqlerrm, v_constraint);
  end;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Layout
-- ----------------------------------------------------------------------------
create or replace function public.create_layout(p_venue_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue   public.venues%rowtype;
  v_user    uuid;
  v_layout  uuid;
  v_version uuid;
begin
  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_user := public.assert_org_role(v_venue.tenant_id, array['OWNER','EVENT_MANAGER']);

  insert into public.layouts (tenant_id, venue_id, name)
  values (v_venue.tenant_id, v_venue.id, p_name)
  returning id into v_layout;

  insert into public.layout_versions (tenant_id, layout_id, venue_id, version_no, created_by)
  values (v_venue.tenant_id, v_layout, v_venue.id, 1, v_user)
  returning id into v_version;

  return jsonb_build_object('layout_id', v_layout, 'layout_version_id', v_version);
end;
$$;

create or replace function public.save_layout_draft(p_layout_version_id uuid, p_definition jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lv public.layout_versions%rowtype;
begin
  select * into v_lv from public.layout_versions where id = p_layout_version_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  perform public.assert_org_role(v_lv.tenant_id, array['OWNER','EVENT_MANAGER']);
  if v_lv.status <> 'DRAFT' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_lv.status));
  end if;
  if jsonb_typeof(p_definition -> 'zones') is distinct from 'array' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'zones'));
  end if;
  update public.layout_versions set definition = p_definition where id = p_layout_version_id;
end;
$$;

-- Sửa một Layout đã phát hành = tạo phiên bản mới từ bản mới nhất
create or replace function public.new_layout_version(p_layout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.layout_versions%rowtype;
  v_user uuid;
  v_id   uuid;
begin
  select * into v_last from public.layout_versions
  where layout_id = p_layout_id order by version_no desc limit 1 for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_user := public.assert_org_role(v_last.tenant_id, array['OWNER','EVENT_MANAGER']);
  if v_last.status = 'DRAFT' then
    return v_last.id;  -- đã có bản nháp, dùng tiếp
  end if;

  insert into public.layout_versions (tenant_id, layout_id, venue_id, version_no, definition, created_by)
  values (v_last.tenant_id, v_last.layout_id, v_last.venue_id, v_last.version_no + 1, v_last.definition, v_user)
  returning id into v_id;
  return v_id;
end;
$$;

-- Kiểm tra JSON Layout, sinh zones + seats, khóa phiên bản (S1-BE1-1, S1-BE1-2)
-- JSON: {"zones":[{"id":"A","name":"Khu A","type":"seated","color":"#..","seats":[
--          {"id":"A-1-1","section":"Tầng 1","row":"1","number":"1","x":0,"y":0,
--           "flags":["wheelchair"],"blocked":false}]},
--        {"id":"GA","name":"Khu đứng","type":"standing","capacity":1000}]}
create or replace function public.publish_layout_version(p_layout_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lv        public.layout_versions%rowtype;
  v_user      uuid;
  v_zones     jsonb;
  v_errors    jsonb := '[]'::jsonb;
  v_total     int;
  v_venue_cap int;
begin
  select * into v_lv from public.layout_versions where id = p_layout_version_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_user := public.assert_org_role(v_lv.tenant_id, array['OWNER','EVENT_MANAGER']);
  if v_lv.status <> 'DRAFT' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_lv.status));
  end if;

  v_zones := v_lv.definition -> 'zones';
  if jsonb_typeof(v_zones) is distinct from 'array' or jsonb_array_length(v_zones) = 0 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('errors', jsonb_build_array('zones must be a non-empty array')));
  end if;

  -- Zone: id duy nhất, type hợp lệ, khu đứng có capacity, khu ngồi có ghế
  select v_errors || coalesce(jsonb_agg(e), '[]'::jsonb) into v_errors from (
    select 'duplicate zone id: ' || (z ->> 'id') as e
    from jsonb_array_elements(v_zones) z group by z ->> 'id' having count(*) > 1
    union all
    select 'zone missing id/name: ' || coalesce(z ->> 'id', '?')
    from jsonb_array_elements(v_zones) z
    where coalesce(z ->> 'id', '') = '' or coalesce(z ->> 'name', '') = ''
    union all
    select 'invalid zone type: ' || (z ->> 'id')
    from jsonb_array_elements(v_zones) z where coalesce(z ->> 'type', '') not in ('seated', 'standing')
    union all
    select 'standing zone needs capacity > 0: ' || (z ->> 'id')
    from jsonb_array_elements(v_zones) z
    where z ->> 'type' = 'standing' and coalesce((z ->> 'capacity')::int, 0) <= 0
    union all
    select 'seated zone needs seats: ' || (z ->> 'id')
    from jsonb_array_elements(v_zones) z
    where z ->> 'type' = 'seated'
      and (jsonb_typeof(z -> 'seats') is distinct from 'array' or jsonb_array_length(z -> 'seats') = 0)
  ) x;

  -- Ghế: id duy nhất trong cả phiên bản, đủ hàng/số/tọa độ
  select v_errors || coalesce(jsonb_agg(e), '[]'::jsonb) into v_errors from (
    select 'duplicate seat id: ' || (s ->> 'id') as e
    from jsonb_array_elements(v_zones) z, jsonb_array_elements(coalesce(z -> 'seats', '[]'::jsonb)) s
    where z ->> 'type' = 'seated'
    group by s ->> 'id' having count(*) > 1
    union all
    select 'seat missing id/row/number/x/y in zone ' || (z ->> 'id')
    from jsonb_array_elements(v_zones) z, jsonb_array_elements(coalesce(z -> 'seats', '[]'::jsonb)) s
    where z ->> 'type' = 'seated'
      and (coalesce(s ->> 'id', '') = '' or coalesce(s ->> 'row', '') = '' or coalesce(s ->> 'number', '') = ''
           or s -> 'x' is null or s -> 'y' is null)
  ) x;

  if jsonb_array_length(v_errors) > 0 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('errors', v_errors));
  end if;

  -- Tổng sức chứa không vượt sức chứa Venue
  select coalesce(sum(case when z ->> 'type' = 'standing' then (z ->> 'capacity')::int
                           else jsonb_array_length(z -> 'seats') end), 0)
    into v_total
  from jsonb_array_elements(v_zones) z;
  select capacity into v_venue_cap from public.venues where id = v_lv.venue_id;
  if v_total > v_venue_cap then
    perform public.app_error('VALIDATION_FAILED',
      jsonb_build_object('errors', jsonb_build_array('total capacity exceeds venue capacity'),
                         'total_capacity', v_total, 'venue_capacity', v_venue_cap));
  end if;

  insert into public.zones (tenant_id, layout_version_id, code, name, kind, capacity, color, sort_order)
  select v_lv.tenant_id, v_lv.id, z ->> 'id', z ->> 'name',
         upper(z ->> 'type'),
         case when z ->> 'type' = 'standing' then (z ->> 'capacity')::int else jsonb_array_length(z -> 'seats') end,
         z ->> 'color', ord::int
  from jsonb_array_elements(v_zones) with ordinality as t(z, ord);

  insert into public.seats (tenant_id, layout_version_id, zone_id, seat_code, section, row_label, seat_number,
                            x, y, flags, default_blocked)
  select v_lv.tenant_id, v_lv.id, zn.id, s ->> 'id', s ->> 'section', s ->> 'row', s ->> 'number',
         (s ->> 'x')::numeric, (s ->> 'y')::numeric,
         coalesce(array(select jsonb_array_elements_text(s -> 'flags')), '{}'),
         coalesce((s ->> 'blocked')::boolean, false)
  from jsonb_array_elements(v_zones) z
  join public.zones zn on zn.layout_version_id = v_lv.id and zn.code = z ->> 'id'
  cross join lateral jsonb_array_elements(z -> 'seats') s
  where z ->> 'type' = 'seated';

  update public.layout_versions
     set status = 'PUBLISHED', total_capacity = v_total, published_at = now(), published_by = v_user
   where id = v_lv.id;

  perform public.write_audit('LAYOUT.PUBLISH', 'layout_version', v_lv.id::text, v_lv.tenant_id,
                             null, jsonb_build_object('total_capacity', v_total));
  return jsonb_build_object('layout_version_id', v_lv.id, 'total_capacity', v_total);
end;
$$;

-- ----------------------------------------------------------------------------
-- Event
-- p: {id?, tenant_id (khi tạo), title, slug, summary, description, category_id,
--     cover_image_url, age_limit, terms}
-- ----------------------------------------------------------------------------
create or replace function public.save_event(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid := public.try_uuid(p ->> 'id');
  v_row  public.events%rowtype;
  v_old  public.events%rowtype;
  v_user uuid;
  v_org_status text;
  v_constraint text;
begin
  if v_id is null then
    v_row.tenant_id := public.try_uuid(p ->> 'tenant_id');
    v_user := public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER']);
    v_row.status := 'DRAFT';
  else
    select * into v_row from public.events where id = v_id for update;
    if not found then
      perform public.app_error('NOT_FOUND');
    end if;
    v_user := public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER']);
  end if;
  v_old := v_row;

  select status into v_org_status from public.organizations where id = v_row.tenant_id;
  if v_org_status in ('SUSPENDED', 'TERMINATED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('org_status', v_org_status));
  end if;
  if v_id is null then
    perform public.assert_no_overdue_negative_balance(v_row.tenant_id);
  end if;

  v_row.title           := coalesce(p ->> 'title', v_row.title);
  v_row.slug            := coalesce(lower(p ->> 'slug'), v_row.slug);
  v_row.summary         := coalesce(p ->> 'summary', v_row.summary);
  v_row.description     := coalesce(p ->> 'description', v_row.description);
  v_row.category_id     := coalesce(public.try_uuid(p ->> 'category_id'), v_row.category_id);
  v_row.cover_image_url := coalesce(p ->> 'cover_image_url', v_row.cover_image_url);
  v_row.age_limit       := coalesce((p ->> 'age_limit')::int, v_row.age_limit);
  v_row.terms           := coalesce(p ->> 'terms', v_row.terms);

  if v_id is not null then
    if v_old.status = 'PUBLISHED' then
      -- Đã công bố: chỉ sửa mô tả và ảnh; đổi tên, thể loại, độ tuổi, điều khoản phải hủy/đăng lại
      if v_row.title is distinct from v_old.title or v_row.slug is distinct from v_old.slug
         or v_row.category_id is distinct from v_old.category_id or v_row.age_limit is distinct from v_old.age_limit
         or v_row.terms is distinct from v_old.terms then
        perform public.app_error('INVALID_STATE', jsonb_build_object(
          'status', v_old.status, 'editable', jsonb_build_array('summary', 'description', 'cover_image_url')));
      end if;
    elsif v_old.status not in ('DRAFT', 'CHANGES_REQUESTED') then
      perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_old.status));
    end if;
  end if;

  begin
    if v_id is null then
      insert into public.events (tenant_id, title, slug, summary, description, category_id, cover_image_url,
                                 age_limit, terms, created_by)
      values (v_row.tenant_id, v_row.title, v_row.slug, v_row.summary, v_row.description, v_row.category_id,
              v_row.cover_image_url, v_row.age_limit, v_row.terms, v_user)
      returning id into v_id;
    else
      update public.events set
        title = v_row.title, slug = v_row.slug, summary = v_row.summary, description = v_row.description,
        category_id = v_row.category_id, cover_image_url = v_row.cover_image_url,
        age_limit = v_row.age_limit, terms = v_row.terms
      where id = v_id;
    end if;
  exception when not_null_violation or check_violation or unique_violation or foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform public.raise_constraint_error(sqlstate, sqlerrm, v_constraint);
  end;
  return v_id;
end;
$$;

create or replace function public.submit_event_for_review(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event  public.events%rowtype;
  v_user   uuid;
  v_org    public.organizations%rowtype;
  v_quota  bigint;
  v_review boolean;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_user := public.assert_org_role(v_event.tenant_id, array['OWNER','EVENT_MANAGER']);

  select * into v_org from public.organizations where id = v_event.tenant_id;
  if v_org.status <> 'APPROVED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('org_status', v_org.status));
  end if;
  perform public.assert_no_overdue_negative_balance(v_event.tenant_id);
  if v_event.status not in ('DRAFT', 'CHANGES_REQUESTED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_event.status));
  end if;

  select coalesce(sum(tt.quota), 0) into v_quota
  from public.sessions s
  join public.ticket_types tt on tt.session_id = s.id and tt.status = 'ACTIVE'
  where s.event_id = p_event_id and s.status <> 'CANCELLED';
  if v_quota = 0 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'event needs a session with ticket types'));
  end if;

  v_review := v_org.tier = 'NEW' or v_quota >= public.setting_int('review.large_event_tickets', 5000);

  if v_review then
    update public.events set status = 'PENDING_REVIEW', requires_review = true where id = p_event_id;
    insert into public.event_reviews (tenant_id, event_id, action, actor_id)
    values (v_event.tenant_id, p_event_id, 'SUBMITTED', v_user);
    perform public.enqueue('ADMIN_ALERT', 'event', p_event_id, jsonb_build_object('type', 'EVENT_REVIEW_REQUESTED'));
  else
    update public.events set status = 'PUBLISHED', requires_review = false, published_at = now() where id = p_event_id;
    insert into public.event_reviews (tenant_id, event_id, action, actor_id)
    values (v_event.tenant_id, p_event_id, 'AUTO_PUBLISHED', v_user);
  end if;

  return jsonb_build_object('status', case when v_review then 'PENDING_REVIEW' else 'PUBLISHED' end);
end;
$$;

-- Kiểm duyệt sự kiện (Admin KYC_REVIEWER kiêm kiểm duyệt nội dung ở P0)
create or replace function public.review_event(p_event_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := public.assert_platform_role(array['KYC_REVIEWER'], false);
  v_event public.events%rowtype;
  v_new   text;
begin
  if p_decision not in ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_decision'));
  end if;
  if p_decision <> 'APPROVED' and coalesce(trim(p_note), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_note', 'reason', 'required'));
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_event.status <> 'PENDING_REVIEW' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_event.status));
  end if;

  v_new := case p_decision when 'APPROVED' then 'PUBLISHED' else p_decision end;
  update public.events
     set status = v_new, published_at = case when v_new = 'PUBLISHED' then now() else published_at end
   where id = p_event_id;
  insert into public.event_reviews (tenant_id, event_id, action, actor_id, note)
  values (v_event.tenant_id, p_event_id, p_decision, v_user, p_note);

  perform public.enqueue('NOTIFY_ORG', 'event', p_event_id,
                         jsonb_build_object('type', 'EVENT_' || p_decision, 'note', p_note));
  perform public.write_audit('EVENT.' || p_decision, 'event', p_event_id::text, v_event.tenant_id,
                             null, jsonb_build_object('note', p_note));
end;
$$;

-- ----------------------------------------------------------------------------
-- Session (một Event nhiều Session, mỗi Session một Venue)
-- p: {id?, event_id, venue_id, layout_version_id, title, starts_at, ends_at, doors_open_at,
--     sales_start_at, sales_end_at, max_tickets_per_account, report_window_hours}
-- ----------------------------------------------------------------------------
create or replace function public.save_session(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := public.try_uuid(p ->> 'id');
  v_row     public.sessions%rowtype;
  v_event   public.events%rowtype;
  v_lv      public.layout_versions%rowtype;
  v_user    uuid;
  v_constraint text;
begin
  if v_id is null then
    select * into v_event from public.events where id = public.try_uuid(p ->> 'event_id');
    if not found then
      perform public.app_error('NOT_FOUND', jsonb_build_object('field', 'event_id'));
    end if;
    v_user := public.assert_org_role(v_event.tenant_id, array['OWNER','EVENT_MANAGER']);
    if v_event.status in ('CANCELLED', 'ENDED', 'REJECTED') then
      perform public.app_error('INVALID_STATE', jsonb_build_object('event_status', v_event.status));
    end if;

    select * into v_lv from public.layout_versions where id = public.try_uuid(p ->> 'layout_version_id');
    if not found or v_lv.tenant_id <> v_event.tenant_id
       or v_lv.venue_id is distinct from public.try_uuid(p ->> 'venue_id') then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'layout_version_id'));
    end if;
    if v_lv.status <> 'PUBLISHED' then
      perform public.app_error('VALIDATION_FAILED',
        jsonb_build_object('field', 'layout_version_id', 'reason', 'layout version must be PUBLISHED'));
    end if;

    v_row.tenant_id := v_event.tenant_id;
    v_row.event_id := v_event.id;
    v_row.venue_id := v_lv.venue_id;
    v_row.layout_version_id := v_lv.id;
    v_row.max_tickets_per_account := 10;
    v_row.report_window_hours := public.setting_int('report.window_hours', 72);
  else
    select * into v_row from public.sessions where id = v_id for update;
    if not found then
      perform public.app_error('NOT_FOUND');
    end if;
    v_user := public.assert_org_role(v_row.tenant_id, array['OWNER','EVENT_MANAGER']);
    if v_row.status <> 'SCHEDULED' then
      -- Đổi lịch sau khi mở bán là luồng POSTPONE (P1), không sửa trực tiếp
      perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_row.status));
    end if;
    if (p ? 'venue_id' and public.try_uuid(p ->> 'venue_id') is distinct from v_row.venue_id)
       or (p ? 'layout_version_id' and public.try_uuid(p ->> 'layout_version_id') is distinct from v_row.layout_version_id) then
      perform public.app_error('VALIDATION_FAILED',
        jsonb_build_object('reason', 'venue/layout cannot change; create a new session instead'));
    end if;
  end if;

  v_row.title                   := coalesce(p ->> 'title', v_row.title);
  v_row.starts_at               := coalesce((p ->> 'starts_at')::timestamptz, v_row.starts_at);
  v_row.ends_at                 := coalesce((p ->> 'ends_at')::timestamptz, v_row.ends_at);
  v_row.doors_open_at           := coalesce((p ->> 'doors_open_at')::timestamptz, v_row.doors_open_at,
                                            v_row.starts_at - interval '1 hour');
  v_row.sales_start_at          := coalesce((p ->> 'sales_start_at')::timestamptz, v_row.sales_start_at);
  v_row.sales_end_at            := coalesce((p ->> 'sales_end_at')::timestamptz, v_row.sales_end_at, v_row.starts_at);
  v_row.max_tickets_per_account := coalesce((p ->> 'max_tickets_per_account')::int, v_row.max_tickets_per_account);
  v_row.report_window_hours     := coalesce((p ->> 'report_window_hours')::int, v_row.report_window_hours);

  begin
    if v_id is null then
      insert into public.sessions (tenant_id, event_id, venue_id, layout_version_id, title, starts_at, ends_at,
                                   doors_open_at, sales_start_at, sales_end_at, max_tickets_per_account,
                                   report_window_hours, created_by)
      values (v_row.tenant_id, v_row.event_id, v_row.venue_id, v_row.layout_version_id, v_row.title,
              v_row.starts_at, v_row.ends_at, v_row.doors_open_at, v_row.sales_start_at, v_row.sales_end_at,
              v_row.max_tickets_per_account, v_row.report_window_hours, v_user)
      returning id into v_id;
      perform public.generate_session_inventory(v_id);
    else
      update public.sessions set
        title = v_row.title, starts_at = v_row.starts_at, ends_at = v_row.ends_at,
        doors_open_at = v_row.doors_open_at, sales_start_at = v_row.sales_start_at,
        sales_end_at = v_row.sales_end_at, max_tickets_per_account = v_row.max_tickets_per_account,
        report_window_hours = v_row.report_window_hours
      where id = v_id;
    end if;
  exception when not_null_violation or check_violation or foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform public.raise_constraint_error(sqlstate, sqlerrm, v_constraint);
  end;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Ticket Type (PAID / FREE / COMP, quota cố định, gán Zone)
-- p: {id?, session_id, name, description, kind, price_amount, quota, max_per_order,
--     sale_start_at, sale_end_at, refund_policy, refund_deadline_hours, visibility,
--     status, sort_order, zone_ids: [uuid]}
-- ----------------------------------------------------------------------------
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
begin
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

    -- Bỏ gán ở ghế không còn thuộc Zone; gán hạng cho ghế chưa có hạng trong Zone mới
    update public.session_seats
       set ticket_type_id = null, updated_at = now()
     where session_id = v_row.session_id and ticket_type_id = v_id
       and zone_id <> all (v_zone_ids) and status in ('AVAILABLE', 'BLOCKED', 'HELD');
    update public.session_seats
       set ticket_type_id = v_id, updated_at = now()
     where session_id = v_row.session_id and ticket_type_id is null
       and zone_id = any (v_zone_ids) and status in ('AVAILABLE', 'BLOCKED', 'HELD');
  end if;
  return v_id;
end;
$$;

-- Gán hạng giá cho từng ghế (vd. hàng đầu khu A là VIP)
create or replace function public.assign_seats_ticket_type(p_session_id uuid, p_seat_ids uuid[], p_ticket_type_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_rows    int;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  perform public.assert_org_role(v_session.tenant_id, array['OWNER','EVENT_MANAGER']);

  update public.session_seats ss
     set ticket_type_id = p_ticket_type_id, updated_at = now()
   where ss.session_id = p_session_id
     and ss.seat_id = any (p_seat_ids)
     and ss.status in ('AVAILABLE', 'BLOCKED', 'HELD')
     and exists (select 1 from public.ticket_type_zones tz
                 where tz.ticket_type_id = p_ticket_type_id and tz.zone_id = ss.zone_id);
  get diagnostics v_rows = row_count;
  return jsonb_build_object('updated', v_rows, 'requested', cardinality(p_seat_ids));
end;
$$;

-- Giữ (HELD) / chặn (BLOCKED) / nhả ghế theo Session (S3-BE2-2)
create or replace function public.set_session_seat_status(p_session_id uuid, p_seat_ids uuid[], p_action text,
                                                          p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session   public.sessions%rowtype;
  v_user      uuid;
  v_rows      int;
  v_conflicts uuid[];
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_user := public.assert_org_role(v_session.tenant_id, array['OWNER','EVENT_MANAGER']);
  if p_action not in ('HOLD', 'BLOCK', 'RELEASE') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_action'));
  end if;

  if p_action in ('HOLD', 'BLOCK') then
    update public.session_seats
       set status = case p_action when 'HOLD' then 'HELD' else 'BLOCKED' end,
           booking_id = null, lock_expires_at = null,
           hold_reason = p_reason, held_by = v_user, updated_at = now()
     where session_id = p_session_id and seat_id = any (p_seat_ids)
       and (status = 'AVAILABLE' or (status = 'LOCKED' and lock_expires_at < now()));
  else
    update public.session_seats
       set status = 'AVAILABLE', hold_reason = null, held_by = null, updated_at = now()
     where session_id = p_session_id and seat_id = any (p_seat_ids) and status in ('HELD', 'BLOCKED');
  end if;
  get diagnostics v_rows = row_count;

  select array_agg(sid) into v_conflicts
  from unnest(p_seat_ids) sid
  where not exists (
    select 1 from public.session_seats
    where session_id = p_session_id and seat_id = sid
      and status = case p_action when 'HOLD' then 'HELD' when 'BLOCK' then 'BLOCKED' else 'AVAILABLE' end);

  perform public.write_audit('SEAT.' || p_action, 'session', p_session_id::text, v_session.tenant_id,
                             null, jsonb_build_object('count', v_rows, 'reason', p_reason));
  return jsonb_build_object('updated', v_rows, 'conflict_seat_ids', coalesce(to_jsonb(v_conflicts), '[]'::jsonb));
end;
$$;

-- Giữ chỗ khu đứng cho tài trợ / B2B (tăng giảm held)
create or replace function public.set_zone_held(p_session_id uuid, p_zone_id uuid, p_held int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  perform public.assert_org_role(v_tenant, array['OWNER','EVENT_MANAGER']);
  update public.session_zone_inventory
     set held = p_held, updated_at = now()
   where session_id = p_session_id and zone_id = p_zone_id
     and p_held >= 0 and locked + sold + p_held <= capacity;
  if not found then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_held'));
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Job mỗi phút: chuyển trạng thái Session theo giờ (pg_cron, xem 1900)
-- ----------------------------------------------------------------------------
create or replace function public.run_session_status_transitions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions s set status = 'ON_SALE'
  from public.events e
  where e.id = s.event_id and e.status = 'PUBLISHED'
    and s.status = 'SCHEDULED' and s.inventory_generated_at is not null
    and s.sales_start_at <= now() and s.sales_end_at > now();

  update public.sessions set status = 'SALES_CLOSED'
  where status = 'ON_SALE' and sales_end_at <= now();

  update public.sessions set status = 'ONGOING'
  where status in ('ON_SALE', 'SALES_CLOSED') and starts_at <= now() and ends_at > now();

  with ended as (
    update public.sessions set status = 'ENDED'
    where status in ('ON_SALE', 'SALES_CLOSED', 'ONGOING') and ends_at <= now()
    returning id, tenant_id, ends_at, report_window_hours
  ), no_show as (
    update public.tickets t set status = 'NO_SHOW'
    from ended where t.session_id = ended.id and t.status = 'ISSUED'
    returning t.id
  )
  insert into public.settlements (tenant_id, session_id, cutoff_at)
  select tenant_id, id, ends_at + make_interval(hours => report_window_hours) from ended
  on conflict (session_id) do nothing;

  update public.events e set status = 'ENDED'
  where e.status = 'PUBLISHED'
    and not exists (select 1 from public.sessions s
                    where s.event_id = e.id and s.status not in ('ENDED', 'CANCELLED'))
    and exists (select 1 from public.sessions s where s.event_id = e.id and s.status = 'ENDED');
end;
$$;

grant execute on function
  public.save_venue(jsonb),
  public.create_layout(uuid, text),
  public.save_layout_draft(uuid, jsonb),
  public.new_layout_version(uuid),
  public.publish_layout_version(uuid),
  public.save_event(jsonb),
  public.submit_event_for_review(uuid),
  public.review_event(uuid, text, text),
  public.save_session(jsonb),
  public.save_ticket_type(jsonb),
  public.assign_seats_ticket_type(uuid, uuid[], uuid),
  public.set_session_seat_status(uuid, uuid[], text, text),
  public.set_zone_held(uuid, uuid, int)
to authenticated;


-- ############################################################################
-- PHẦN 16 (1600) · rpc_booking_payment
-- ############################################################################

-- ============================================================================
-- 1600 · RPC: xem chỗ trống, đặt vé, thanh toán, phát vé   (chủ: Lâm Phước)
--
-- Luồng: create_booking (PENDING, khóa ghế T_LOCK)
--   -> begin_payment (PAYMENT_PENDING, gia hạn lock, tạo payments)
--   -> [API .NET POST /payments/ipn] apply_payment_success (PAID hoặc REFUND_PENDING)
--   -> [worker] issue_tickets + ký QR + attach_ticket_credentials (CONFIRMED)
-- Vé 0đ (FREE, COMP): create_booking chuyển thẳng sang PAID (BR-02), không qua cổng.
-- Một hàm create_booking cho mọi loại Booking (tài liệu mục 3.2: mô hình sẵn cho P1):
--   CUSTOMER  khách tự đặt
--   COMP      vé mời Org phát theo danh sách (issue_comp_tickets), dùng quota hạng COMP
--   POS       Staff bán tại cổng (online), thanh toán qua cổng, phát vé ngay
--   B2B       công ty mua có chiết khấu (P1, mô hình có sẵn)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nội bộ
-- ----------------------------------------------------------------------------
create or replace function public.booking_to_json(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'booking_type', b.booking_type,
    'session_id', b.session_id, 'item_count', b.item_count,
    'list_amount', b.list_amount, 'discount_amount', b.discount_amount, 'total_amount', b.total_amount,
    'currency', b.currency, 'lock_expires_at', b.lock_expires_at, 'payment_deadline_at', b.payment_deadline_at,
    'server_now', now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ticket_type_id', i.ticket_type_id, 'zone_id', i.zone_id, 'seat_id', i.seat_id,
               'seat_code', st.seat_code, 'quantity', i.quantity, 'unit_list_price', i.unit_list_price,
               'unit_discount', i.unit_discount, 'unit_price', i.unit_price)
             order by st.seat_code nulls last)
      from public.booking_items i
      left join public.seats st on st.id = i.seat_id
      where i.booking_id = b.id), '[]'::jsonb))
  from public.bookings b
  where b.id = p_booking_id;
$$;

-- Trả toàn bộ chỗ đang giữ của một Booking. Idempotent: chỉ chạy khi Booking
-- còn PENDING / PAYMENT_PENDING.
create or replace function public.release_booking(p_booking_id uuid, p_new_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
  r   record;
begin
  update public.bookings
     set status = p_new_status,
         lock_expires_at = null,
         expired_at   = case when p_new_status = 'EXPIRED' then now() else expired_at end,
         cancelled_at = case when p_new_status = 'CANCELLED' then now() else cancelled_at end
   where id = p_booking_id and status in ('PENDING', 'PAYMENT_PENDING')
  returning * into v_b;
  if not found then
    return false;
  end if;

  update public.session_seats
     set status = 'AVAILABLE', booking_id = null, lock_expires_at = null, updated_at = now()
   where booking_id = p_booking_id and status = 'LOCKED';

  for r in select zone_id, sum(quantity)::int as n from public.booking_items
           where booking_id = p_booking_id and seat_id is null group by zone_id order by zone_id loop
    update public.session_zone_inventory set locked = locked - r.n, updated_at = now()
     where session_id = v_b.session_id and zone_id = r.zone_id;
  end loop;

  for r in select ticket_type_id, sum(quantity)::int as n from public.booking_items
           where booking_id = p_booking_id group by ticket_type_id order by ticket_type_id loop
    update public.ticket_type_inventory set locked = locked - r.n, updated_at = now()
     where ticket_type_id = r.ticket_type_id;
  end loop;

  if p_new_status in ('EXPIRED', 'CANCELLED') then
    update public.payments set status = 'EXPIRED' where booking_id = p_booking_id and status = 'INITIATED';
  end if;
  return true;
end;
$$;

-- Job mỗi phút + gọi lazy trong create_booking: Booking PENDING quá hạn -> EXPIRED.
-- PAYMENT_PENDING KHÔNG tự hết hạn: phải có kết quả truy vấn cổng (expire_unpaid_booking).
create or replace function public.release_expired_bookings(p_session_id uuid default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r   record;
  v_n int := 0;
begin
  for r in
    select id from public.bookings
    where status = 'PENDING' and lock_expires_at < now()
      and (p_session_id is null or session_id = p_session_id)
    order by id
    for update skip locked
  loop
    if public.release_booking(r.id, 'EXPIRED') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Chuyển chỗ đang giữ thành đã bán. Nếu Booking đã mất chỗ (hết hạn và ghế bị
-- người khác lấy) thì thử khóa lại đúng ghế cũ; không được thì trả false và
-- không thay đổi gì (all-or-nothing).
create or replace function public.secure_booking_inventory(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b         public.bookings%rowtype;
  v_held      boolean;
  v_seat_ids  uuid[];
  v_rows      int;
  r           record;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  v_held := v_b.status in ('PENDING', 'PAYMENT_PENDING');

  if exists (select 1 from public.sessions where id = v_b.session_id and status = 'CANCELLED') then
    return false;
  end if;

  select array_agg(seat_id order by seat_id) into v_seat_ids
  from public.booking_items where booking_id = p_booking_id and seat_id is not null;

  begin
    if v_seat_ids is not null then
      perform 1 from public.session_seats
      where session_id = v_b.session_id and seat_id = any (v_seat_ids)
      order by seat_id for update;

      update public.session_seats
         set status = 'SOLD', booking_id = p_booking_id, lock_expires_at = null, updated_at = now()
       where session_id = v_b.session_id and seat_id = any (v_seat_ids)
         and ((status = 'LOCKED' and booking_id = p_booking_id)
              or status = 'AVAILABLE'
              or (status = 'LOCKED' and lock_expires_at < now()));
      get diagnostics v_rows = row_count;
      if v_rows <> cardinality(v_seat_ids) then
        raise exception using errcode = 'PX001', message = 'INVENTORY_LOST';
      end if;
    end if;

    for r in select zone_id, sum(quantity)::int as n from public.booking_items
             where booking_id = p_booking_id and seat_id is null group by zone_id order by zone_id loop
      if v_held then
        update public.session_zone_inventory set locked = locked - r.n, sold = sold + r.n, updated_at = now()
         where session_id = v_b.session_id and zone_id = r.zone_id;
      else
        update public.session_zone_inventory set sold = sold + r.n, updated_at = now()
         where session_id = v_b.session_id and zone_id = r.zone_id and capacity - sold - locked - held >= r.n;
        if not found then
          raise exception using errcode = 'PX001', message = 'INVENTORY_LOST';
        end if;
      end if;
    end loop;

    for r in select ticket_type_id, sum(quantity)::int as n from public.booking_items
             where booking_id = p_booking_id group by ticket_type_id order by ticket_type_id loop
      if v_held then
        update public.ticket_type_inventory set locked = locked - r.n, sold = sold + r.n, updated_at = now()
         where ticket_type_id = r.ticket_type_id;
      else
        update public.ticket_type_inventory set sold = sold + r.n, updated_at = now()
         where ticket_type_id = r.ticket_type_id and quota - sold - locked >= r.n;
        if not found then
          raise exception using errcode = 'PX001', message = 'INVENTORY_LOST';
        end if;
      end if;
    end loop;

    return true;
  exception when sqlstate 'PX001' then
    return false;
  end;
end;
$$;

create or replace function public.mark_booking_paid(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
     set status = 'PAID', paid_at = now(), lock_expires_at = null
   where id = p_booking_id and status in ('PENDING', 'PAYMENT_PENDING', 'EXPIRED');
  if not found then
    perform public.app_error('INVALID_STATE', jsonb_build_object('booking_id', p_booking_id));
  end if;
  perform public.enqueue('ISSUE_TICKETS', 'booking', p_booking_id);
end;
$$;

-- Platform Fee theo hợp đồng Org (hoặc mặc định), lưu đầu vào để audit
create or replace function public.compute_platform_fee(p_booking_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee      bigint;
  v_b        public.bookings%rowtype;
  v_contract public.org_fee_contracts%rowtype;
  v_bp       int;
  v_fixed    bigint;
begin
  select fee_amount into v_fee from public.platform_fee_calculations where booking_id = p_booking_id;
  if found then
    return v_fee;
  end if;

  select * into v_b from public.bookings where id = p_booking_id;
  select * into v_contract from public.org_fee_contracts
  where org_id = v_b.tenant_id and valid_from <= now() and (valid_to is null or valid_to > now())
  order by valid_from desc limit 1;

  v_bp    := coalesce(v_contract.percent_bp, public.setting_int('fee.default_percent_bp', 500));
  v_fixed := coalesce(v_contract.fixed_per_ticket, 0);
  v_fee   := least(v_b.total_amount, round(v_b.total_amount * v_bp / 10000.0)::bigint + v_fixed * v_b.item_count);

  insert into public.platform_fee_calculations (booking_id, org_id, contract_id, formula_version, inputs, fee_amount)
  values (p_booking_id, v_b.tenant_id, v_contract.id, coalesce(v_contract.formula_version, 'v1-default'),
          jsonb_build_object('total_amount', v_b.total_amount, 'item_count', v_b.item_count,
                             'percent_bp', v_bp, 'fixed_per_ticket', v_fixed),
          v_fee);
  return v_fee;
end;
$$;

-- ----------------------------------------------------------------------------
-- Khách xem chỗ trống (thay cho việc đọc session_seats qua RLS)
-- ----------------------------------------------------------------------------
create or replace function public.get_session_availability(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.sessions%rowtype;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found or not (public.is_session_public(p_session_id) or public.is_org_member(v_s.tenant_id)) then
    perform public.app_error('NOT_FOUND');
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'session_status', v_s.status,
    'sales_paused', v_s.sales_paused,
    -- Chỉ trả ghế KHÔNG trống; ghế không có trong danh sách là còn trống
    'unavailable_seats', coalesce((
      select jsonb_object_agg(seat_id, eff)
      from (select seat_id,
                   case when status = 'LOCKED' and lock_expires_at < now() then 'AVAILABLE' else status end as eff
            from public.session_seats where session_id = p_session_id) x
      where eff <> 'AVAILABLE'), '{}'::jsonb),
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object('zone_id', zone_id,
                                          'remaining', capacity - sold - locked - held))
      from public.session_zone_inventory where session_id = p_session_id), '[]'::jsonb),
    'ticket_types', coalesce((
      select jsonb_agg(jsonb_build_object('ticket_type_id', i.ticket_type_id,
                                          'remaining', i.quota - i.sold - i.locked))
      from public.ticket_type_inventory i
      join public.ticket_types tt on tt.id = i.ticket_type_id
      where i.session_id = p_session_id and tt.visibility = 'PUBLIC' and tt.status = 'ACTIVE'), '[]'::jsonb));
end;
$$;

-- Sơ đồ chỗ của Session cho package seat_map (tài liệu mục 22), tĩnh: client tải một lần rồi cache.
-- id là uuid dùng khi đặt vé; code là id trong JSON Layout.
create or replace function public.get_session_layout(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.sessions%rowtype;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found or not (public.is_session_public(p_session_id) or public.is_org_member(v_s.tenant_id)
                       or public.has_platform_role()) then
    perform public.app_error('NOT_FOUND');
  end if;
  return jsonb_build_object(
    'session_id', v_s.id,
    'layout_version_id', v_s.layout_version_id,
    'version', (select version_no from public.layout_versions where id = v_s.layout_version_id),
    'timezone', (select timezone from public.venues where id = v_s.venue_id),
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', z.id, 'code', z.code, 'name', z.name, 'type', lower(z.kind), 'capacity', z.capacity,
               'color', z.color,
               'seats', coalesce((
                 select jsonb_agg(jsonb_build_object('id', st.id, 'code', st.seat_code, 'section', st.section,
                                                     'row', st.row_label, 'number', st.seat_number,
                                                     'x', st.x, 'y', st.y, 'flags', to_jsonb(st.flags))
                                  order by st.row_label, st.seat_number)
                 from public.seats st where st.zone_id = z.id), '[]'::jsonb))
             order by z.sort_order)
      from public.zones z where z.layout_version_id = v_s.layout_version_id), '[]'::jsonb));
end;
$$;

-- Hạng giá của từng ghế (tĩnh, client tải một lần rồi cache)
create or replace function public.get_session_seat_pricing(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not (public.is_session_public(p_session_id) or public.is_org_member(v_tenant)) then
    perform public.app_error('NOT_FOUND');
  end if;
  return coalesce((
    select jsonb_object_agg(ticket_type_id, seat_ids)
    from (select ticket_type_id, jsonb_agg(seat_id) as seat_ids
          from public.session_seats
          where session_id = p_session_id and ticket_type_id is not null
          group by ticket_type_id) x), '{}'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- create_booking (S2-BE1-1, S3-BE2-2, S6-BE1-1)
-- p_items: [{"ticket_type_id": "...", "seat_id": "..."}]                 khu ngồi
--          [{"ticket_type_id": "...", "quantity": 2, "zone_id": "..."}]  khu đứng (zone_id
--                                                                          tùy chọn nếu hạng vé chỉ có 1 khu đứng)
-- p_options:
--   {}                                                        CUSTOMER
--   {"corporate_account_id": "..."}                           B2B có chiết khấu
--   {"booking_type": "COMP", "recipient_email": "...", "recipient_name": "...", "recipient_phone": "..."}
--                                                             vé mời (OWNER, EVENT_MANAGER); được lấy ghế HELD
--   {"booking_type": "POS", "buyer_name": "...", "buyer_phone": "...", "buyer_email": "..."}
--                                                             bán tại cổng (Staff được phân công quyền POS)
-- ----------------------------------------------------------------------------
create or replace function public.create_booking(p_session_id uuid, p_items jsonb, p_idempotency_key text,
                                                 p_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        uuid := public.assert_authenticated();
  v_existing    uuid;
  v_session     record;
  v_booking_id  uuid := gen_random_uuid();
  v_lock_until  timestamptz;
  v_options     jsonb := coalesce(p_options, '{}'::jsonb);
  v_corp_id     uuid := public.try_uuid(v_options ->> 'corporate_account_id');
  v_agreement   public.corporate_agreements%rowtype;
  v_corp        public.corporate_accounts%rowtype;
  v_type        text;
  v_owner       uuid := v_user;
  v_snapshot    jsonb;
  v_discount_bp int := 0;
  v_requested   int;
  v_already     int;
  v_seat_ids    uuid[];
  v_rows        int;
  v_conflicts   uuid[];
  v_zone        uuid;
  v_zones       uuid[];
  v_bad         jsonb;
  v_profile     public.profiles%rowtype;
  r             record;
begin
  -- 0. Đầu vào
  if coalesce(length(p_idempotency_key), 0) < 8 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_idempotency_key'));
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_items'));
  end if;
  v_type := upper(coalesce(v_options ->> 'booking_type', case when v_corp_id is not null then 'B2B' else 'CUSTOMER' end));
  if v_type not in ('CUSTOMER', 'B2B', 'COMP', 'POS') or (v_corp_id is not null and v_type <> 'B2B')
     or (v_type = 'B2B' and v_corp_id is null) then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_options'));
  end if;

  -- 1. Idempotency: key đã dùng thì trả lại Booking cũ
  select id into v_existing from public.bookings where created_by = v_user and idempotency_key = p_idempotency_key;
  if found then
    return public.booking_to_json(v_existing);
  end if;

  -- 2. Session phải đang bán (Org bị đình chỉ thì dừng bán mọi Session)
  select s.*, e.status as event_status, o.status as org_status into v_session
  from public.sessions s
  join public.events e on e.id = s.event_id
  join public.organizations o on o.id = s.tenant_id
  where s.id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  -- Quyền theo loại Booking
  if v_type = 'COMP' then
    perform public.assert_org_role(v_session.tenant_id, array['OWNER','EVENT_MANAGER']);
  elsif v_type = 'POS' then
    if not public.has_staff_permission(p_session_id, 'POS') then
      perform public.app_error('FORBIDDEN');
    end if;
  end if;

  if v_session.org_status <> 'APPROVED' or v_session.sales_paused
     or (v_type in ('CUSTOMER', 'B2B')
         and (v_session.status <> 'ON_SALE' or v_session.event_status <> 'PUBLISHED'
              or now() < v_session.sales_start_at or now() >= v_session.sales_end_at))
     or (v_type = 'POS'
         and (v_session.status not in ('ON_SALE', 'SALES_CLOSED', 'ONGOING') or v_session.event_status <> 'PUBLISHED'
              or now() >= v_session.ends_at))
     or (v_type = 'COMP'
         and (v_session.status not in ('SCHEDULED', 'ON_SALE', 'SALES_CLOSED', 'ONGOING')
              or v_session.event_status in ('CANCELLED', 'ENDED', 'REJECTED'))) then
    perform public.app_error('SESSION_NOT_ON_SALE',
      jsonb_build_object('status', v_session.status, 'sales_paused', v_session.sales_paused,
                         'org_status', v_session.org_status));
  end if;

  -- Một người tạo một Session tại một thời điểm: chặn hai request song song vượt giới hạn vé
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_session_id::text, 0));

  -- Trả kho của các Booking đã quá hạn trong Session này (lazy)
  perform public.release_expired_bookings(p_session_id);

  -- 3. Người sở hữu vé và thông tin chụp lại
  select * into v_profile from public.profiles where id = v_user;
  if v_type = 'B2B' then
    select * into v_corp from public.corporate_accounts where id = v_corp_id and status = 'ACTIVE';
    if not found or not public.is_corporate_member(v_corp_id) then
      perform public.app_error('FORBIDDEN', jsonb_build_object('reason', 'not a member of corporate account'));
    end if;
    select * into v_agreement from public.corporate_agreements a
    where a.corporate_account_id = v_corp_id and a.tenant_id = v_session.tenant_id and a.status = 'ACTIVE'
      and now() >= a.valid_from and (a.valid_to is null or now() < a.valid_to)
      and (a.event_id is null or a.event_id = v_session.event_id)
      and (a.session_id is null or a.session_id = p_session_id)
    order by (a.session_id is not null) desc, (a.event_id is not null) desc, a.discount_bp desc
    limit 1;
    if not found then
      perform public.app_error('FORBIDDEN', jsonb_build_object('reason', 'no active corporate agreement'));
    end if;
    v_discount_bp := v_agreement.discount_bp;
  end if;

  if v_type = 'COMP' then
    if coalesce(trim(v_options ->> 'recipient_email'), '') = '' or coalesce(trim(v_options ->> 'recipient_name'), '') = '' then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'recipient_email/recipient_name'));
    end if;
    -- Người nhận đã có tài khoản thì vé nằm trong "Vé của tôi"; chưa có thì gửi qua email
    select id into v_owner from auth.users where lower(email) = lower(trim(v_options ->> 'recipient_email'));
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'holder_name', trim(v_options ->> 'recipient_name'), 'holder_email', lower(trim(v_options ->> 'recipient_email')),
      'holder_phone', v_options ->> 'recipient_phone', 'issued_by', v_user));
  elsif v_type = 'POS' then
    v_owner := null;  -- khách vãng lai
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'holder_name', v_options ->> 'buyer_name', 'holder_phone', v_options ->> 'buyer_phone',
      'holder_email', v_options ->> 'buyer_email', 'sold_by', v_user));
  else
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_profile.full_name, 'phone', v_profile.phone,
      'email', (select email from auth.users where id = v_user),
      'company_name', v_corp.name, 'tax_code', v_corp.tax_code,
      'billing_address', v_corp.billing_address, 'invoice_email', v_corp.invoice_email));
  end if;

  -- 4. Kiểm tra từng dòng
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_bad from (
    select jsonb_build_object('index', ord - 1, 'reason', 'invalid ticket type') as e
    from rows from (jsonb_to_recordset(p_items) as (ticket_type_id uuid, seat_id uuid, zone_id uuid, quantity int))
         with ordinality as x(ticket_type_id, seat_id, zone_id, quantity, ord)
    left join public.ticket_types tt on tt.id = x.ticket_type_id and tt.session_id = p_session_id
    where tt.id is null or tt.status <> 'ACTIVE'
       or ((v_type = 'COMP') <> (tt.kind = 'COMP'))           -- vé mời chỉ phát qua COMP
       or (tt.visibility = 'HIDDEN' and v_type = 'CUSTOMER')
       or (v_type in ('CUSTOMER', 'B2B')
           and ((tt.sale_start_at is not null and now() < tt.sale_start_at)
                or (tt.sale_end_at is not null and now() >= tt.sale_end_at)))
    union all
    select jsonb_build_object('index', ord - 1, 'reason', 'seat item must not have quantity > 1')
    from rows from (jsonb_to_recordset(p_items) as (ticket_type_id uuid, seat_id uuid, zone_id uuid, quantity int))
         with ordinality as x(ticket_type_id, seat_id, zone_id, quantity, ord)
    where x.seat_id is not null and coalesce(x.quantity, 1) <> 1
    union all
    select jsonb_build_object('index', ord - 1, 'reason', 'standing item needs quantity >= 1')
    from rows from (jsonb_to_recordset(p_items) as (ticket_type_id uuid, seat_id uuid, zone_id uuid, quantity int))
         with ordinality as x(ticket_type_id, seat_id, zone_id, quantity, ord)
    where x.seat_id is null and coalesce(x.quantity, 0) < 1
    union all
    select jsonb_build_object('seat_id', x.seat_id, 'reason', 'duplicate seat')
    from jsonb_to_recordset(p_items) x(ticket_type_id uuid, seat_id uuid)
    where x.seat_id is not null group by x.seat_id having count(*) > 1
    union all
    -- Ghế phải thuộc Session và đúng hạng giá
    select jsonb_build_object('seat_id', x.seat_id, 'reason', 'seat not sold with this ticket type')
    from jsonb_to_recordset(p_items) x(ticket_type_id uuid, seat_id uuid)
    left join public.session_seats ss on ss.session_id = p_session_id and ss.seat_id = x.seat_id
    where x.seat_id is not null
      and (ss.seat_id is null
           -- ghế đã gán hạng giá thì phải đặt đúng hạng đó (vé mời bỏ qua hạng giá của ghế)
           or (ss.ticket_type_id is not null and ss.ticket_type_id <> x.ticket_type_id and v_type <> 'COMP')
           -- còn lại: hạng vé phải áp dụng cho Zone của ghế
           or ((ss.ticket_type_id is null or v_type = 'COMP') and not exists (
                 select 1 from public.ticket_type_zones tz
                 where tz.ticket_type_id = x.ticket_type_id and tz.zone_id = ss.zone_id)))
    union all
    select jsonb_build_object('ticket_type_id', x.ticket_type_id, 'reason', 'exceeds max_per_order',
                              'max_per_order', tt.max_per_order)
    from jsonb_to_recordset(p_items) x(ticket_type_id uuid, seat_id uuid, quantity int)
    join public.ticket_types tt on tt.id = x.ticket_type_id
    where v_type <> 'COMP'
    group by x.ticket_type_id, tt.max_per_order
    having sum(case when x.seat_id is not null then 1 else coalesce(x.quantity, 0) end) > tt.max_per_order
  ) bad;
  if jsonb_array_length(v_bad) > 0 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('errors', v_bad));
  end if;

  select sum(case when x.seat_id is not null then 1 else x.quantity end)::int into v_requested
  from jsonb_to_recordset(p_items) x(seat_id uuid, quantity int);

  -- 5. Giới hạn vé
  if v_type = 'B2B' then
    if v_requested < v_agreement.min_tickets_per_order then
      perform public.app_error('VALIDATION_FAILED',
        jsonb_build_object('reason', 'below min_tickets_per_order', 'min', v_agreement.min_tickets_per_order));
    end if;
    if v_agreement.max_tickets_total is not null then
      select coalesce(sum(i.quantity), 0)::int into v_already
      from public.bookings b join public.booking_items i on i.booking_id = b.id
      where b.corporate_agreement_id = v_agreement.id
        and b.status in ('PENDING', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED');
      if v_already + v_requested > v_agreement.max_tickets_total then
        perform public.app_error('LIMIT_EXCEEDED',
          jsonb_build_object('limit', v_agreement.max_tickets_total, 'held', v_already));
      end if;
    end if;
  elsif v_type = 'CUSTOMER' then
    select coalesce(sum(i.quantity), 0)::int into v_already
    from public.bookings b join public.booking_items i on i.booking_id = b.id
    where b.user_id = v_user and b.session_id = p_session_id and b.booking_type = 'CUSTOMER'
      and (b.status in ('PAYMENT_PENDING', 'PAID', 'CONFIRMED')
           or (b.status = 'PENDING' and b.lock_expires_at > now()));
    if v_already + v_requested > v_session.max_tickets_per_account then
      perform public.app_error('LIMIT_EXCEEDED',
        jsonb_build_object('limit', v_session.max_tickets_per_account, 'held', v_already));
    end if;
  end if;

  -- 6. Tạo Booking (giá và hạn giữ do server quyết định)
  v_lock_until := now() + make_interval(mins => public.setting_int('booking.lock_minutes', 10));
  begin
    insert into public.bookings (id, tenant_id, session_id, user_id, created_by, booking_type, status,
                                 idempotency_key, discount_bp, corporate_account_id, corporate_agreement_id,
                                 buyer_snapshot, sold_by, lock_expires_at)
    values (v_booking_id, v_session.tenant_id, p_session_id, v_owner, v_user, v_type, 'PENDING',
            p_idempotency_key, v_discount_bp, v_corp_id, v_agreement.id, v_snapshot,
            case when v_type = 'POS' then v_user end, v_lock_until);
  exception when unique_violation then
    -- Hai request cùng idempotency key chạy song song: trả Booking của request thắng
    select id into v_existing from public.bookings where created_by = v_user and idempotency_key = p_idempotency_key;
    return public.booking_to_json(v_existing);
  end;

  -- 7. Khóa ghế: all-or-nothing, khóa dòng theo thứ tự seat_id để tránh deadlock (tài liệu mục 20.3)
  select array_agg(x.seat_id order by x.seat_id) into v_seat_ids
  from jsonb_to_recordset(p_items) x(seat_id uuid) where x.seat_id is not null;

  if v_seat_ids is not null then
    perform 1 from public.session_seats
    where session_id = p_session_id and seat_id = any (v_seat_ids)
    order by seat_id for update;

    update public.session_seats
       set status = 'LOCKED', booking_id = v_booking_id, lock_expires_at = v_lock_until,
           hold_reason = null, held_by = null, updated_at = now()
     where session_id = p_session_id and seat_id = any (v_seat_ids)
       and (status = 'AVAILABLE'
            or (status = 'LOCKED' and lock_expires_at < now())
            or (status = 'HELD' and v_type = 'COMP'));   -- ghế Org giữ cho khách mời
    get diagnostics v_rows = row_count;

    if v_rows <> cardinality(v_seat_ids) then
      select array_agg(sid) into v_conflicts from unnest(v_seat_ids) sid
      where not exists (select 1 from public.session_seats
                        where session_id = p_session_id and seat_id = sid and booking_id = v_booking_id);
      perform public.app_error('SEAT_CONFLICT', jsonb_build_object('seat_ids', to_jsonb(v_conflicts)));
    end if;

    insert into public.booking_items (booking_id, tenant_id, session_id, ticket_type_id, zone_id, seat_id, quantity,
                                      unit_list_price, unit_discount, unit_price)
    select v_booking_id, v_session.tenant_id, p_session_id, x.ticket_type_id, ss.zone_id, x.seat_id, 1,
           tt.price_amount, (tt.price_amount * v_discount_bp / 10000),
           tt.price_amount - (tt.price_amount * v_discount_bp / 10000)
    from jsonb_to_recordset(p_items) x(ticket_type_id uuid, seat_id uuid)
    join public.session_seats ss on ss.session_id = p_session_id and ss.seat_id = x.seat_id
    join public.ticket_types tt on tt.id = x.ticket_type_id
    where x.seat_id is not null;
  end if;

  -- 8. Khu đứng: tăng locked với điều kiện sold + locked + held + n <= capacity.
  --    Vé mời được dùng phần held (chỗ Org giữ) sau khi hết chỗ trống.
  for r in
    select x.ticket_type_id, x.zone_id, sum(x.quantity)::int as n
    from jsonb_to_recordset(p_items) x(ticket_type_id uuid, seat_id uuid, zone_id uuid, quantity int)
    where x.seat_id is null
    group by x.ticket_type_id, x.zone_id
    order by x.ticket_type_id, x.zone_id
  loop
    select array_agg(tz.zone_id) into v_zones
    from public.ticket_type_zones tz join public.zones z on z.id = tz.zone_id
    where tz.ticket_type_id = r.ticket_type_id and z.kind = 'STANDING'
      and (r.zone_id is null or tz.zone_id = r.zone_id);
    if coalesce(cardinality(v_zones), 0) <> 1 then
      perform public.app_error('VALIDATION_FAILED',
        jsonb_build_object('ticket_type_id', r.ticket_type_id, 'reason', 'zone_id required or invalid'));
    end if;
    v_zone := v_zones[1];

    if v_type = 'COMP' then
      update public.session_zone_inventory
         set held = held - greatest(0, r.n - greatest(capacity - sold - locked - held, 0)),
             locked = locked + r.n, updated_at = now()
       where session_id = p_session_id and zone_id = v_zone and capacity - sold - locked >= r.n;
    else
      update public.session_zone_inventory
         set locked = locked + r.n, updated_at = now()
       where session_id = p_session_id and zone_id = v_zone and capacity - sold - locked - held >= r.n;
    end if;
    if not found then
      perform public.app_error('SOLD_OUT', jsonb_build_object('zone_id', v_zone, 'remaining',
        (select capacity - sold - locked - held from public.session_zone_inventory
         where session_id = p_session_id and zone_id = v_zone)));
    end if;

    insert into public.booking_items (booking_id, tenant_id, session_id, ticket_type_id, zone_id, quantity,
                                      unit_list_price, unit_discount, unit_price)
    select v_booking_id, v_session.tenant_id, p_session_id, tt.id, v_zone, r.n,
           tt.price_amount, (tt.price_amount * v_discount_bp / 10000),
           tt.price_amount - (tt.price_amount * v_discount_bp / 10000)
    from public.ticket_types tt where tt.id = r.ticket_type_id;
  end loop;

  -- 9. Quota cố định của từng hạng vé (áp dụng cả vé FREE và COMP)
  for r in
    select ticket_type_id, sum(quantity)::int as n from public.booking_items
    where booking_id = v_booking_id group by ticket_type_id order by ticket_type_id
  loop
    update public.ticket_type_inventory
       set locked = locked + r.n, updated_at = now()
     where ticket_type_id = r.ticket_type_id and quota - sold - locked >= r.n;
    if not found then
      perform public.app_error('SOLD_OUT', jsonb_build_object('ticket_type_id', r.ticket_type_id, 'remaining',
        (select quota - sold - locked from public.ticket_type_inventory where ticket_type_id = r.ticket_type_id)));
    end if;
  end loop;

  -- 10. Chụp tổng tiền
  update public.bookings b set
    item_count      = t.cnt,
    list_amount     = t.list_total,
    discount_amount = t.discount_total,
    total_amount    = t.list_total - t.discount_total
  from (select sum(quantity)::int as cnt,
               sum(unit_list_price * quantity)::bigint as list_total,
               sum(unit_discount * quantity)::bigint as discount_total
        from public.booking_items where booking_id = v_booking_id) t
  where b.id = v_booking_id;

  -- 11. Vé 0đ: chuyển thẳng sang PAID, worker phát vé
  if (select total_amount from public.bookings where id = v_booking_id) = 0 then
    if not public.secure_booking_inventory(v_booking_id) then
      perform public.app_error('SOLD_OUT');
    end if;
    perform public.mark_booking_paid(v_booking_id);
  end if;

  if v_type in ('COMP', 'POS') then
    perform public.write_audit('BOOKING.' || v_type, 'booking', v_booking_id::text, v_session.tenant_id, null,
                               jsonb_build_object('items', v_requested, 'recipient', v_snapshot ->> 'holder_email'));
  end if;
  return public.booking_to_json(v_booking_id);
end;
$$;

-- Phát vé mời theo danh sách (S3-BE2-2, FR-EVT-05). Mỗi người nhận một Booking COMP
-- (vé thuộc về người nhận), trừ quota của hạng COMP. All-or-nothing.
-- p_recipients: [{"email": "...", "name": "...", "phone": "...", "seat_id": "...", "quantity": 1, "zone_id": "..."}]
create or replace function public.issue_comp_tickets(p_session_id uuid, p_ticket_type_id uuid,
                                                     p_recipients jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid;
  r         record;
  v_res     jsonb := '[]'::jsonb;
  v_booking jsonb;
  v_msg     text;
  v_detail  text;
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

create or replace function public.get_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_authenticated();
  if not public.can_view_booking(p_booking_id) then
    perform public.app_error('NOT_FOUND');
  end if;
  return public.booking_to_json(p_booking_id);
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_b    public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found or (v_b.created_by <> v_user and v_b.user_id is distinct from v_user) then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_b.status <> 'PENDING' then
    -- PAYMENT_PENDING không hủy được: tiền có thể đang trên đường về
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_b.status));
  end if;
  perform public.release_booking(p_booking_id, 'CANCELLED');
  return public.booking_to_json(p_booking_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Thanh toán
-- ----------------------------------------------------------------------------
-- Gọi từ API .NET POST /payments/sessions (bằng JWT của khách / Staff POS); API
-- dùng order_ref + amount để tạo URL cổng với thời hạn payment.session_minutes.
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
    -- Phiên cũ đã hết hạn: không mở phiên mới, chờ job truy vấn cổng xác nhận
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_b.status,
                             'reason', 'awaiting gateway confirmation'));
  end if;

  if v_b.status <> 'PENDING' then
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

  update public.bookings
     set status = 'PAYMENT_PENDING', lock_expires_at = v_lock, payment_deadline_at = v_deadline
   where id = p_booking_id and status = 'PENDING';
  update public.session_seats set lock_expires_at = v_lock, updated_at = now()
   where booking_id = p_booking_id and status = 'LOCKED';

  insert into public.payments (booking_id, org_id, gateway, order_ref, amount)
  values (p_booking_id, v_b.tenant_id, p_gateway,
          v_b.code || '-' || (select count(*) + 1 from public.payments where booking_id = p_booking_id),
          v_b.total_amount)
  returning * into v_pay;

  return jsonb_build_object('booking', public.booking_to_json(p_booking_id),
    'payment', jsonb_build_object('order_ref', v_pay.order_ref, 'amount', v_pay.amount, 'gateway', v_pay.gateway,
                                  'expires_at', now() + make_interval(mins => v_minutes)));
end;
$$;

-- Gọi từ API .NET POST /payments/ipn (service_role) SAU KHI đã xác thực chữ ký cổng.
-- Xử lý trong một transaction: IPN trùng, sai số tiền, trả muộn (E-BKG-05..08).
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
begin
  select * into v_pay from public.payments where order_ref = p_order_ref for update;
  if not found then
    perform public.app_error('NOT_FOUND', jsonb_build_object('order_ref', p_order_ref));
  end if;

  -- IPN trùng (E-BKG-07): trả thành công cho cổng và dừng
  if v_pay.status = 'SUCCEEDED' then
    if v_pay.gateway_txn_id = p_gateway_txn_id then
      return jsonb_build_object('result', 'DUPLICATE', 'booking_id', v_pay.booking_id);
    end if;
    perform public.enqueue('ADMIN_ALERT', 'payment', v_pay.id,
      jsonb_build_object('type', 'SECOND_TXN_SAME_ORDER', 'gateway_txn_id', p_gateway_txn_id));
    return jsonb_build_object('result', 'NEEDS_REVIEW', 'booking_id', v_pay.booking_id);
  end if;
  if exists (select 1 from public.payments where gateway_txn_id = p_gateway_txn_id) then
    return jsonb_build_object('result', 'DUPLICATE');
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

  update public.payments
     set status = 'SUCCEEDED', gateway_txn_id = p_gateway_txn_id, ipn_payload = p_payload,
         method = p_payload ->> 'method', paid_at = now()
   where id = v_pay.id;

  select * into v_b from public.bookings where id = v_pay.booking_id for update;

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

-- Cổng báo giao dịch thất bại / khách hủy trên trang cổng. Booking vẫn PAYMENT_PENDING
-- cho đến khi job truy vấn giao dịch xác nhận (không tự trả chỗ).
create or replace function public.apply_payment_failure(p_order_ref text, p_reason text,
                                                        p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments%rowtype;
begin
  select * into v_pay from public.payments where order_ref = p_order_ref for update;
  if not found then
    perform public.app_error('NOT_FOUND', jsonb_build_object('order_ref', p_order_ref));
  end if;
  update public.payments set status = 'FAILED', failure_reason = p_reason, ipn_payload = p_payload
   where id = v_pay.id and status = 'INITIATED';
  return jsonb_build_object('result', case when found then 'FAILED' else 'IGNORED' end, 'booking_id', v_pay.booking_id);
end;
$$;

-- Job truy vấn giao dịch (job .NET, mỗi 2 phút): các Booking PAYMENT_PENDING có
-- phiên cổng đã hết hạn, cần hỏi cổng xem đã thu tiền chưa.
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
  order by p.initiated_at
  limit p_limit;
$$;

-- Job truy vấn giao dịch xác nhận cổng CHƯA thu tiền -> trả chỗ
create or replace function public.expire_unpaid_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.release_booking(p_booking_id, 'EXPIRED');
end;
$$;

-- ----------------------------------------------------------------------------
-- Refund engine (S5-BE1-1). Idempotency key gửi sang cổng = refunds.id: worker có
-- chạy lại thì cổng cũng không hoàn hai lần cho cùng một Refund.
-- ----------------------------------------------------------------------------
-- Worker (refund-worker, service_role) nhận Refund: REQUESTED/FAILED -> PROCESSING.
-- Refund cần duyệt (approval_id) chỉ được xử lý khi đã APPROVED.
create or replace function public.start_refund_processing(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r   public.refunds%rowtype;
  v_pay public.payments%rowtype;
begin
  select * into v_r from public.refunds where id = p_refund_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_r.approval_id is not null
     and (select status from public.approvals where id = v_r.approval_id) <> 'APPROVED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'refund awaiting approval'));
  end if;
  if v_r.status in ('REQUESTED', 'FAILED') then
    update public.refunds set status = 'PROCESSING', attempts = attempts + 1 where id = p_refund_id;
  elsif v_r.status <> 'PROCESSING' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_r.status));
  end if;

  select * into v_pay from public.payments where id = v_r.payment_id;
  return jsonb_build_object('refund_id', v_r.id, 'idempotency_key', v_r.id, 'amount', v_r.amount,
                            'gateway', v_pay.gateway, 'order_ref', v_pay.order_ref,
                            'gateway_txn_id', v_pay.gateway_txn_id, 'method', v_pay.method);
end;
$$;

-- Ghi nhận hoàn tiền thành công: bút toán, vé REFUNDED, trạng thái Booking, thông báo.
-- Dùng chung cho cổng hoàn (apply_refund_result) và chuyển khoản thủ công.
create or replace function public.finalize_refund_success(p_refund_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r        public.refunds%rowtype;
  v_b        public.bookings%rowtype;
  v_fee      bigint;
  v_fee_back bigint;
  v_refunded bigint;
begin
  update public.refunds
     set status = 'SUCCEEDED', gateway_refund_id = coalesce(p_reference, gateway_refund_id), succeeded_at = now()
   where id = p_refund_id and status in ('PROCESSING', 'MANUAL_TRANSFER')
  returning * into v_r;
  if not found then
    perform public.app_error('INVALID_STATE', jsonb_build_object('refund_id', p_refund_id));
  end if;
  select * into v_b from public.bookings where id = v_r.booking_id for update;

  if v_r.reason in ('LATE_PAYMENT_NO_SEAT', 'DUPLICATE_PAYMENT') then
    -- Tiền chưa từng thuộc về Org: trả từ khoản phải hoàn của nền tảng
    perform public.post_ledger_transaction('REFUND_ISSUED', v_r.org_id, v_b.session_id, 'REFUND', v_r.id,
      jsonb_build_array(
        jsonb_build_object('account_code', 'PLATFORM:REFUND_PAYABLE', 'direction', 'DEBIT', 'amount', v_r.amount),
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'CREDIT', 'amount', v_r.amount)));
    if v_r.reason = 'LATE_PAYMENT_NO_SEAT' then
      update public.bookings set status = 'REFUNDED' where id = v_b.id and status = 'REFUND_PENDING';
    end if;
  else
    -- Hoàn vé đã bán: trừ khoản phải trả Org, hoàn cả phần Platform Fee tương ứng
    select coalesce(fee_amount, 0) into v_fee from public.platform_fee_calculations where booking_id = v_b.id;
    v_fee_back := case when v_b.total_amount > 0
                       then round(coalesce(v_fee, 0) * v_r.amount / v_b.total_amount::numeric)::bigint else 0 end;
    perform public.post_ledger_transaction('REFUND_ISSUED', v_r.org_id, v_b.session_id, 'REFUND', v_r.id,
      jsonb_build_array(
        jsonb_build_object('account_code', public.org_payable_account(v_r.org_id), 'direction', 'DEBIT',
                           'amount', v_r.amount - v_fee_back),
        jsonb_build_object('account_code', 'PLATFORM:FEE_REVENUE', 'direction', 'DEBIT', 'amount', v_fee_back),
        jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'CREDIT', 'amount', v_r.amount)));

    update public.tickets t set status = 'REFUNDED'
    from public.refund_items ri
    where ri.refund_id = v_r.id and ri.ticket_id = t.id and t.status = 'REFUND_PENDING';

    select coalesce(sum(amount), 0) into v_refunded from public.refunds
    where booking_id = v_b.id and status = 'SUCCEEDED' and reason not in ('LATE_PAYMENT_NO_SEAT', 'DUPLICATE_PAYMENT');
    update public.bookings
       set status = case when v_refunded >= total_amount then 'REFUNDED' else 'PARTIALLY_REFUNDED' end
     where id = v_b.id and status in ('REFUND_PENDING', 'PAID', 'CONFIRMED', 'PARTIALLY_REFUNDED');
  end if;

  perform public.enqueue('NOTIFY_USER', 'refund', v_r.id, jsonb_build_object('type', 'REFUND_SUCCEEDED'));
end;
$$;

-- Kết quả hoàn tiền từ cổng (refund-worker, service_role). Idempotent.
create or replace function public.apply_refund_result(p_refund_id uuid, p_success boolean,
                                                      p_gateway_refund_id text default null,
                                                      p_error text default null,
                                                      p_needs_bank_info boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.refunds where id = p_refund_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_status = 'SUCCEEDED' then
    return v_status;
  end if;
  if v_status <> 'PROCESSING' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_status));
  end if;

  if p_success then
    perform public.finalize_refund_success(p_refund_id, p_gateway_refund_id);
    return 'SUCCEEDED';
  end if;

  -- Hoàn về phương thức gốc bị từ chối: thu tài khoản ngân hàng của khách (FR-RFD-03)
  update public.refunds
     set status = case when p_needs_bank_info then 'AWAITING_BANK_INFO' else 'FAILED' end, last_error = p_error
   where id = p_refund_id
  returning status into v_status;
  perform public.enqueue(case when p_needs_bank_info then 'NOTIFY_USER' else 'ADMIN_ALERT' end, 'refund', p_refund_id,
                         jsonb_build_object('type', case when p_needs_bank_info then 'REFUND_NEEDS_BANK_INFO'
                                                         else 'REFUND_FAILED' end, 'error', p_error));
  return v_status;
end;
$$;

-- ----------------------------------------------------------------------------
-- Phát vé (worker, service_role)
-- ----------------------------------------------------------------------------
-- Bước 1: sinh vé (idempotent) và trả payload cần ký. Payload chỉ chứa id, không có dữ liệu cá nhân.
create or replace function public.issue_tickets(p_booking_id uuid, p_kid text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_b.status not in ('PAID', 'CONFIRMED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_b.status));
  end if;
  if not exists (select 1 from public.signing_keys where kid = p_kid and status = 'ACTIVE') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_kid'));
  end if;

  if not exists (select 1 from public.tickets where booking_id = p_booking_id) then
    -- Vé mời / POS: tên người dùng vé lấy từ thông tin chụp lúc tạo Booking
    insert into public.tickets (tenant_id, booking_id, booking_item_id, session_id, ticket_type_id, zone_id,
                                seat_id, owner_id, holder_name, holder_email, holder_phone)
    select v_b.tenant_id, v_b.id, i.id, i.session_id, i.ticket_type_id, i.zone_id, i.seat_id, v_b.user_id,
           v_b.buyer_snapshot ->> 'holder_name', v_b.buyer_snapshot ->> 'holder_email',
           v_b.buyer_snapshot ->> 'holder_phone'
    from public.booking_items i
    cross join lateral generate_series(1, i.quantity)
    where i.booking_id = p_booking_id;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'ticket_id', t.id,
             'payload', jsonb_build_object('v', 1, 'tid', t.id, 'sid', t.session_id, 'zid', t.zone_id,
                                           'kid', p_kid, 'iat', extract(epoch from now())::bigint)::text))
    from public.tickets t
    where t.booking_id = p_booking_id
      and not exists (select 1 from public.ticket_credentials c where c.ticket_id = t.id)), '[]'::jsonb);
end;
$$;

-- Bước 2: lưu chữ ký; đủ chữ ký thì Booking CONFIRMED
-- p_items: [{"ticket_id": "...", "kid": "...", "payload": "...", "signature": "..."}]
create or replace function public.attach_ticket_credentials(p_booking_id uuid, p_items jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.bookings where id = p_booking_id;

  insert into public.ticket_credentials (ticket_id, tenant_id, kid, payload, signature)
  select x.ticket_id, v_tenant, x.kid, x.payload, x.signature
  from jsonb_to_recordset(p_items) x(ticket_id uuid, kid text, payload text, signature text)
  join public.tickets t on t.id = x.ticket_id and t.booking_id = p_booking_id
  on conflict (ticket_id) do nothing;

  if not exists (select 1 from public.tickets t
                 where t.booking_id = p_booking_id
                   and not exists (select 1 from public.ticket_credentials c where c.ticket_id = t.id)) then
    update public.bookings set status = 'CONFIRMED', confirmed_at = now()
     where id = p_booking_id and status = 'PAID';
    if found then
      perform public.enqueue('NOTIFY_USER', 'booking', p_booking_id, jsonb_build_object('type', 'TICKETS_ISSUED'));
    end if;
  end if;
  return (select status from public.bookings where id = p_booking_id);
end;
$$;

-- B2B: chủ đơn ghi tên người dùng vé (lần đầu). Đổi người đã gán = chuyển nhượng (P1):
-- vé cũ VOID, phát vé mới; không sửa vé đã phát.
create or replace function public.assign_ticket_holder(p_ticket_id uuid, p_name text, p_email text default null,
                                                       p_phone text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_t    public.tickets%rowtype;
begin
  select * into v_t from public.tickets where id = p_ticket_id for update;
  if not found or v_t.owner_id is distinct from v_user then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_t.status <> 'ISSUED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_t.status));
  end if;
  if v_t.holder_name is not null then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'holder already assigned; use transfer (P1)'));
  end if;
  if coalesce(trim(p_name), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_name'));
  end if;
  update public.tickets set holder_name = trim(p_name), holder_email = p_email, holder_phone = p_phone
   where id = p_ticket_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Quyền
-- ----------------------------------------------------------------------------
grant execute on function
  public.get_session_layout(uuid),
  public.get_session_availability(uuid),
  public.get_session_seat_pricing(uuid)
to anon, authenticated;

grant execute on function
  public.create_booking(uuid, jsonb, text, jsonb),
  public.issue_comp_tickets(uuid, uuid, jsonb, text),
  public.get_booking(uuid),
  public.cancel_booking(uuid),
  public.begin_payment(uuid, text),
  public.assign_ticket_holder(uuid, text, text, text)
to authenticated;

-- Chỉ server (backend .NET dùng service_role) — không cấp cho authenticated:
--   apply_payment_success, apply_payment_failure, list_payment_pending_to_query,
--   expire_unpaid_booking, start_refund_processing, apply_refund_result,
--   issue_tickets, attach_ticket_credentials, release_expired_bookings


-- ############################################################################
-- PHẦN 17 (1700) · rpc_staff_gate
-- ############################################################################

-- ============================================================================
-- 1700 · RPC: phân công Staff, thiết bị cổng, soát vé online/offline,
--        check-in thủ công, lưu lượng cổng
-- ============================================================================

-- Thiết bị phải ACTIVE và thuộc đúng Org; bị thu hồi thì app xóa dữ liệu local
create or replace function public.assert_gate_device(p_device_id uuid, p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.gate_devices where id = p_device_id and tenant_id = p_tenant_id;
  if v_status is null then
    perform public.app_error('FORBIDDEN', jsonb_build_object('reason', 'unknown device'));
  elsif v_status = 'REVOKED' then
    perform public.app_error('DEVICE_REVOKED');
  end if;
  update public.gate_devices set last_seen_at = now() where id = p_device_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Cấu hình cổng – Zone, phân công Staff
-- ----------------------------------------------------------------------------
-- p_config: [{"gate_id": "...", "zone_ids": ["...", "..."]}]
create or replace function public.set_session_gate_zones(p_session_id uuid, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.sessions%rowtype;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  perform public.assert_org_role(v_s.tenant_id, array['OWNER','EVENT_MANAGER','GATE_MANAGER']);
  if v_s.status in ('ENDED', 'CANCELLED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_s.status));
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_config) c(gate_id uuid, zone_ids jsonb)
    cross join lateral jsonb_array_elements_text(c.zone_ids) z
    where not exists (select 1 from public.gates g where g.id = c.gate_id and g.venue_id = v_s.venue_id)
       or not exists (select 1 from public.zones zn
                      where zn.id = z::uuid and zn.layout_version_id = v_s.layout_version_id)) then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_config'));
  end if;

  delete from public.session_gate_zones where session_id = p_session_id;
  insert into public.session_gate_zones (session_id, gate_id, zone_id, tenant_id)
  select distinct p_session_id, c.gate_id, z::uuid, v_s.tenant_id
  from jsonb_to_recordset(p_config) c(gate_id uuid, zone_ids jsonb)
  cross join lateral jsonb_array_elements_text(c.zone_ids) z;
end;
$$;

create or replace function public.assign_staff(p_session_id uuid, p_user_id uuid, p_permissions text[],
                                               p_gate_id uuid default null,
                                               p_valid_from timestamptz default null,
                                               p_valid_until timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s     public.sessions%rowtype;
  v_actor uuid;
  v_roles text[];
  v_id    uuid;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_actor := public.assert_org_role(v_s.tenant_id, array['OWNER','GATE_MANAGER']);
  if v_s.status in ('ENDED', 'CANCELLED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_s.status));
  end if;

  select roles into v_roles from public.memberships
  where user_id = p_user_id and org_id = v_s.tenant_id and scope = 'ORG' and status = 'ACTIVE';
  if v_roles is null or not v_roles && array['SCANNER','POS','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'user is not staff of this org'));
  end if;
  if 'POS' = any (p_permissions) and not v_roles && array['POS','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'POS permission requires POS role'));
  end if;
  if (p_permissions && array['SCAN','MANUAL_CHECKIN']) and not v_roles && array['SCANNER','GATE_MANAGER'] then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'scan permission requires SCANNER role'));
  end if;
  if p_gate_id is not null and not exists (select 1 from public.gates where id = p_gate_id and venue_id = v_s.venue_id) then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_gate_id'));
  end if;

  begin
    insert into public.staff_assignments (tenant_id, session_id, user_id, gate_id, permissions, valid_from,
                                          valid_until, assigned_by)
    values (v_s.tenant_id, p_session_id, p_user_id, p_gate_id, p_permissions,
            coalesce(p_valid_from, v_s.doors_open_at - make_interval(hours => public.setting_int('gate.presync_hours', 2))),
            coalesce(p_valid_until, v_s.ends_at + interval '1 hour'),
            v_actor)
    returning id into v_id;
  exception when check_violation then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_permissions/valid_*'));
  end;

  perform public.enqueue('NOTIFY_USER', 'staff_assignment', v_id, jsonb_build_object('type', 'STAFF_ASSIGNED'));
  perform public.write_audit('STAFF.ASSIGN', 'staff_assignment', v_id::text, v_s.tenant_id, null,
                             jsonb_build_object('user_id', p_user_id, 'permissions', p_permissions, 'gate_id', p_gate_id));
  return v_id;
end;
$$;

create or replace function public.revoke_staff_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a     public.staff_assignments%rowtype;
  v_actor uuid;
begin
  select * into v_a from public.staff_assignments where id = p_assignment_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_actor := public.assert_org_role(v_a.tenant_id, array['OWNER','GATE_MANAGER']);
  update public.staff_assignments set status = 'REVOKED', revoked_by = v_actor, revoked_at = now()
   where id = p_assignment_id and status = 'ACTIVE';
  perform public.write_audit('STAFF.REVOKE', 'staff_assignment', p_assignment_id::text, v_a.tenant_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Thiết bị
-- ----------------------------------------------------------------------------
create or replace function public.register_gate_device(p_org_id uuid, p_fingerprint text, p_name text, p_platform text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_org_role(p_org_id, array['SCANNER','POS','GATE_MANAGER']);
  v_dev  public.gate_devices%rowtype;
begin
  select * into v_dev from public.gate_devices where tenant_id = p_org_id and device_fingerprint = p_fingerprint;
  if found then
    if v_dev.status = 'REVOKED' then
      perform public.app_error('DEVICE_REVOKED');
    end if;
    update public.gate_devices set last_seen_at = now(), name = coalesce(p_name, name) where id = v_dev.id;
  else
    insert into public.gate_devices (tenant_id, device_fingerprint, name, platform, registered_by, last_seen_at)
    values (p_org_id, p_fingerprint, p_name, p_platform, v_user, now())
    returning * into v_dev;
    perform public.write_audit('DEVICE.REGISTER', 'gate_device', v_dev.id::text, p_org_id);
  end if;

  return jsonb_build_object(
    'device_id', v_dev.id,
    'public_keys', coalesce((select jsonb_agg(jsonb_build_object('kid', kid, 'public_key', public_key, 'status', status))
                             from public.signing_keys), '[]'::jsonb));
end;
$$;

create or replace function public.revoke_gate_device(p_device_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dev   public.gate_devices%rowtype;
  v_actor uuid;
begin
  select * into v_dev from public.gate_devices where id = p_device_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  v_actor := public.assert_org_role(v_dev.tenant_id, array['OWNER','GATE_MANAGER']);
  update public.gate_devices
     set status = 'REVOKED', revoked_by = v_actor, revoked_at = now(), revoke_reason = p_reason
   where id = p_device_id;
  perform public.write_audit('DEVICE.REVOKE', 'gate_device', p_device_id::text, v_dev.tenant_id,
                             null, jsonb_build_object('reason', p_reason));
end;
$$;

-- ----------------------------------------------------------------------------
-- Manifest + revocation list (đầy đủ khi p_since null, delta khi có p_since)
-- ----------------------------------------------------------------------------
create or replace function public.get_session_manifest(p_session_id uuid, p_device_id uuid,
                                                       p_since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s  public.sessions%rowtype;
  v_now timestamptz := now();
begin
  perform public.assert_authenticated();
  select * into v_s from public.sessions where id = p_session_id;
  if not found or not public.has_staff_permission(p_session_id, 'SCAN') then
    perform public.app_error('FORBIDDEN');
  end if;
  perform public.assert_gate_device(p_device_id, v_s.tenant_id);
  update public.gate_devices set last_sync_at = v_now where id = p_device_id;

  return jsonb_build_object(
    'server_now', v_now,
    'session', jsonb_build_object('id', v_s.id, 'starts_at', v_s.starts_at, 'ends_at', v_s.ends_at,
                                  'doors_open_at', v_s.doors_open_at, 'status', v_s.status,
                                  'timezone', (select timezone from public.venues where id = v_s.venue_id)),
    'gate_zones', coalesce((select jsonb_agg(jsonb_build_object('gate_id', gate_id, 'zone_id', zone_id))
                            from public.session_gate_zones where session_id = p_session_id), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'zone_id', t.zone_id, 'seat_code', st.seat_code,
                                          'status', t.status, 'used_at', t.used_at))
      from public.tickets t
      left join public.seats st on st.id = t.seat_id
      where t.session_id = p_session_id
        and t.status in ('ISSUED', 'USED')
        and (p_since is null or t.status_changed_at > p_since)), '[]'::jsonb),
    'revoked_ticket_ids', coalesce((
      select jsonb_agg(t.id) from public.tickets t
      where t.session_id = p_session_id
        and t.status in ('VOID', 'REFUND_PENDING', 'REFUNDED')
        and (p_since is null or t.status_changed_at > p_since)), '[]'::jsonb),
    'public_keys', coalesce((select jsonb_agg(jsonb_build_object('kid', kid, 'public_key', public_key))
                             from public.signing_keys), '[]'::jsonb));
end;
$$;

-- ----------------------------------------------------------------------------
-- Lõi soát vé (online và thủ công). Cập nhật có điều kiện ISSUED -> USED.
-- ----------------------------------------------------------------------------
create or replace function public.apply_scan(p_ticket_id uuid, p_session_id uuid, p_gate_id uuid, p_device_id uuid,
                                             p_mode text, p_client_scan_id text, p_details jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_s       public.sessions%rowtype;
  v_t       public.tickets%rowtype;
  v_result  text;
  v_info    jsonb := '{}'::jsonb;
  v_prev    record;
begin
  if p_client_scan_id is not null then
    select result, details into v_prev from public.scan_logs
    where device_id = p_device_id and client_scan_id = p_client_scan_id;
    if found then
      return jsonb_build_object('result', v_prev.result, 'replayed', true) || v_prev.details;
    end if;
  end if;

  select * into v_s from public.sessions where id = p_session_id;
  select * into v_t from public.tickets where id = p_ticket_id for update;

  if not found then
    v_result := 'INVALID_SIGNATURE';
  elsif v_t.session_id <> p_session_id then
    v_result := 'WRONG_SESSION';
    v_info := jsonb_build_object('ticket_session_id', v_t.session_id,
                                 'ticket_session_starts_at', (select starts_at from public.sessions where id = v_t.session_id));
  elsif p_gate_id is not null
        and exists (select 1 from public.session_gate_zones where session_id = p_session_id and gate_id = p_gate_id)
        and not exists (select 1 from public.session_gate_zones
                        where session_id = p_session_id and gate_id = p_gate_id and zone_id = v_t.zone_id) then
    v_result := 'WRONG_ZONE';
    v_info := jsonb_build_object('allowed_gates', coalesce((
      select jsonb_agg(jsonb_build_object('gate_id', g.id, 'code', g.code, 'name', g.name))
      from public.session_gate_zones sgz join public.gates g on g.id = sgz.gate_id
      where sgz.session_id = p_session_id and sgz.zone_id = v_t.zone_id), '[]'::jsonb));
  elsif now() < v_s.doors_open_at or now() > v_s.ends_at then
    v_result := 'OUTSIDE_TIME';
  elsif v_t.status in ('VOID', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW') then
    v_result := 'REVOKED';
    v_info := jsonb_build_object('ticket_status', v_t.status);
  elsif v_t.status = 'USED' then
    v_result := 'ALREADY_USED';
    v_info := jsonb_build_object('used_at', v_t.used_at, 'used_gate_id', v_t.used_gate_id);
  else
    update public.tickets
       set status = 'USED', used_at = now(), used_gate_id = p_gate_id, used_device_id = p_device_id, used_by = v_user
     where id = v_t.id and status = 'ISSUED';
    v_result := case when found then 'OK' else 'ALREADY_USED' end;
  end if;

  if v_t.id is not null then
    v_info := v_info || jsonb_build_object('ticket', jsonb_build_object(
      'id', v_t.id, 'zone_id', v_t.zone_id,
      'zone_name', (select name from public.zones where id = v_t.zone_id),
      'seat_code', (select seat_code from public.seats where id = v_t.seat_id),
      'ticket_type', (select name from public.ticket_types where id = v_t.ticket_type_id),
      'holder_name', v_t.holder_name));
  end if;

  insert into public.scan_logs (tenant_id, session_id, ticket_id, gate_id, device_id, staff_id, mode, result,
                                scanned_at, client_scan_id, details)
  values (v_s.tenant_id, p_session_id, v_t.id, p_gate_id, p_device_id, v_user, p_mode, v_result,
          now(), p_client_scan_id, v_info || coalesce(p_details, '{}'::jsonb));

  return jsonb_build_object('result', v_result) || v_info;
end;
$$;

-- Soát vé online (app Staff đã xác minh chữ ký QR bằng khóa công khai trước khi gọi)
create or replace function public.check_in(p_ticket_id uuid, p_session_id uuid, p_gate_id uuid, p_device_id uuid,
                                           p_client_scan_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  perform public.assert_authenticated();
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not public.has_staff_permission(p_session_id, 'SCAN', p_gate_id) then
    perform public.app_error('FORBIDDEN');
  end if;
  perform public.assert_gate_device(p_device_id, v_tenant);
  return public.apply_scan(p_ticket_id, p_session_id, p_gate_id, p_device_id, 'ONLINE', p_client_scan_id);
end;
$$;

-- Đồng bộ log offline: First Write Wins theo scanned_at, cảnh báo DUPLICATE_ENTRY
-- p_scans: [{"client_scan_id": "...", "ticket_id": "...", "gate_id": "...",
--            "scanned_at": "...", "local_result": "OK"}]
create or replace function public.sync_offline_scans(p_session_id uuid, p_device_id uuid, p_scans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.assert_authenticated();
  v_tenant     uuid;
  r            record;
  v_t          public.tickets%rowtype;
  v_result     text;
  v_details    jsonb;
  v_processed  int := 0;
  v_duplicates jsonb := '[]'::jsonb;
  v_alerts     jsonb := '[]'::jsonb;
begin
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not public.has_staff_permission(p_session_id, 'SCAN') then
    perform public.app_error('FORBIDDEN');
  end if;
  perform public.assert_gate_device(p_device_id, v_tenant);

  for r in
    select * from jsonb_to_recordset(p_scans)
      as x(client_scan_id text, ticket_id uuid, gate_id uuid, scanned_at timestamptz, local_result text)
    order by x.scanned_at
  loop
    if r.client_scan_id is null or exists (select 1 from public.scan_logs
                                           where device_id = p_device_id and client_scan_id = r.client_scan_id) then
      continue;
    end if;
    v_processed := v_processed + 1;
    v_details := jsonb_build_object('local_result', r.local_result);

    if r.local_result is distinct from 'OK' then
      -- Thiết bị đã từ chối tại chỗ: chỉ lưu lại
      v_result := case when r.local_result in ('ALREADY_USED','WRONG_SESSION','WRONG_ZONE','REVOKED',
                                               'INVALID_SIGNATURE','OUTSIDE_TIME')
                       then r.local_result else 'INVALID_SIGNATURE' end;
    else
      select * into v_t from public.tickets where id = r.ticket_id for update;
      if not found or v_t.session_id <> p_session_id then
        v_result := 'WRONG_SESSION';
        v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('ticket_id', r.ticket_id, 'type', 'ACCEPTED_INVALID'));
      elsif v_t.status in ('ISSUED', 'NO_SHOW') then
        -- NO_SHOW: log offline đồng bộ sau khi Session đã kết thúc; khách thực tế đã vào
        update public.tickets
           set status = 'USED', used_at = r.scanned_at, used_gate_id = r.gate_id,
               used_device_id = p_device_id, used_by = v_user
         where id = v_t.id;
        v_result := 'OK';
      elsif v_t.status = 'USED' then
        -- Vé vào hai lần. Lượt sớm nhất là lượt hợp lệ (First Write Wins).
        v_result := 'DUPLICATE_ENTRY';
        v_details := v_details || jsonb_build_object('first_used_at', least(v_t.used_at, r.scanned_at),
                                                     'other_scan_at', greatest(v_t.used_at, r.scanned_at));
        if r.scanned_at < v_t.used_at then
          update public.tickets
             set used_at = r.scanned_at, used_gate_id = r.gate_id, used_device_id = p_device_id, used_by = v_user
           where id = v_t.id;
        end if;
        v_duplicates := v_duplicates || to_jsonb(v_t.id);
      else
        v_result := 'REVOKED';
        v_details := v_details || jsonb_build_object('ticket_status', v_t.status, 'accepted_offline', true);
        v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('ticket_id', v_t.id, 'type', 'REVOKED_ACCEPTED'));
      end if;
    end if;

    insert into public.scan_logs (tenant_id, session_id, ticket_id, gate_id, device_id, staff_id, mode, result,
                                  scanned_at, client_scan_id, details)
    values (v_tenant, p_session_id,
            case when exists (select 1 from public.tickets where id = r.ticket_id) then r.ticket_id end,
            r.gate_id, p_device_id, v_user, 'OFFLINE', v_result, r.scanned_at, r.client_scan_id, v_details);
  end loop;

  if jsonb_array_length(v_duplicates) > 0 or jsonb_array_length(v_alerts) > 0 then
    perform public.enqueue('GATE_ALERT', 'session', p_session_id,
                           jsonb_build_object('duplicates', v_duplicates, 'alerts', v_alerts, 'device_id', p_device_id));
  end if;
  update public.gate_devices set last_sync_at = now() where id = p_device_id;

  return jsonb_build_object('processed', v_processed, 'duplicate_ticket_ids', v_duplicates,
                            'alerts', v_alerts, 'server_now', now());
end;
$$;

-- ----------------------------------------------------------------------------
-- Check-in thủ công (khách mất điện thoại, QR không đọc được)
-- ----------------------------------------------------------------------------
create or replace function public.search_attendees(p_session_id uuid, p_query text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_q      text := trim(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_res    jsonb;
begin
  perform public.assert_authenticated();
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not public.has_staff_permission(p_session_id, 'MANUAL_CHECKIN') then
    perform public.app_error('FORBIDDEN');
  end if;
  if length(v_q) < 3 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_query', 'min_length', 3));
  end if;

  select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
             'ticket_id', t.id, 'status', t.status, 'booking_code', b.code,
             'name', coalesce(t.holder_name, p.full_name),
             'phone_masked', case when coalesce(t.holder_phone, p.phone) is null then null
                                  else repeat('*', greatest(length(coalesce(t.holder_phone, p.phone)) - 3, 0))
                                       || right(coalesce(t.holder_phone, p.phone), 3) end,
             'zone_name', z.name, 'seat_code', st.seat_code, 'ticket_type', tt.name) as row_json
    from public.tickets t
    join public.bookings b on b.id = t.booking_id
    left join public.profiles p on p.id = t.owner_id
    join public.zones z on z.id = t.zone_id
    left join public.seats st on st.id = t.seat_id
    join public.ticket_types tt on tt.id = t.ticket_type_id
    where t.session_id = p_session_id
      and (b.code = upper(v_q)
           or (length(v_digits) >= 4 and (p.phone like '%' || v_digits or t.holder_phone like '%' || v_digits))
           or coalesce(t.holder_name, p.full_name) ilike '%' || v_q || '%')
    limit 20
  ) x;

  perform public.write_audit('CHECKIN.SEARCH', 'session', p_session_id::text, v_tenant, null,
                             jsonb_build_object('query_length', length(v_q)));
  return v_res;
end;
$$;

create or replace function public.manual_check_in(p_ticket_id uuid, p_session_id uuid, p_gate_id uuid,
                                                  p_device_id uuid, p_id_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := public.assert_authenticated();
  v_tenant uuid;
  v_count  int;
  v_limit  int := public.setting_int('gate.manual_checkin_per_hour', 30);
  v_res    jsonb;
begin
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not public.has_staff_permission(p_session_id, 'MANUAL_CHECKIN', p_gate_id) then
    perform public.app_error('FORBIDDEN');
  end if;
  if p_id_verified is not true then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_id_verified',
                             'reason', 'staff must confirm identity document'));
  end if;
  perform public.assert_gate_device(p_device_id, v_tenant);

  -- Vượt ngưỡng mỗi giờ thì chỉ Gate Manager làm tiếp được
  if not public.has_org_role(v_tenant, array['GATE_MANAGER']) then
    select count(*) into v_count from public.scan_logs
    where staff_id = v_user and mode = 'MANUAL' and received_at > now() - interval '1 hour';
    if v_count >= v_limit then
      perform public.app_error('LIMIT_EXCEEDED', jsonb_build_object('limit', v_limit, 'held', v_count,
                               'reason', 'needs GATE_MANAGER'));
    end if;
  end if;

  v_res := public.apply_scan(p_ticket_id, p_session_id, p_gate_id, p_device_id, 'MANUAL',
                             'manual-' || gen_random_uuid()::text, jsonb_build_object('id_verified', true));
  perform public.write_audit('CHECKIN.MANUAL', 'ticket', p_ticket_id::text, v_tenant, null, v_res);
  return v_res;
end;
$$;

-- ----------------------------------------------------------------------------
-- Gate Analytics
-- ----------------------------------------------------------------------------
create or replace function public.get_gate_analytics(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  perform public.assert_authenticated();
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not (public.has_staff_permission(p_session_id, 'VIEW_ANALYTICS')
                              or public.has_org_role(v_tenant, array['OWNER','EVENT_MANAGER','GATE_MANAGER'])) then
    perform public.app_error('FORBIDDEN');
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'tickets_valid', (select count(*) from public.tickets where session_id = p_session_id and status in ('ISSUED','USED')),
    'checked_in', (select count(*) from public.tickets where session_id = p_session_id and status = 'USED'),
    'by_gate', coalesce((
      select jsonb_agg(jsonb_build_object('gate_id', used_gate_id, 'checked_in', n))
      from (select used_gate_id, count(*) n from public.tickets
            where session_id = p_session_id and status = 'USED' group by used_gate_id) g), '[]'::jsonb),
    'last_15_min', (select count(*) from public.scan_logs
                    where session_id = p_session_id and result = 'OK' and scanned_at > now() - interval '15 minutes'),
    'rejections', coalesce((
      select jsonb_object_agg(result, n)
      from (select result, count(*) n from public.scan_logs
            where session_id = p_session_id and result <> 'OK' group by result) r), '{}'::jsonb),
    'devices_offline_30m', (select count(*) from public.gate_devices d
                            where d.tenant_id = v_tenant and d.status = 'ACTIVE'
                              and d.last_sync_at < now() - interval '30 minutes'
                              and exists (select 1 from public.scan_logs l
                                          where l.device_id = d.id and l.session_id = p_session_id)));
end;
$$;

grant execute on function
  public.set_session_gate_zones(uuid, jsonb),
  public.assign_staff(uuid, uuid, text[], uuid, timestamptz, timestamptz),
  public.revoke_staff_assignment(uuid),
  public.register_gate_device(uuid, text, text, text),
  public.revoke_gate_device(uuid, text),
  public.get_session_manifest(uuid, uuid, timestamptz),
  public.check_in(uuid, uuid, uuid, uuid, text),
  public.sync_offline_scans(uuid, uuid, jsonb),
  public.search_attendees(uuid, text),
  public.manual_check_in(uuid, uuid, uuid, uuid, boolean),
  public.get_gate_analytics(uuid)
to authenticated;


-- ############################################################################
-- PHẦN 18 (1800) · rpc_cancel_report_support
-- ############################################################################

-- ============================================================================
-- 1800 · RPC: hủy Session/Event, duyệt hai người, Report, Dispute, hỗ trợ, thông báo
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Hủy Session
-- ----------------------------------------------------------------------------
create or replace function public.request_session_cancellation(p_session_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_authenticated();
  v_s        public.sessions%rowtype;
  v_origin   text;
  v_req      uuid;
  v_approval uuid;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  if public.has_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN']) then
    v_origin := 'PLATFORM';
    if not public.is_aal2() then
      perform public.app_error('MFA_REQUIRED');
    end if;
  else
    perform public.assert_org_role(v_s.tenant_id, array['OWNER'], true);
    v_origin := 'ORG';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_reason'));
  end if;
  if v_s.status in ('ENDED', 'CANCELLED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_s.status));
  end if;
  if exists (select 1 from public.session_change_requests
             where session_id = p_session_id and status in ('REQUESTED', 'APPROVED')) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'a request is already open'));
  end if;

  -- Dừng bán ngay, trước khi Admin duyệt
  update public.sessions set sales_paused = true, sales_paused_reason = 'CANCELLATION_REQUESTED'
   where id = p_session_id;

  insert into public.session_change_requests (tenant_id, session_id, change_type, origin, reason, requested_by)
  values (v_s.tenant_id, p_session_id, 'CANCEL', v_origin, trim(p_reason), v_user)
  returning id into v_req;

  insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
  values ('SESSION_CANCELLATION', v_req, v_s.tenant_id, v_user,
          jsonb_build_object('session_id', p_session_id, 'reason', p_reason))
  returning id into v_approval;
  update public.session_change_requests set approval_id = v_approval where id = v_req;

  -- Admin chủ động hủy: phiếu của người tạo tính là phiếu thứ nhất
  if v_origin = 'PLATFORM' then
    insert into public.approval_votes (approval_id, voter_id, decision, note)
    values (v_approval, v_user, 'APPROVE', 'initiator');
  end if;

  perform public.enqueue('ADMIN_ALERT', 'session_change_request', v_req,
                         jsonb_build_object('type', 'SESSION_CANCELLATION_REQUESTED'));
  perform public.write_audit('SESSION.CANCEL_REQUEST', 'session', p_session_id::text, v_s.tenant_id,
                             null, jsonb_build_object('reason', p_reason, 'origin', v_origin));
  return v_req;
end;
$$;

-- Hủy cả Event = gửi yêu cầu hủy cho từng Session chưa kết thúc
create or replace function public.request_event_cancellation(p_event_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     record;
  v_ids jsonb := '[]'::jsonb;
begin
  perform public.assert_authenticated();
  for r in select id from public.sessions
           where event_id = p_event_id and status not in ('ENDED', 'CANCELLED')
             and not exists (select 1 from public.session_change_requests c
                             where c.session_id = sessions.id and c.status in ('REQUESTED', 'APPROVED'))
           order by starts_at
  loop
    v_ids := v_ids || to_jsonb(public.request_session_cancellation(r.id, p_reason));
  end loop;
  return jsonb_build_object('request_ids', v_ids);
end;
$$;

-- Thực thi sau khi đủ hai phiếu duyệt
create or replace function public.execute_session_cancellation(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req     public.session_change_requests%rowtype;
  r         record;
  v_refund  uuid;
  v_paid    bigint;
  v_already bigint;
begin
  select * into v_req from public.session_change_requests where id = p_request_id for update;
  if v_req.status <> 'APPROVED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_req.status));
  end if;

  update public.sessions set status = 'CANCELLED', sales_paused = true, sales_paused_reason = 'CANCELLED'
   where id = v_req.session_id;

  -- Đơn đang giữ chỗ: hủy, trả chỗ
  for r in select id from public.bookings where session_id = v_req.session_id and status = 'PENDING' loop
    perform public.release_booking(r.id, 'CANCELLED');
  end loop;
  -- PAYMENT_PENDING: nếu IPN về sau, apply_payment_success thấy Session đã hủy và hoàn 100%

  -- Đơn đã thanh toán
  for r in select * from public.bookings
           where session_id = v_req.session_id and status in ('PAID', 'CONFIRMED', 'PARTIALLY_REFUNDED')
           for update
  loop
    if r.total_amount = 0 then
      -- Vé 0đ: chỉ hủy hiệu lực
      update public.tickets set status = 'VOID', void_reason = 'SESSION_CANCELLED'
       where booking_id = r.id and status in ('ISSUED', 'USED');
      update public.bookings set status = 'CANCELLED', cancelled_at = now() where id = r.id;
      continue;
    end if;

    select coalesce(sum(amount), 0) into v_already from public.refunds
    where booking_id = r.id and status not in ('FAILED')
      and reason not in ('LATE_PAYMENT_NO_SEAT', 'DUPLICATE_PAYMENT');
    v_paid := r.total_amount - v_already;

    update public.tickets set status = 'REFUND_PENDING'
     where booking_id = r.id and status in ('ISSUED', 'USED');
    update public.bookings set status = 'REFUND_PENDING' where id = r.id;

    if v_paid > 0 then
      insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id)
      values (r.tenant_id, r.id,
              (select id from public.payments where booking_id = r.id and status = 'SUCCEEDED'
               order by paid_at limit 1),
              v_paid, 'SESSION_CANCELLED', 'SESSION_CHANGE_REQUEST', p_request_id)
      returning id into v_refund;

      insert into public.refund_items (refund_id, ticket_id, amount)
      select v_refund, t.id, bi.unit_price
      from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
      where t.booking_id = r.id and t.status = 'REFUND_PENDING';
    end if;
  end loop;

  update public.session_change_requests set status = 'EXECUTED', executed_at = now() where id = p_request_id;

  -- Worker hoàn tiền có kiểm soát tốc độ; thông báo cho khách gửi SAU khi đã tạo lệnh hoàn
  perform public.enqueue('PROCESS_SESSION_REFUNDS', 'session', v_req.session_id);
  perform public.enqueue('NOTIFY_SESSION_CANCELLED', 'session', v_req.session_id);

  update public.events e set status = 'CANCELLED'
  from public.sessions s
  where s.id = v_req.session_id and e.id = s.event_id
    and not exists (select 1 from public.sessions s2 where s2.event_id = e.id and s2.status <> 'CANCELLED');

  perform public.write_audit('SESSION.CANCEL_EXECUTE', 'session', v_req.session_id::text, v_req.tenant_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Duyệt hai người (chung cho hủy Session, payout, hoàn thủ công, gỡ hold...)
-- ----------------------------------------------------------------------------
create or replace function public.vote_approval(p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a       public.approvals%rowtype;
  v_user    uuid;
  v_roles   text[];
  v_approve int;
begin
  select * into v_a from public.approvals where id = p_approval_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  v_roles := case v_a.subject_type
               when 'SESSION_CANCELLATION' then array['FINANCE_ADMIN','DISPUTE_ADMIN']
               when 'PAYOUT'               then array['FINANCE_ADMIN']
               when 'REFUND_MANUAL'        then array['FINANCE_ADMIN']
               when 'MANUAL_TRANSFER'      then array['FINANCE_ADMIN']
               when 'HOLD_RELEASE'         then array['FINANCE_ADMIN','DISPUTE_ADMIN']
               else array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN']
             end;
  v_user := public.assert_platform_role(v_roles, true);

  if v_a.status <> 'PENDING' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_a.status));
  end if;
  if p_decision not in ('APPROVE', 'REJECT') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_decision'));
  end if;

  begin
    insert into public.approval_votes (approval_id, voter_id, decision, note)
    values (p_approval_id, v_user, p_decision, p_note);
  exception when unique_violation then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'already voted'));
  end;

  if p_decision = 'REJECT' then
    update public.approvals set status = 'REJECTED', decided_at = now() where id = p_approval_id;
    if v_a.subject_type = 'SESSION_CANCELLATION' then
      update public.session_change_requests set status = 'REJECTED' where id = v_a.subject_id;
      update public.sessions s set sales_paused = false, sales_paused_reason = null
      from public.session_change_requests c
      where c.id = v_a.subject_id and s.id = c.session_id and s.sales_paused_reason = 'CANCELLATION_REQUESTED';
    elsif v_a.subject_type = 'PAYOUT' then
      perform public.release_payout(v_a.subject_id);
    end if;
    -- ORG_SUSPENSION, HOLD_RELEASE, REFUND_MANUAL: bị từ chối thì giữ nguyên hiện trạng.
    -- MANUAL_TRANSFER: khách gửi lại tài khoản thì tạo phiếu duyệt mới.
  else
    select count(*) into v_approve from public.approval_votes
    where approval_id = p_approval_id and decision = 'APPROVE';
    if v_approve >= v_a.required_votes then
      update public.approvals set status = 'APPROVED', decided_at = now() where id = p_approval_id;
      if v_a.subject_type = 'SESSION_CANCELLATION' then
        update public.session_change_requests set status = 'APPROVED' where id = v_a.subject_id;
        perform public.execute_session_cancellation(v_a.subject_id);
      elsif v_a.subject_type = 'HOLD_RELEASE' then
        update public.fund_holds set status = 'RELEASED', released_at = now(), release_approval_id = p_approval_id
         where id = v_a.subject_id and status = 'ACTIVE';
        perform public.compute_settlement(s.session_id) from public.fund_holds h
          join public.settlements s on s.session_id = h.session_id
         where h.id = v_a.subject_id;
      elsif v_a.subject_type = 'ORG_SUSPENSION' then
        perform public.apply_org_status_change(v_a.subject_id, v_a.payload ->> 'action', v_a.payload ->> 'reason',
                                               p_approval_id);
      elsif v_a.subject_type = 'PAYOUT' then
        update public.payouts set status = 'APPROVED' where id = v_a.subject_id and status = 'PROPOSED';
        perform public.enqueue('PROCESS_PAYOUT', 'payout', v_a.subject_id);
      elsif v_a.subject_type = 'REFUND_MANUAL' then
        perform public.create_refund(v_a.subject_id, (v_a.payload ->> 'amount')::bigint, 'MANUAL',
                                     'MANUAL', null, v_a.requested_by, v_a.payload -> 'ticket_ids', p_approval_id);
      end if;
      -- MANUAL_TRANSFER: confirm_manual_transfer kiểm tra approvals.status = 'APPROVED'
    end if;
  end if;

  perform public.write_audit('APPROVAL.' || p_decision, v_a.subject_type, v_a.subject_id::text, v_a.org_id,
                             null, jsonb_build_object('approval_id', p_approval_id, 'note', p_note));
  return jsonb_build_object('status', (select status from public.approvals where id = p_approval_id),
                            'approve_votes', coalesce(v_approve, 0), 'required', v_a.required_votes);
end;
$$;

-- ----------------------------------------------------------------------------
-- Report và Dispute Case
-- ----------------------------------------------------------------------------
create or replace function public.submit_report(p_ticket_id uuid, p_category text, p_description text,
                                                p_attachment_paths text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.assert_authenticated();
  v_t         public.tickets%rowtype;
  v_s         public.sessions%rowtype;
  v_case      public.dispute_cases%rowtype;
  v_report    uuid;
  v_threshold int := public.setting_int('dispute.report_threshold', 5);
begin
  select * into v_t from public.tickets where id = p_ticket_id;
  -- Chỉ người có vé mới gửi được
  if not found or v_t.owner_id is distinct from v_user then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_t.status not in ('ISSUED', 'USED', 'NO_SHOW') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('ticket_status', v_t.status));
  end if;

  select * into v_s from public.sessions where id = v_t.session_id;
  if now() < v_s.doors_open_at or now() > v_s.ends_at + make_interval(hours => v_s.report_window_hours) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'outside report window',
      'window_ends_at', v_s.ends_at + make_interval(hours => v_s.report_window_hours)));
  end if;
  if exists (select 1 from unnest(coalesce(p_attachment_paths, '{}')) pth
             where pth not like v_user::text || '/%') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_attachment_paths'));
  end if;

  -- Gom vào case đang mở của Session (khóa theo Session để không tạo hai case)
  perform pg_advisory_xact_lock(hashtextextended('dispute:' || v_s.id::text, 0));
  select * into v_case from public.dispute_cases
  where session_id = v_s.id and status in ('OPEN', 'UNDER_REVIEW', 'AWAITING_ORG', 'APPEALED');
  if not found then
    insert into public.dispute_cases (org_id, session_id) values (v_s.tenant_id, v_s.id)
    returning * into v_case;
  end if;

  begin
    insert into public.reports (org_id, session_id, ticket_id, reporter_id, category, description,
                                status, dispute_case_id)
    values (v_s.tenant_id, v_s.id, p_ticket_id, v_user, p_category, trim(p_description), 'IN_CASE', v_case.id)
    returning id into v_report;
  exception
    when unique_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'already reported this category'));
    when check_violation then
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_category/p_description'));
  end;

  insert into public.report_attachments (report_id, org_id, storage_path)
  select v_report, v_s.tenant_id, pth from unnest(coalesce(p_attachment_paths, '{}')) pth;

  update public.dispute_cases set report_count = report_count + 1 where id = v_case.id
  returning * into v_case;

  -- Đủ ngưỡng: tạm giữ tiền của Session, chuyển Admin xem xét, mở SLA cho Org
  if v_case.report_count >= v_threshold and v_case.threshold_reached_at is null then
    update public.dispute_cases
       set threshold_reached_at = now(), status = 'AWAITING_ORG',
           org_response_due_at = now() + make_interval(hours => public.setting_int('dispute.org_response_hours', 48))
     where id = v_case.id;
    insert into public.fund_holds (tenant_id, scope, session_id, reason, dispute_case_id)
    values (v_s.tenant_id, 'SESSION', v_s.id, 'DISPUTE_THRESHOLD', v_case.id);
    update public.settlements set status = 'ON_HOLD' where session_id = v_s.id and status in ('OPEN', 'READY');
    perform public.enqueue('ADMIN_ALERT', 'dispute_case', v_case.id, jsonb_build_object('type', 'DISPUTE_THRESHOLD'));
    perform public.enqueue('NOTIFY_ORG', 'dispute_case', v_case.id, jsonb_build_object('type', 'DISPUTE_OPENED'));
  end if;

  return jsonb_build_object('report_id', v_report, 'dispute_case_id', v_case.id);
end;
$$;

create or replace function public.add_dispute_message(p_case_id uuid, p_body text,
                                                      p_attachments jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_case public.dispute_cases%rowtype;
  v_side text;
  v_id   uuid;
begin
  select * into v_case from public.dispute_cases where id = p_case_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if public.has_platform_role(array['DISPUTE_ADMIN']) then
    v_side := 'ADMIN';
  elsif public.has_org_role(v_case.org_id, array['OWNER','EVENT_MANAGER']) then
    v_side := 'ORG';
  else
    perform public.app_error('FORBIDDEN');
  end if;
  if v_case.status in ('RESOLVED', 'DISMISSED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_case.status));
  end if;

  insert into public.dispute_messages (case_id, org_id, author_id, author_side, body, attachments)
  values (p_case_id, v_case.org_id, v_user, v_side, p_body, coalesce(p_attachments, '[]'::jsonb))
  returning id into v_id;

  if v_side = 'ORG' and v_case.status in ('OPEN', 'AWAITING_ORG') then
    update public.dispute_cases set status = 'UNDER_REVIEW' where id = p_case_id;
  elsif v_side = 'ADMIN' and v_case.assigned_admin_id is null then
    update public.dispute_cases set assigned_admin_id = v_user where id = p_case_id;
  end if;
  return v_id;
end;
$$;

-- Kết luận case. Hoàn tiền theo tỉ lệ cho vé của người gửi Report (p_scope = 'REPORTERS')
-- hoặc mọi vé đã bán của Session (p_scope = 'ALL_TICKETS'). Gỡ hold cần duyệt hai người.
create or replace function public.resolve_dispute_case(p_case_id uuid, p_resolution text,
                                                       p_refund_percent_bp int default null,
                                                       p_scope text default 'REPORTERS',
                                                       p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.assert_platform_role(array['DISPUTE_ADMIN']);
  v_case    public.dispute_cases%rowtype;
  v_bp      int;
  r         record;
  v_refund  uuid;
  v_count   int := 0;
  v_hold    uuid;
  v_approval uuid;
begin
  select * into v_case from public.dispute_cases where id = p_case_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_case.status in ('RESOLVED', 'DISMISSED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_case.status));
  end if;
  if p_resolution not in ('FULL_REFUND', 'PARTIAL_REFUND', 'NO_ACTION') or p_scope not in ('REPORTERS', 'ALL_TICKETS') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_resolution/p_scope'));
  end if;
  v_bp := case p_resolution when 'FULL_REFUND' then 10000 when 'NO_ACTION' then 0 else p_refund_percent_bp end;
  if v_bp is null or v_bp not between 1 and 10000 and p_resolution = 'PARTIAL_REFUND' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_refund_percent_bp'));
  end if;

  if v_bp > 0 then
    for r in
      select b.id as booking_id, b.tenant_id,
             array_agg(t.id) as ticket_ids,
             sum(bi.unit_price * v_bp / 10000)::bigint as amount
      from public.tickets t
      join public.bookings b on b.id = t.booking_id
      join public.booking_items bi on bi.id = t.booking_item_id
      where t.session_id = v_case.session_id
        and t.status in ('ISSUED', 'USED', 'NO_SHOW')
        and bi.unit_price > 0
        and (p_scope = 'ALL_TICKETS'
             or t.id in (select ticket_id from public.reports where dispute_case_id = p_case_id))
      group by b.id, b.tenant_id
    loop
      continue when r.amount <= 0;
      insert into public.refunds (org_id, booking_id, payment_id, amount, reason, source_type, source_id, requested_by)
      values (r.tenant_id, r.booking_id,
              (select id from public.payments where booking_id = r.booking_id and status = 'SUCCEEDED'
               order by paid_at limit 1),
              r.amount, 'DISPUTE', 'DISPUTE_CASE', p_case_id, v_user)
      returning id into v_refund;
      insert into public.refund_items (refund_id, ticket_id, amount)
      select v_refund, t.id, bi.unit_price * v_bp / 10000
      from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
      where t.id = any (r.ticket_ids);
      perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
      v_count := v_count + 1;
    end loop;
  end if;

  update public.dispute_cases
     set status = case when p_resolution = 'NO_ACTION' then 'DISMISSED' else 'RESOLVED' end,
         resolution = p_resolution, refund_percent_bp = v_bp, resolution_note = p_note,
         resolved_by = v_user, resolved_at = now()
   where id = p_case_id;
  update public.reports set status = 'CLOSED' where dispute_case_id = p_case_id;

  -- Đề nghị gỡ hold: cần hai Admin duyệt (người kết luận tính một phiếu)
  for v_hold in select id from public.fund_holds where dispute_case_id = p_case_id and status = 'ACTIVE' loop
    v_approval := null;
    insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
    values ('HOLD_RELEASE', v_hold, v_case.org_id, v_user, jsonb_build_object('dispute_case_id', p_case_id))
    on conflict do nothing
    returning id into v_approval;
    if v_approval is not null then
      insert into public.approval_votes (approval_id, voter_id, decision, note)
      values (v_approval, v_user, 'APPROVE', 'resolver');
    end if;
  end loop;

  perform public.enqueue('NOTIFY_ORG', 'dispute_case', p_case_id, jsonb_build_object('type', 'DISPUTE_RESOLVED'));
  perform public.write_audit('DISPUTE.RESOLVE', 'dispute_case', p_case_id::text, v_case.org_id, null,
                             jsonb_build_object('resolution', p_resolution, 'bp', v_bp, 'scope', p_scope,
                                                'refunds', v_count));
  return jsonb_build_object('refunds_created', v_count);
end;
$$;

-- ----------------------------------------------------------------------------
-- Hỗ trợ khách hàng
-- ----------------------------------------------------------------------------
create or replace function public.create_support_request(p_category text, p_subject text, p_body text,
                                                         p_booking_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := public.assert_authenticated();
  v_tenant uuid;
  v_id     uuid;
begin
  if p_booking_id is not null then
    select tenant_id into v_tenant from public.bookings
    where id = p_booking_id and (user_id = v_user or created_by = v_user);
    if v_tenant is null then
      perform public.app_error('NOT_FOUND', jsonb_build_object('field', 'p_booking_id'));
    end if;
  end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_subject/p_body'));
  end if;

  begin
    insert into public.support_requests (user_id, booking_id, org_id, category, subject)
    values (v_user, p_booking_id, v_tenant, p_category, trim(p_subject))
    returning id into v_id;
  exception when check_violation then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_category'));
  end;
  insert into public.support_messages (request_id, author_id, author_side, body)
  values (v_id, v_user, 'CUSTOMER', trim(p_body));
  perform public.enqueue('ADMIN_ALERT', 'support_request', v_id, jsonb_build_object('type', 'SUPPORT_REQUEST'));
  return v_id;
end;
$$;

create or replace function public.add_support_message(p_request_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_req  public.support_requests%rowtype;
  v_side text;
  v_id   uuid;
begin
  select * into v_req from public.support_requests where id = p_request_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_req.user_id = v_user then
    v_side := 'CUSTOMER';
  elsif public.has_platform_role(array['SUPPORT']) then
    v_side := 'SUPPORT';
  else
    perform public.app_error('NOT_FOUND');
  end if;
  if v_req.status = 'CLOSED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_req.status));
  end if;

  insert into public.support_messages (request_id, author_id, author_side, body)
  values (p_request_id, v_user, v_side, trim(p_body))
  returning id into v_id;

  update public.support_requests
     set status = case when v_side = 'SUPPORT' then 'WAITING_CUSTOMER' else 'IN_PROGRESS' end,
         assigned_to = case when v_side = 'SUPPORT' then coalesce(assigned_to, v_user) else assigned_to end
   where id = p_request_id;
  if v_side = 'SUPPORT' then
    perform public.enqueue('NOTIFY_USER', 'support_request', p_request_id, jsonb_build_object('type', 'SUPPORT_REPLY'));
  end if;
  return v_id;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_n    int;
begin
  update public.notifications set read_at = now()
   where user_id = v_user and id = any (p_ids) and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function
  public.request_session_cancellation(uuid, text),
  public.request_event_cancellation(uuid, text),
  public.vote_approval(uuid, text, text),
  public.submit_report(uuid, text, text, text[]),
  public.add_dispute_message(uuid, text, jsonb),
  public.resolve_dispute_case(uuid, text, int, text, text),
  public.create_support_request(text, text, text, uuid),
  public.add_support_message(uuid, text),
  public.mark_notifications_read(uuid[])
to authenticated;


-- ############################################################################
-- PHẦN 19 (1810) · rpc_refund_chargeback
-- ############################################################################

-- ============================================================================
-- 1810 · RPC: vận hành hoàn tiền và chargeback   (chủ: Lâm Phước; bút toán: Đinh Khôi)
--
--   create_manual_refund      Admin hoàn tiền thủ công; từ ngưỡng approval.refund_manual_threshold
--                             cần hai Admin duyệt (REFUND_MANUAL)
--   submit_refund_bank_info   hoàn về phương thức gốc bị từ chối: khách nhập tài khoản ngân hàng
--                             sau khi xác thực OTP (FR-RFD-03) -> hàng chuyển khoản thủ công
--   confirm_manual_transfer   Finance Admin xác nhận đã chuyển khoản, sau khi hai Admin duyệt (AC-14)
--   admin_refund_action       thử lại Refund FAILED hoặc chuyển sang thu tài khoản
--   record_chargeback / resolve_chargeback   chargeback thủ công (FR-CBK-01/03)
-- Mọi Refund đi qua refund engine (start_refund_processing / apply_refund_result ở 1600);
-- idempotency key gửi sang cổng là refunds.id.
-- ============================================================================

-- Khách vừa xác thực OTP (Supabase đặt amr trong JWT) trong khoảng refund.otp_valid_minutes
create or replace function public.has_recent_otp()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'totp', 'sms', 'magiclink')
      and to_timestamp((a ->> 'timestamp')::bigint)
          > now() - make_interval(mins => public.setting_int('refund.otp_valid_minutes', 10))
  );
$$;

-- Tạo Refund cho Booking đã thanh toán (nội bộ). p_ticket_ids: vé bị thu hồi (REFUND_PENDING),
-- null = hoàn một phần giá trị đơn, vé vẫn dùng được.
create or replace function public.create_refund(p_booking_id uuid, p_amount bigint, p_reason text,
                                                p_source_type text, p_source_id uuid, p_requested_by uuid,
                                                p_ticket_ids jsonb default null, p_approval_id uuid default null)
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
    -- Thu hồi vé ngay (đưa vào revocation list), chia số tiền theo giá từng vé
    select sum(bi.unit_price) into v_base
    from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
    where t.id = any (v_ids);
    insert into public.refund_items (refund_id, ticket_id, amount)
    select v_refund, t.id,
           case when coalesce(v_base, 0) > 0 then bi.unit_price * p_amount / v_base else p_amount / cardinality(v_ids) end
    from public.tickets t join public.booking_items bi on bi.id = t.booking_item_id
    where t.id = any (v_ids);
    update public.tickets set status = 'REFUND_PENDING' where id = any (v_ids);
    update public.bookings set status = 'REFUND_PENDING'
     where id = p_booking_id and status in ('PAID', 'CONFIRMED', 'PARTIALLY_REFUNDED');
  end if;

  perform public.enqueue('PROCESS_REFUND', 'refund', v_refund);
  return v_refund;
end;
$$;

create or replace function public.create_manual_refund(p_booking_id uuid, p_amount bigint, p_note text,
                                                       p_ticket_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']);
  v_tenant   uuid;
  v_approval uuid;
  v_refund   uuid;
begin
  select tenant_id into v_tenant from public.bookings where id = p_booking_id;
  if v_tenant is null then
    perform public.app_error('NOT_FOUND');
  end if;
  if coalesce(trim(p_note), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_note'));
  end if;

  if p_amount >= public.setting_int('approval.refund_manual_threshold', 10000000) then
    -- Hoàn lớn: hai Admin khác nhau duyệt; Refund chỉ được tạo khi đủ phiếu (vote_approval)
    begin
      insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
      values ('REFUND_MANUAL', p_booking_id, v_tenant, v_user,
              jsonb_build_object('amount', p_amount, 'note', p_note, 'ticket_ids', to_jsonb(p_ticket_ids)))
      returning id into v_approval;
    exception when unique_violation then
      perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'a manual refund is already pending'));
    end;
    insert into public.approval_votes (approval_id, voter_id, decision, note)
    values (v_approval, v_user, 'APPROVE', 'initiator');
    perform public.write_audit('REFUND.MANUAL_REQUEST', 'booking', p_booking_id::text, v_tenant, null,
                               jsonb_build_object('amount', p_amount, 'note', p_note, 'approval_id', v_approval));
    return jsonb_build_object('approval_id', v_approval, 'status', 'PENDING_APPROVAL');
  end if;

  v_refund := public.create_refund(p_booking_id, p_amount, 'MANUAL', 'MANUAL', null, v_user, to_jsonb(p_ticket_ids));
  perform public.write_audit('REFUND.MANUAL', 'refund', v_refund::text, v_tenant, null,
                             jsonb_build_object('amount', p_amount, 'note', p_note));
  return jsonb_build_object('refund_id', v_refund, 'status', 'REQUESTED');
end;
$$;

-- Admin xử lý hàng Refund FAILED (S5-FE2-3): thử lại qua cổng hoặc chuyển sang thu tài khoản
create or replace function public.admin_refund_action(p_refund_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_platform_role(array['FINANCE_ADMIN']);
  v_r    public.refunds%rowtype;
begin
  select * into v_r from public.refunds where id = p_refund_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_r.status <> 'FAILED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_r.status));
  end if;

  if p_action = 'RETRY' then
    perform public.enqueue('PROCESS_REFUND', 'refund', p_refund_id, jsonb_build_object('retry_by', v_user));
  elsif p_action = 'REQUEST_BANK_INFO' then
    update public.refunds set status = 'AWAITING_BANK_INFO' where id = p_refund_id;
    perform public.enqueue('NOTIFY_USER', 'refund', p_refund_id, jsonb_build_object('type', 'REFUND_NEEDS_BANK_INFO'));
  else
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_action'));
  end if;
  perform public.write_audit('REFUND.' || p_action, 'refund', p_refund_id::text, v_r.org_id);
  return (select status from public.refunds where id = p_refund_id);
end;
$$;

-- Khách nhập tài khoản nhận hoàn tiền (S5-BE1-2). Bắt buộc vừa xác thực OTP.
-- Không cho Org xem (refund_bank_infos chỉ khách và FINANCE_ADMIN đọc được).
create or replace function public.submit_refund_bank_info(p_refund_id uuid, p_bank_code text,
                                                          p_account_number text, p_account_holder text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_authenticated();
  v_r        public.refunds%rowtype;
  v_approval uuid;
begin
  select r.* into v_r from public.refunds r join public.bookings b on b.id = r.booking_id
  where r.id = p_refund_id and (b.user_id = v_user or (b.user_id is null and b.created_by = v_user))
  for update of r;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_r.status not in ('AWAITING_BANK_INFO', 'MANUAL_TRANSFER')
     or (v_r.status = 'MANUAL_TRANSFER' and exists (
           select 1 from public.approvals where subject_type = 'MANUAL_TRANSFER' and subject_id = p_refund_id
             and status in ('PENDING', 'APPROVED'))) then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_r.status));
  end if;
  if not public.has_recent_otp() then
    perform public.app_error('OTP_REQUIRED');
  end if;
  if coalesce(trim(p_bank_code), '') = '' or coalesce(trim(p_account_number), '') !~ '^[0-9]{6,20}$'
     or coalesce(trim(p_account_holder), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'bank info'));
  end if;

  insert into public.refund_bank_infos (refund_id, bank_code, account_number, account_holder, submitted_by,
                                        otp_verified_at)
  values (p_refund_id, upper(trim(p_bank_code)), trim(p_account_number), upper(trim(p_account_holder)), v_user, now())
  on conflict (refund_id) do update
    set bank_code = excluded.bank_code, account_number = excluded.account_number,
        account_holder = excluded.account_holder, otp_verified_at = excluded.otp_verified_at,
        transferred_by = null, transferred_at = null, transfer_ref = null;

  if v_r.status = 'AWAITING_BANK_INFO' then
    update public.refunds set status = 'MANUAL_TRANSFER' where id = p_refund_id;
  end if;

  -- Hàng chuyển khoản thủ công: hai Admin khác nhau duyệt
  insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
  values ('MANUAL_TRANSFER', p_refund_id, v_r.org_id, v_user, jsonb_build_object('amount', v_r.amount))
  returning id into v_approval;
  perform public.enqueue('ADMIN_ALERT', 'refund', p_refund_id, jsonb_build_object('type', 'MANUAL_TRANSFER_QUEUED'));
  return v_approval;
end;
$$;

create or replace function public.confirm_manual_transfer(p_refund_id uuid, p_transfer_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_platform_role(array['FINANCE_ADMIN']);
  v_r    public.refunds%rowtype;
begin
  select * into v_r from public.refunds where id = p_refund_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_r.status <> 'MANUAL_TRANSFER' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_r.status));
  end if;
  if not exists (select 1 from public.approvals
                 where subject_type = 'MANUAL_TRANSFER' and subject_id = p_refund_id and status = 'APPROVED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'transfer not approved by two admins'));
  end if;
  if coalesce(trim(p_transfer_ref), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_transfer_ref'));
  end if;

  update public.refund_bank_infos
     set transferred_by = v_user, transferred_at = now(), transfer_ref = trim(p_transfer_ref)
   where refund_id = p_refund_id;
  perform public.finalize_refund_success(p_refund_id, 'MANUAL:' || trim(p_transfer_ref));
  perform public.write_audit('REFUND.MANUAL_TRANSFER', 'refund', p_refund_id::text, v_r.org_id, null,
                             jsonb_build_object('transfer_ref', p_transfer_ref, 'amount', v_r.amount));
end;
$$;

-- ----------------------------------------------------------------------------
-- Chargeback thủ công (S5-BE1-4): ghi nhận, VOID vé, bút toán trừ khoản phải trả Org
-- (phần Platform Fee tương ứng được đảo như hoàn tiền). Thắng thì ghi bút toán đảo.
-- ----------------------------------------------------------------------------
create or replace function public.record_chargeback(p_payment_id uuid, p_gateway_case_id text, p_amount bigint,
                                                    p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN']);
  v_pay      public.payments%rowtype;
  v_b        public.bookings%rowtype;
  v_fee      bigint;
  v_fee_back bigint;
  v_id       uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found or v_pay.status <> 'SUCCEEDED' then
    perform public.app_error('NOT_FOUND');
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > v_pay.amount then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_amount', 'max', v_pay.amount));
  end if;
  select * into v_b from public.bookings where id = v_pay.booking_id for update;

  begin
    insert into public.chargebacks (org_id, payment_id, booking_id, gateway_case_id, amount, reason, recorded_by)
    values (v_pay.org_id, p_payment_id, v_b.id, p_gateway_case_id, p_amount, p_reason, v_user)
    returning id into v_id;
  exception when unique_violation then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('reason', 'chargeback case already recorded'));
  end;

  update public.tickets set status = 'VOID', void_reason = 'CHARGEBACK'
   where booking_id = v_b.id and status in ('ISSUED', 'USED', 'NO_SHOW');
  update public.bookings set flagged = true, flag_reason = 'CHARGEBACK' where id = v_b.id;

  select coalesce(fee_amount, 0) into v_fee from public.platform_fee_calculations where booking_id = v_b.id;
  v_fee_back := case when v_b.total_amount > 0
                     then round(coalesce(v_fee, 0) * p_amount / v_b.total_amount::numeric)::bigint else 0 end;
  perform public.post_ledger_transaction('CHARGEBACK', v_pay.org_id, v_b.session_id, 'CHARGEBACK', v_id,
    jsonb_build_array(
      jsonb_build_object('account_code', public.org_payable_account(v_pay.org_id), 'direction', 'DEBIT',
                         'amount', p_amount - v_fee_back),
      jsonb_build_object('account_code', 'PLATFORM:FEE_REVENUE', 'direction', 'DEBIT', 'amount', v_fee_back),
      jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'CREDIT', 'amount', p_amount)),
    'chargeback ' || coalesce(p_gateway_case_id, ''));

  perform public.enqueue('NOTIFY_ORG', 'chargeback', v_id, jsonb_build_object('type', 'CHARGEBACK_RECORDED'));
  perform public.write_audit('CHARGEBACK.RECORD', 'chargeback', v_id::text, v_pay.org_id, null,
                             jsonb_build_object('amount', p_amount, 'payment_id', p_payment_id));
  return v_id;
end;
$$;

create or replace function public.resolve_chargeback(p_chargeback_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_platform_role(array['FINANCE_ADMIN','DISPUTE_ADMIN']);
  v_cb   public.chargebacks%rowtype;
  v_tx   uuid;
begin
  select * into v_cb from public.chargebacks where id = p_chargeback_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if p_outcome not in ('WON', 'LOST', 'ACCEPTED') then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_outcome'));
  end if;
  update public.chargebacks set status = p_outcome, resolution_note = p_note, resolved_at = now()
   where id = p_chargeback_id and status = 'OPEN';
  if not found then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_cb.status));
  end if;

  if p_outcome = 'WON' then
    -- Ngân hàng trả lại tiền cho nền tảng: bút toán đảo đúng các dòng đã ghi
    select id into v_tx from public.ledger_transactions
    where kind = 'CHARGEBACK' and reference_type = 'CHARGEBACK' and reference_id = p_chargeback_id;
    perform public.post_ledger_transaction('REVERSAL', v_cb.org_id,
      (select session_id from public.ledger_transactions where id = v_tx), 'CHARGEBACK', p_chargeback_id,
      (select jsonb_agg(jsonb_build_object('account_code', a.code,
                                           'direction', case e.direction when 'DEBIT' then 'CREDIT' else 'DEBIT' end,
                                           'amount', e.amount))
       from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
       where e.transaction_id = v_tx),
      'chargeback won', v_tx);
  end if;
  perform public.write_audit('CHARGEBACK.' || p_outcome, 'chargeback', p_chargeback_id::text, v_cb.org_id, null,
                             jsonb_build_object('note', p_note));
end;
$$;

grant execute on function
  public.create_manual_refund(uuid, bigint, text, uuid[]),
  public.admin_refund_action(uuid, text),
  public.submit_refund_bank_info(uuid, text, text, text),
  public.confirm_manual_transfer(uuid, text),
  public.record_chargeback(uuid, text, bigint, text),
  public.resolve_chargeback(uuid, text, text)
to authenticated;
grant execute on function public.has_recent_otp() to authenticated;


-- ############################################################################
-- PHẦN 20 (1820) · rpc_settlement_payout
-- ############################################################################

-- ============================================================================
-- 1820 · RPC: đối soát theo Session, payout, tài khoản nhận tiền, số dư âm,
--        nhập file đối soát của cổng   (chủ: Đinh Khôi)
--
-- Tài liệu mục 5 và 20.7: sau khi hết thời hạn khiếu nại (cutoff = ends_at +
-- REPORT_WINDOW) và không có Dispute/hold, kỳ đối soát của Session chuyển READY;
-- Finance Admin đề xuất payout, Admin thứ hai duyệt, worker .NET payout chi tiền.
-- Mọi số liệu tính từ sổ cái, không tính từ bảng Booking.
-- ============================================================================

-- Gọi từ RPC chỉ dành cho Admin nhưng cũng chạy được từ job / backend .NET (service_role,
-- không có auth.uid()). Hàm nào dùng helper này không được grant cho anon.
create or replace function public.assert_server_or_platform_role(p_roles text[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  return public.assert_platform_role(p_roles, true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Đối soát theo Session (S6-BE2-1)
-- ----------------------------------------------------------------------------
create or replace function public.compute_settlement(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s        public.sessions%rowtype;
  v_st       public.settlements%rowtype;
  v_payable  text;
  v_gross    bigint;
  v_refund   bigint;
  v_cb       bigint;
  v_fee      bigint;
  v_net      bigint;
  v_status   text;
  v_report   jsonb;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;

  insert into public.settlements (tenant_id, session_id, cutoff_at)
  values (v_s.tenant_id, v_s.id,
          case when v_s.status = 'CANCELLED' then now()
               else v_s.ends_at + make_interval(hours => v_s.report_window_hours) end)
  on conflict (session_id) do nothing;
  select * into v_st from public.settlements where session_id = p_session_id for update;
  if v_st.status in ('PAID_OUT', 'CLOSED')
     or exists (select 1 from public.payout_items pi join public.payouts p on p.id = pi.payout_id
                where pi.settlement_id = v_st.id and p.status in ('PROPOSED', 'APPROVED', 'SENT', 'FAILED')) then
    return to_jsonb(v_st);  -- đã chốt hoặc đang nằm trong một payout: không tính lại
  end if;

  v_payable := 'ORG:' || v_s.tenant_id::text || ':PAYABLE';
  select
    coalesce(sum(case when t.kind = 'PAYMENT_CAPTURED' and e.direction = 'CREDIT'
                       and a.code in (v_payable, 'PLATFORM:FEE_REVENUE') then e.amount end), 0),
    coalesce(sum(case when t.kind = 'REFUND_ISSUED' and e.direction = 'DEBIT'
                       and a.code in (v_payable, 'PLATFORM:FEE_REVENUE') then e.amount end), 0),
    coalesce(sum(case when t.kind in ('CHARGEBACK', 'REVERSAL') and t.reference_type = 'CHARGEBACK'
                       and a.code in (v_payable, 'PLATFORM:FEE_REVENUE')
                      then case e.direction when 'DEBIT' then e.amount else -e.amount end end), 0),
    coalesce(sum(case when a.code = 'PLATFORM:FEE_REVENUE'
                      then case e.direction when 'CREDIT' then e.amount else -e.amount end end), 0),
    coalesce(sum(case when a.code = v_payable and t.kind <> 'PAYOUT_SENT'
                      then case e.direction when 'CREDIT' then e.amount else -e.amount end end), 0)
  into v_gross, v_refund, v_cb, v_fee, v_net
  from public.ledger_transactions t
  join public.ledger_entries e on e.transaction_id = t.id
  join public.ledger_accounts a on a.id = e.account_id
  where t.session_id = p_session_id;

  v_report := jsonb_build_object(
    'tickets', (select jsonb_object_agg(status, n) from (
                  select status, count(*) n from public.tickets where session_id = p_session_id group by status) x),
    'bookings_paid', (select count(*) from public.bookings
                      where session_id = p_session_id and paid_at is not null and total_amount > 0),
    'by_ticket_type', (select jsonb_agg(jsonb_build_object('ticket_type_id', ticket_type_id, 'name', name,
                                                           'sold', sold, 'quota', quota))
                       from (select i.ticket_type_id, tt.name, i.sold, i.quota
                             from public.ticket_type_inventory i join public.ticket_types tt on tt.id = i.ticket_type_id
                             where i.session_id = p_session_id order by tt.sort_order) y),
    'formula', 'net = captured - refunds - chargebacks - platform_fee (from ledger)');

  v_status := case
    when now() < v_st.cutoff_at then 'OPEN'
    when exists (select 1 from public.fund_holds h
                 where h.status = 'ACTIVE' and h.tenant_id = v_s.tenant_id
                   and (h.scope = 'ORG_BALANCE' or h.session_id = p_session_id))
      or exists (select 1 from public.dispute_cases d
                 where d.session_id = p_session_id and d.status in ('OPEN', 'UNDER_REVIEW', 'AWAITING_ORG', 'APPEALED'))
      then 'ON_HOLD'
    when v_net = 0 then 'CLOSED'
    else 'READY'
  end;

  update public.settlements
     set status = v_status, gross_amount = v_gross, refund_amount = v_refund, chargeback_amount = v_cb,
         fee_amount = v_fee, net_amount = v_net, report = v_report, computed_at = now(), computed_by = auth.uid()
   where id = v_st.id
  returning * into v_st;
  return to_jsonb(v_st);
end;
$$;

-- Admin tính lại (portal Admin > Đối soát); Org xem kết quả qua bảng settlements (RLS)
create or replace function public.recompute_settlement(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_server_or_platform_role(array['FINANCE_ADMIN']);
  return public.compute_settlement(p_session_id);
end;
$$;

-- Job mỗi giờ: tạo kỳ đối soát cho Session đã hủy, tính lại các kỳ chưa chốt
create or replace function public.run_settlement_cutoffs()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r   record;
  v_n int := 0;
begin
  for r in
    select s.id from public.sessions s
    where (s.status in ('ENDED', 'CANCELLED')
           and not exists (select 1 from public.settlements st where st.session_id = s.id))
       or exists (select 1 from public.settlements st
                  where st.session_id = s.id and st.status in ('OPEN', 'ON_HOLD', 'READY'))
    order by s.ends_at
  loop
    perform public.compute_settlement(r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tài khoản nhận tiền: đổi tài khoản có cooldown (S6-BE2-2, AC-16)
-- ----------------------------------------------------------------------------
create or replace function public.request_bank_account_change(p_org_id uuid, p_bank_code text,
                                                              p_account_number text, p_account_holder text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_org_role(p_org_id, array['OWNER'], true);
  v_id   uuid;
begin
  if coalesce(trim(p_bank_code), '') = '' or coalesce(trim(p_account_number), '') !~ '^[0-9]{6,20}$'
     or coalesce(trim(p_account_holder), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'bank account'));
  end if;
  -- Đề nghị cũ chưa duyệt bị thay thế
  update public.org_bank_accounts set status = 'REJECTED' where org_id = p_org_id and status = 'PENDING';

  insert into public.org_bank_accounts (org_id, bank_code, account_number, account_holder, status, effective_at,
                                        created_by)
  values (p_org_id, upper(trim(p_bank_code)), trim(p_account_number), upper(trim(p_account_holder)), 'PENDING',
          now() + make_interval(hours => public.setting_int('payout.bank_change_cooldown_hours', 72)), v_user)
  returning id into v_id;

  -- Cảnh báo cho mọi OWNER/FINANCE của Org (phòng chiếm tài khoản) và Admin
  perform public.enqueue('NOTIFY_ORG', 'org_bank_account', v_id, jsonb_build_object('type', 'BANK_ACCOUNT_CHANGE_REQUESTED'));
  perform public.enqueue('ADMIN_ALERT', 'org_bank_account', v_id, jsonb_build_object('type', 'BANK_ACCOUNT_REVIEW'));
  perform public.write_audit('PAYOUT.BANK_CHANGE_REQUEST', 'org_bank_account', v_id::text, p_org_id, null,
                             jsonb_build_object('bank_code', p_bank_code,
                                                'account_last4', right(trim(p_account_number), 4)));
  return v_id;
end;
$$;

-- Finance Admin đối chiếu tên chủ tài khoản với KYC rồi duyệt; tài khoản chỉ dùng
-- cho payout sau effective_at (hết cooldown)
create or replace function public.review_bank_account(p_bank_account_id uuid, p_decision text,
                                                      p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_platform_role(array['FINANCE_ADMIN']);
  v_acc  public.org_bank_accounts%rowtype;
begin
  select * into v_acc from public.org_bank_accounts where id = p_bank_account_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_acc.status <> 'PENDING' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_acc.status));
  end if;
  if p_decision = 'APPROVE' then
    update public.org_bank_accounts set status = 'RETIRED' where org_id = v_acc.org_id and status = 'ACTIVE';
    update public.org_bank_accounts set status = 'ACTIVE', verified_by = v_user, verified_at = now()
     where id = p_bank_account_id;
  elsif p_decision = 'REJECT' then
    update public.org_bank_accounts set status = 'REJECTED', verified_by = v_user, verified_at = now()
     where id = p_bank_account_id;
  else
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_decision'));
  end if;
  perform public.enqueue('NOTIFY_ORG', 'org_bank_account', p_bank_account_id,
                         jsonb_build_object('type', 'BANK_ACCOUNT_' || p_decision, 'note', p_note));
  perform public.write_audit('PAYOUT.BANK_' || p_decision, 'org_bank_account', p_bank_account_id::text, v_acc.org_id,
                             null, jsonb_build_object('note', p_note));
end;
$$;

-- ----------------------------------------------------------------------------
-- Payout (S6-BE2-2): đề xuất -> duyệt hai người -> lệnh chi -> xác nhận -> bút toán
-- ----------------------------------------------------------------------------
create or replace function public.org_payable_balance(p_org_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case e.direction when 'CREDIT' then e.amount else -e.amount end), 0)::bigint
  from public.ledger_accounts a join public.ledger_entries e on e.account_id = a.id
  where a.code = 'ORG:' || p_org_id::text || ':PAYABLE';
$$;

create or replace function public.propose_payout(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_platform_role(array['FINANCE_ADMIN']);
  v_org      public.organizations%rowtype;
  v_acc      public.org_bank_accounts%rowtype;
  v_sum      bigint;
  v_balance  bigint;
  v_amount   bigint;
  v_payout   uuid;
  v_approval uuid;
begin
  select * into v_org from public.organizations where id = p_org_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  -- SUSPENDED giữ toàn bộ payout
  if v_org.status <> 'APPROVED'
     or exists (select 1 from public.fund_holds
                where tenant_id = p_org_id and scope = 'ORG_BALANCE' and status = 'ACTIVE') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'ORG_ON_HOLD', 'org_status', v_org.status));
  end if;
  select * into v_acc from public.org_bank_accounts where org_id = p_org_id and status = 'ACTIVE';
  if not found then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'NO_ACTIVE_BANK_ACCOUNT'));
  end if;
  if v_acc.effective_at > now() then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'BANK_ACCOUNT_COOLDOWN',
                                                                 'effective_at', v_acc.effective_at));
  end if;

  perform public.compute_settlement(st.session_id)
     from public.settlements st where st.tenant_id = p_org_id and st.status in ('OPEN', 'ON_HOLD', 'READY');

  select coalesce(sum(net_amount), 0) into v_sum
  from public.settlements st
  where st.tenant_id = p_org_id and st.status = 'READY'
    and not exists (select 1 from public.payout_items pi where pi.settlement_id = st.id);
  -- Bù trừ số dư âm (hoàn tiền / chargeback sau khi đã chi) vào kỳ này
  v_balance := public.org_payable_balance(p_org_id);
  v_amount := least(v_sum, v_balance);
  if v_amount <= 0 then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'NOTHING_TO_PAY',
                                                                 'ready_total', v_sum, 'ledger_balance', v_balance));
  end if;

  insert into public.payouts (tenant_id, bank_account_id, amount, proposed_by)
  values (p_org_id, v_acc.id, v_amount, v_user)
  returning id into v_payout;
  insert into public.payout_items (payout_id, settlement_id, amount)
  select v_payout, st.id, st.net_amount
  from public.settlements st
  where st.tenant_id = p_org_id and st.status = 'READY' and st.net_amount <> 0
    and not exists (select 1 from public.payout_items pi where pi.settlement_id = st.id);

  insert into public.approvals (subject_type, subject_id, org_id, requested_by, payload)
  values ('PAYOUT', v_payout, p_org_id, v_user, jsonb_build_object('amount', v_amount, 'bank_account_id', v_acc.id))
  returning id into v_approval;
  -- Người đề xuất là phiếu thứ nhất; cần thêm một Finance Admin khác
  insert into public.approval_votes (approval_id, voter_id, decision, note)
  values (v_approval, v_user, 'APPROVE', 'proposer');
  update public.payouts set approval_id = v_approval where id = v_payout;

  perform public.write_audit('PAYOUT.PROPOSE', 'payout', v_payout::text, p_org_id, null,
                             jsonb_build_object('amount', v_amount, 'ready_total', v_sum, 'ledger_balance', v_balance));
  return jsonb_build_object('payout_id', v_payout, 'approval_id', v_approval, 'amount', v_amount);
end;
$$;

-- Hủy payout chưa chi (bị từ chối duyệt, Org bị đình chỉ, Admin hủy): kỳ đối soát quay lại hàng chờ
create or replace function public.release_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payouts set status = 'CANCELLED'
   where id = p_payout_id and status in ('PROPOSED', 'APPROVED', 'FAILED');
  if found then
    delete from public.payout_items where payout_id = p_payout_id;
    update public.approvals set status = 'CANCELLED', decided_at = now()
     where subject_type = 'PAYOUT' and subject_id = p_payout_id and status = 'PENDING';
  end if;
end;
$$;

create or replace function public.cancel_payout(p_payout_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  perform public.assert_platform_role(array['FINANCE_ADMIN']);
  select tenant_id into v_tenant from public.payouts
  where id = p_payout_id and status in ('PROPOSED', 'APPROVED', 'FAILED') for update;
  if v_tenant is null then
    perform public.app_error('INVALID_STATE');
  end if;
  perform public.release_payout(p_payout_id);
  perform public.write_audit('PAYOUT.CANCEL', 'payout', p_payout_id::text, v_tenant, null,
                             jsonb_build_object('reason', p_reason));
end;
$$;

-- Worker .NET payout (service_role): đã gửi lệnh chi sang đối tác thanh toán
create or replace function public.mark_payout_sent(p_payout_id uuid, p_gateway_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payouts%rowtype;
begin
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found or v_p.status not in ('APPROVED', 'FAILED') then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_p.status));
  end if;
  if (select status from public.organizations where id = v_p.tenant_id) <> 'APPROVED' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('reason', 'ORG_ON_HOLD'));
  end if;
  update public.payouts set status = 'SENT', gateway_payout_ref = p_gateway_ref, sent_at = now(), failure_reason = null
   where id = p_payout_id;
end;
$$;

-- Worker .NET payout (service_role): kết quả chi. Thành công mới ghi sổ cái.
create or replace function public.confirm_payout(p_payout_id uuid, p_success boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payouts%rowtype;
begin
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then
    perform public.app_error('NOT_FOUND');
  end if;
  if v_p.status = 'CONFIRMED' then
    return;
  end if;
  if v_p.status <> 'SENT' then
    perform public.app_error('INVALID_STATE', jsonb_build_object('status', v_p.status));
  end if;

  if not p_success then
    update public.payouts set status = 'FAILED', failure_reason = p_reason where id = p_payout_id;
    perform public.enqueue('ADMIN_ALERT', 'payout', p_payout_id, jsonb_build_object('type', 'PAYOUT_FAILED',
                                                                                     'reason', p_reason));
    return;
  end if;

  update public.payouts set status = 'CONFIRMED', confirmed_at = now() where id = p_payout_id;
  update public.settlements st set status = 'PAID_OUT'
    from public.payout_items pi
   where pi.payout_id = p_payout_id and pi.settlement_id = st.id and st.status = 'READY';
  perform public.post_ledger_transaction('PAYOUT_SENT', v_p.tenant_id, null, 'PAYOUT', p_payout_id,
    jsonb_build_array(
      jsonb_build_object('account_code', public.org_payable_account(v_p.tenant_id), 'direction', 'DEBIT',
                         'amount', v_p.amount),
      jsonb_build_object('account_code', 'PLATFORM:GATEWAY_CLEARING', 'direction', 'CREDIT', 'amount', v_p.amount)),
    'payout ' || coalesce(v_p.gateway_payout_ref, ''));
  perform public.enqueue('NOTIFY_ORG', 'payout', p_payout_id, jsonb_build_object('type', 'PAYOUT_CONFIRMED',
                                                                                   'amount', v_p.amount));
  perform public.write_audit('PAYOUT.CONFIRM', 'payout', p_payout_id::text, v_p.tenant_id, null,
                             jsonb_build_object('amount', v_p.amount));
end;
$$;

-- Dashboard doanh thu của Org (S5-FE3-1): tạm giữ, có thể payout, đã payout
create or replace function public.get_org_finance_summary(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_org_role(p_org_id, array['OWNER','FINANCE']) or public.has_platform_role(array['FINANCE_ADMIN'])) then
    perform public.app_error('FORBIDDEN');
  end if;
  return jsonb_build_object(
    'ledger_balance', public.org_payable_balance(p_org_id),
    'held', coalesce((select sum(net_amount) from public.settlements
                      where tenant_id = p_org_id and status in ('OPEN', 'ON_HOLD')), 0),
    'ready', coalesce((select sum(net_amount) from public.settlements
                       where tenant_id = p_org_id and status = 'READY'), 0),
    'paid_out', coalesce((select sum(amount) from public.payouts
                          where tenant_id = p_org_id and status = 'CONFIRMED'), 0),
    'in_progress', coalesce((select sum(amount) from public.payouts
                             where tenant_id = p_org_id and status in ('PROPOSED', 'APPROVED', 'SENT')), 0),
    'active_holds', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'scope', scope, 'session_id', session_id,
                                                                  'reason', reason, 'created_at', created_at))
                              from public.fund_holds where tenant_id = p_org_id and status = 'ACTIVE'), '[]'::jsonb),
    'negative_balance_since', (select negative_balance_since from public.organizations where id = p_org_id));
end;
$$;

-- Job hằng ngày (S6-BE2-4): đánh dấu Org có số dư âm để bù trừ kỳ sau và khóa tạo sự kiện khi quá hạn
create or replace function public.refresh_negative_balances()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  with bal as (
    select a.org_id, sum(case e.direction when 'CREDIT' then e.amount else -e.amount end) as balance
    from public.ledger_accounts a join public.ledger_entries e on e.account_id = a.id
    where a.owner_type = 'ORG'
    group by a.org_id
  )
  update public.organizations o
     set negative_balance_since = case when b.balance < 0 then coalesce(o.negative_balance_since, now()) end
    from bal b
   where b.org_id = o.id
     and (b.balance < 0) is distinct from (o.negative_balance_since is not null);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- Nhập file đối soát hằng ngày của cổng (S6-BE2-3), phát hiện chênh lệch
-- p_lines: [{"txn_type": "PAYMENT|REFUND|PAYOUT|CHARGEBACK", "gateway_txn_id": "...", "amount": 100000, "raw": {...}}]
-- ----------------------------------------------------------------------------
create or replace function public.import_gateway_statement(p_gateway text, p_statement_date date, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_missing jsonb;
begin
  perform public.assert_server_or_platform_role(array['FINANCE_ADMIN']);
  if jsonb_typeof(p_lines) is distinct from 'array' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_lines'));
  end if;

  insert into public.gateway_statement_lines (gateway, statement_date, txn_type, gateway_txn_id, amount, raw)
  select p_gateway, p_statement_date, upper(l.txn_type), l.gateway_txn_id, l.amount, l.raw
  from jsonb_to_recordset(p_lines) l(txn_type text, gateway_txn_id text, amount bigint, raw jsonb)
  on conflict (gateway, txn_type, gateway_txn_id)
  do update set amount = excluded.amount, raw = excluded.raw, statement_date = excluded.statement_date,
                imported_at = now();

  update public.gateway_statement_lines g
     set payment_id = p.id,
         match_status = case when p.id is null then 'MISSING_IN_SYSTEM'
                             when p.amount <> g.amount or p.status <> 'SUCCEEDED' then 'AMOUNT_MISMATCH'
                             else 'MATCHED' end
    from (select gl.id as line_id, pm.id, pm.amount, pm.status
          from public.gateway_statement_lines gl
          left join public.payments pm on pm.gateway_txn_id = gl.gateway_txn_id
          where gl.gateway = p_gateway and gl.statement_date = p_statement_date and gl.txn_type = 'PAYMENT') p
   where g.id = p.line_id;

  update public.gateway_statement_lines g
     set refund_id = r.id,
         match_status = case when r.id is null then 'MISSING_IN_SYSTEM'
                             when r.amount <> abs(g.amount) or r.status <> 'SUCCEEDED' then 'AMOUNT_MISMATCH'
                             else 'MATCHED' end
    from (select gl.id as line_id, rf.id, rf.amount, rf.status
          from public.gateway_statement_lines gl
          left join public.refunds rf on rf.gateway_refund_id = gl.gateway_txn_id
          where gl.gateway = p_gateway and gl.statement_date = p_statement_date and gl.txn_type = 'REFUND') r
   where g.id = r.line_id;

  update public.gateway_statement_lines g
     set match_status = case when x.amount is null then 'MISSING_IN_SYSTEM'
                             when x.amount <> abs(g.amount) then 'AMOUNT_MISMATCH' else 'MATCHED' end
    from (select gl.id as line_id, coalesce(po.amount, cb.amount) as amount
          from public.gateway_statement_lines gl
          left join public.payouts po on gl.txn_type = 'PAYOUT' and po.gateway_payout_ref = gl.gateway_txn_id
          left join public.chargebacks cb on gl.txn_type = 'CHARGEBACK' and cb.gateway_case_id = gl.gateway_txn_id
          where gl.gateway = p_gateway and gl.statement_date = p_statement_date
            and gl.txn_type in ('PAYOUT', 'CHARGEBACK')) x
   where g.id = x.line_id;

  -- Giao dịch hệ thống ghi nhận thành công trong ngày nhưng không có trong file của cổng
  select coalesce(jsonb_agg(jsonb_build_object('payment_id', p.id, 'gateway_txn_id', p.gateway_txn_id,
                                               'amount', p.amount)), '[]'::jsonb)
    into v_missing
  from public.payments p
  where p.gateway = p_gateway and p.status = 'SUCCEEDED'
    and (p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date = p_statement_date
    and not exists (select 1 from public.gateway_statement_lines g
                    where g.gateway = p_gateway and g.txn_type = 'PAYMENT' and g.gateway_txn_id = p.gateway_txn_id);

  select jsonb_build_object(
           'lines', count(*),
           'matched', count(*) filter (where match_status = 'MATCHED'),
           'mismatches', coalesce(jsonb_agg(jsonb_build_object('txn_type', txn_type, 'gateway_txn_id', gateway_txn_id,
                                                               'amount', amount, 'match_status', match_status))
                                  filter (where match_status <> 'MATCHED'), '[]'::jsonb),
           'missing_in_statement', v_missing)
    into v_summary
  from public.gateway_statement_lines
  where gateway = p_gateway and statement_date = p_statement_date;

  if jsonb_array_length(v_summary -> 'mismatches') > 0 or jsonb_array_length(v_missing) > 0 then
    perform public.enqueue('ADMIN_ALERT', 'gateway_statement', gen_random_uuid(),
                           jsonb_build_object('type', 'RECONCILIATION_MISMATCH', 'gateway', p_gateway,
                                              'date', p_statement_date));
  end if;
  return v_summary;
end;
$$;

grant execute on function
  public.recompute_settlement(uuid),
  public.request_bank_account_change(uuid, text, text, text),
  public.review_bank_account(uuid, text, text),
  public.propose_payout(uuid),
  public.cancel_payout(uuid, text),
  public.get_org_finance_summary(uuid),
  public.import_gateway_statement(text, date, jsonb)
to authenticated;

-- Chỉ server (job / worker .NET payout, service_role):
--   compute_settlement, run_settlement_cutoffs, release_payout, mark_payout_sent,
--   confirm_payout, refresh_negative_balances


-- ############################################################################
-- PHẦN 21 (1850) · jobs
-- ############################################################################

-- ============================================================================
-- 1850 · Hàm cho job định kỳ (tài liệu mục 20.6). Lịch chạy ở migration 1900.
--   Mở và đóng bán            run_session_status_transitions()  (1500)   mỗi phút
--   Dọn lock hết hạn          release_expired_bookings()        (1600)   mỗi phút
--   Cảnh báo phát vé          alert_unconfirmed_bookings()                mỗi phút
--   Nhắc lịch 24 giờ / 2 giờ  enqueue_session_reminders()                mỗi 15 phút
--   Chốt kỳ đối soát          run_settlement_cutoffs()          (1820)   mỗi giờ
--   Số dư âm                  refresh_negative_balances()       (1820)   hằng ngày
--   Truy vấn giao dịch, đối soát file cổng: job .NET (cần gọi API cổng), dùng
--   list_payment_pending_to_query() và import_gateway_statement().
-- Chỉ server gọi (pg_cron chạy bằng postgres; backend .NET bằng service_role).
-- ============================================================================

-- Booking PAID quá T_CONFIRM_ALERT mà chưa CONFIRMED (phát vé lỗi, E-BKG-09): cảnh báo vận hành
-- một lần cho mỗi Booking (uq_outbox_dedupe).
create or replace function public.alert_unconfirmed_bookings()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into public.outbox (topic, aggregate_type, aggregate_id, payload)
  select 'BOOKING_CONFIRM_ALERT', 'booking', b.id,
         jsonb_build_object('type', 'BOOKING_NOT_CONFIRMED', 'paid_at', b.paid_at, 'code', b.code,
                            'issue_job', (select jsonb_build_object('status', o.status, 'attempts', o.attempts,
                                                                    'last_error', o.last_error)
                                          from public.outbox o
                                          where o.topic = 'ISSUE_TICKETS' and o.aggregate_id = b.id))
  from public.bookings b
  where b.status = 'PAID'
    and b.paid_at < now() - make_interval(mins => public.setting_int('booking.confirm_alert_minutes', 5))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Nhắc lịch: mặc định 24 giờ và 2 giờ trước giờ diễn (theo notification_preferences),
-- cộng nhắc tùy chỉnh trong user_reminders. Giờ hiển thị theo múi giờ của Venue.
-- notifications.dedupe_key bảo đảm mỗi người chỉ nhận một lần cho mỗi mốc.
create or replace function public.enqueue_session_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n     int := 0;
  v_rows  int;
begin
  with due as (
    select distinct t.owner_id as user_id, s.id as session_id, m.code, m.minutes,
           e.title as event_title, s.title as session_title,
           to_char(s.starts_at at time zone v.timezone, 'HH24:MI DD/MM/YYYY') as starts_local,
           v.name as venue_name
    from (values ('24H', 1440), ('2H', 120)) as m(code, minutes)
    join public.sessions s
      on s.starts_at > now() + make_interval(mins => m.minutes - 30)
     and s.starts_at <= now() + make_interval(mins => m.minutes + 15)
    join public.events e on e.id = s.event_id
    join public.venues v on v.id = s.venue_id
    join public.tickets t on t.session_id = s.id and t.status = 'ISSUED' and t.owner_id is not null
    left join public.notification_preferences np on np.user_id = t.owner_id
    where s.status in ('ON_SALE', 'SALES_CLOSED', 'SCHEDULED')
      and coalesce(np.push_enabled, true)
      and case m.code when '24H' then coalesce(np.reminder_24h, true) else coalesce(np.reminder_2h, true) end
  )
  insert into public.notifications (user_id, channel, template, title, body, data, dedupe_key)
  select user_id, 'PUSH', 'SESSION_REMINDER_' || code,
         'Sắp diễn ra: ' || event_title,
         coalesce(session_title || ' - ', '') || venue_name || ', bắt đầu lúc ' || starts_local,
         jsonb_build_object('session_id', session_id, 'reminder', code),
         'REMINDER_' || code || ':' || session_id || ':' || user_id
  from due
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_n := v_n + v_rows;

  insert into public.notifications (user_id, channel, template, title, body, data, dedupe_key)
  select r.user_id, 'PUSH', 'SESSION_REMINDER_CUSTOM', 'Nhắc lịch: ' || e.title,
         coalesce(s.title || ' - ', '') || v.name || ', bắt đầu lúc '
           || to_char(s.starts_at at time zone v.timezone, 'HH24:MI DD/MM/YYYY'),
         jsonb_build_object('session_id', s.id, 'reminder_id', r.id),
         'USER_REMINDER:' || r.id
  from public.user_reminders r
  join public.sessions s on s.id = r.session_id
  join public.events e on e.id = s.event_id
  join public.venues v on v.id = s.venue_id
  where r.enabled
    and s.status not in ('CANCELLED', 'ENDED', 'POSTPONED')
    and s.starts_at - make_interval(mins => r.remind_before_minutes) between now() - interval '15 minutes' and now()
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  return v_n + v_rows;
end;
$$;


-- ############################################################################
-- PHẦN 22 (1900) · cron_jobs
-- ############################################################################

-- ============================================================================
-- 1900 · Lịch job định kỳ (pg_cron, tài liệu mục 20.6). Hàm job ở 1500, 1600, 1820, 1850.
-- Các job cần gọi API cổng thanh toán (truy vấn giao dịch mỗi 2 phút, đối soát file
-- hằng ngày) chạy trong worker .NET (EventPlatform.Workers, lịch Quartz.NET);
-- không lên lịch ở đây (xem README).
-- ============================================================================

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron không có sẵn ở môi trường này, bỏ qua lịch job';
    return;
  end;

  perform cron.schedule('session-status-transitions', '* * * * *',
                        'select public.run_session_status_transitions()');
  perform cron.schedule('release-expired-bookings', '* * * * *',
                        'select public.release_expired_bookings(null)');
  perform cron.schedule('booking-confirm-alerts', '* * * * *',
                        'select public.alert_unconfirmed_bookings()');
  perform cron.schedule('session-reminders', '*/15 * * * *',
                        'select public.enqueue_session_reminders()');
  perform cron.schedule('settlement-cutoffs', '5 * * * *',
                        'select public.run_settlement_cutoffs()');
  perform cron.schedule('negative-balances', '0 18 * * *',   -- 01:00 giờ Việt Nam
                        'select public.refresh_negative_balances()');
end;
$$;
