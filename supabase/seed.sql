-- ============================================================================
-- seed.sql · Dữ liệu mẫu và tài khoản test (tài liệu mục 16)   (chủ: Đinh Khôi)
-- Chạy tự động sau migrations khi `supabase db reset`. Mật khẩu dev: xem supabase/README.md.
--
--   admin       Admin đủ quyền KYC, tài chính, khiếu nại, hỗ trợ      Duyệt KYC, duyệt hủy, payout
--   admin-2     Admin thứ hai (FINANCE_ADMIN, DISPUTE_ADMIN)           Phiếu duyệt thứ hai (hai người)
--   owner-a     Owner của Org A (APPROVED)                             Tạo Venue, sự kiện
--   owner-b     Owner của Org B (APPROVED, chỉ có dữ liệu nháp)        Thử cô lập tenant
--   staff-a     Staff của Org A (SCANNER, POS), phân công 1 Session    Quét vé, check-in thủ công, POS
--   customer-1, customer-2  Customer                                   Đặt vé, tranh cùng một ghế
--   multi       Customer + Staff của Org A                             Thử bộ chọn không gian làm việc
-- Tài khoản Admin / Owner / Finance phải bật 2FA (TOTP) trong app trước khi dùng RPC nhạy cảm.
-- Mọi dữ liệu nghiệp vụ được tạo qua RPC (như portal làm) để tồn kho, sổ cái, audit nhất quán.
-- ============================================================================

-- ---------------------------------------------------------------- tài khoản
do $$
declare
  v_pw text := extensions.crypt('Dev@123456', extensions.gen_salt('bf'));
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name, 'phone', u.phone),
         now(), now(), '', '', '', ''
  from (values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@dev.local',      'Admin Nền Tảng',  '0900000001'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'admin-2@dev.local',    'Admin Thứ Hai',   '0900000002'),
    ('a0000000-0000-4000-8000-00000000000a'::uuid, 'owner-a@dev.local',    'Chủ Org A',       '0900000010'),
    ('a0000000-0000-4000-8000-00000000000b'::uuid, 'owner-b@dev.local',    'Chủ Org B',       '0900000011'),
    ('a0000000-0000-4000-8000-0000000000f1'::uuid, 'staff-a@dev.local',    'Nhân Viên Cổng A','0900000020'),
    ('a0000000-0000-4000-8000-0000000000c1'::uuid, 'customer-1@dev.local', 'Nguyễn Văn Một',  '0901111111'),
    ('a0000000-0000-4000-8000-0000000000c2'::uuid, 'customer-2@dev.local', 'Trần Thị Hai',    '0902222222'),
    ('a0000000-0000-4000-8000-0000000000e1'::uuid, 'multi@dev.local',      'Lê Đa Năng',      '0903333333')
  ) as u(id, email, full_name, phone)
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u
  where u.email like '%@dev.local'
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
end $$;

insert into public.memberships (user_id, scope, roles) values
  ('a0000000-0000-4000-8000-000000000001', 'PLATFORM', array['KYC_REVIEWER','FINANCE_ADMIN','DISPUTE_ADMIN','SUPPORT']),
  ('a0000000-0000-4000-8000-000000000002', 'PLATFORM', array['FINANCE_ADMIN','DISPUTE_ADMIN'])
on conflict do nothing;

insert into public.categories (slug, name, sort_order) values
  ('am-nhac', 'Âm nhạc', 1), ('san-khau', 'Sân khấu', 2), ('the-thao', 'Thể thao', 3), ('hoi-thao', 'Hội thảo', 4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- Org, Venue, sự kiện
do $$
declare
  c_admin   constant uuid := 'a0000000-0000-4000-8000-000000000001';
  c_owner_a constant uuid := 'a0000000-0000-4000-8000-00000000000a';
  c_owner_b constant uuid := 'a0000000-0000-4000-8000-00000000000b';
  c_staff   constant uuid := 'a0000000-0000-4000-8000-0000000000f1';
  c_multi   constant uuid := 'a0000000-0000-4000-8000-0000000000e1';
  v_org_a uuid; v_org_b uuid; v_kyc uuid; v_venue uuid; v_venue_b uuid; v_lv uuid; v_lv_b uuid; v_ev uuid;
  v_ses1 uuid; v_ses2 uuid; v_zone_vip uuid; v_zone_std uuid; v_zone_ga uuid; v_g1 uuid; v_g2 uuid;
  v_layout jsonb;
  s uuid;
begin
  if exists (select 1 from public.organizations where slug = 'org-a') then
    return;  -- đã seed
  end if;

  -- Org A: đăng ký, nộp KYC, Admin duyệt
  perform set_config('request.jwt.claims', json_build_object('sub', c_owner_a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_org_a := public.create_organization('Nhà hát Ánh Trăng', 'org-a');
  v_kyc := public.submit_kyc(v_org_a, '{"legal_name":"Công ty TNHH Ánh Trăng","address":"7 Công trường Lam Sơn, Q.1, TP.HCM"}',
                             '0312345678', jsonb_build_array(
                               jsonb_build_object('doc_type', 'BUSINESS_LICENSE', 'storage_path', v_org_a || '/gpkd.pdf'),
                               jsonb_build_object('doc_type', 'ID_CARD_FRONT', 'storage_path', v_org_a || '/cccd-truoc.jpg')));
  perform set_config('request.jwt.claims', json_build_object('sub', c_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.review_kyc(v_kyc, 'APPROVED');

  -- Org B: cũng được duyệt nhưng chỉ có dữ liệu nháp (thử cô lập tenant)
  perform set_config('request.jwt.claims', json_build_object('sub', c_owner_b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_org_b := public.create_organization('Sân khấu Bình Minh', 'org-b');
  v_kyc := public.submit_kyc(v_org_b, '{"legal_name":"Hộ kinh doanh Bình Minh"}', '0398765432',
                             jsonb_build_array(jsonb_build_object('doc_type', 'BUSINESS_LICENSE', 'storage_path', v_org_b || '/gpkd.pdf')));
  perform set_config('request.jwt.claims', json_build_object('sub', c_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.review_kyc(v_kyc, 'APPROVED');

  -- Venue + Layout của Org A: khu VIP (2 hàng x 10), khu Thường (4 hàng x 12, 1 ghế kỹ thuật), khu đứng 300
  perform set_config('request.jwt.claims', json_build_object('sub', c_owner_a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_venue := public.save_venue(jsonb_build_object('tenant_id', v_org_a, 'name', 'Nhà hát Thành phố', 'venue_type', 'THEATER',
             'address_line', '7 Công trường Lam Sơn', 'ward', 'Bến Nghé', 'district', 'Quận 1', 'city', 'TP.HCM',
             'latitude', 10.7765, 'longitude', 106.7033, 'capacity', 1500));
  v_lv := (public.create_layout(v_venue, 'Khán phòng chính') ->> 'layout_version_id')::uuid;
  select jsonb_build_object('zones', jsonb_build_array(
    jsonb_build_object('id', 'VIP', 'name', 'Khu VIP', 'type', 'seated', 'color', '#C9A227', 'seats',
      (select jsonb_agg(jsonb_build_object('id', 'VIP-' || r || '-' || n, 'section', 'Tầng trệt', 'row', r, 'number', n::text,
                                           'x', n, 'y', ascii(r) - 65,
                                           'flags', case when n in (1, 10) then '["wheelchair"]'::jsonb else '[]'::jsonb end)
                        order by r, n)
       from unnest(array['A','B']) r, generate_series(1, 10) n)),
    jsonb_build_object('id', 'STD', 'name', 'Khu Thường', 'type', 'seated', 'color', '#2E86DE', 'seats',
      (select jsonb_agg(jsonb_build_object('id', 'STD-' || r || '-' || n, 'section', 'Tầng trệt', 'row', r, 'number', n::text,
                                           'x', n, 'y', ascii(r) - 65 + 1,
                                           'flags', case when r = 'F' and n = 6 then '["restricted_view"]'::jsonb else '[]'::jsonb end,
                                           'blocked', r = 'F' and n = 6)
                        order by r, n)
       from unnest(array['C','D','E','F']) r, generate_series(1, 12) n)),
    jsonb_build_object('id', 'GA', 'name', 'Khu đứng', 'type', 'standing', 'color', '#27AE60', 'capacity', 300)))
  into v_layout;
  perform public.save_layout_draft(v_lv, v_layout);
  perform public.publish_layout_version(v_lv);
  select id into v_zone_vip from public.zones where layout_version_id = v_lv and code = 'VIP';
  select id into v_zone_std from public.zones where layout_version_id = v_lv and code = 'STD';
  select id into v_zone_ga  from public.zones where layout_version_id = v_lv and code = 'GA';

  -- Event một nhiều Session (cùng Venue), mở bán ngay
  v_ev := public.save_event(jsonb_build_object('tenant_id', v_org_a, 'title', 'Đêm nhạc Mùa Thu', 'slug', 'dem-nhac-mua-thu',
          'summary', 'Hòa nhạc thính phòng mùa thu', 'description', 'Chương trình hòa nhạc với dàn nhạc giao hưởng thành phố.',
          'category_id', (select id from public.categories where slug = 'am-nhac'), 'age_limit', 6,
          'terms', 'Vé đã mua chỉ hoàn khi Session bị hủy.'));
  v_ses1 := public.save_session(jsonb_build_object('event_id', v_ev, 'venue_id', v_venue, 'layout_version_id', v_lv,
            'title', 'Đêm 1', 'starts_at', date_trunc('hour', now()) + interval '7 days 20 hours',
            'ends_at', date_trunc('hour', now()) + interval '7 days 22 hours',
            'doors_open_at', date_trunc('hour', now()) + interval '7 days 19 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', date_trunc('hour', now()) + interval '7 days 19 hours',
            'max_tickets_per_account', 6));
  v_ses2 := public.save_session(jsonb_build_object('event_id', v_ev, 'venue_id', v_venue, 'layout_version_id', v_lv,
            'title', 'Đêm 2', 'starts_at', date_trunc('hour', now()) + interval '14 days 20 hours',
            'ends_at', date_trunc('hour', now()) + interval '14 days 22 hours',
            'sales_start_at', now() - interval '1 hour', 'sales_end_at', date_trunc('hour', now()) + interval '14 days 19 hours'));
  foreach s in array array[v_ses1, v_ses2] loop
    perform public.save_ticket_type(jsonb_build_object('session_id', s, 'name', 'VIP', 'kind', 'PAID',
            'price_amount', 1500000, 'quota', 20, 'max_per_order', 4, 'zone_ids', jsonb_build_array(v_zone_vip), 'sort_order', 1));
    perform public.save_ticket_type(jsonb_build_object('session_id', s, 'name', 'Thường', 'kind', 'PAID',
            'price_amount', 600000, 'quota', 47, 'zone_ids', jsonb_build_array(v_zone_std), 'sort_order', 2));
    perform public.save_ticket_type(jsonb_build_object('session_id', s, 'name', 'Vé đứng', 'kind', 'PAID',
            'price_amount', 300000, 'quota', 250, 'zone_ids', jsonb_build_array(v_zone_ga), 'sort_order', 3));
    perform public.save_ticket_type(jsonb_build_object('session_id', s, 'name', 'Sinh viên (miễn phí)', 'kind', 'FREE',
            'quota', 50, 'max_per_order', 2, 'zone_ids', jsonb_build_array(v_zone_ga), 'sort_order', 4));
    perform public.save_ticket_type(jsonb_build_object('session_id', s, 'name', 'Khách mời', 'kind', 'COMP',
            'quota', 10, 'zone_ids', jsonb_build_array(v_zone_vip, v_zone_ga), 'sort_order', 9));
  end loop;
  perform public.submit_event_for_review(v_ev);   -- Org hạng NEW: bắt buộc kiểm duyệt

  -- Cổng, phân công Staff cho Đêm 1
  insert into public.gates (tenant_id, venue_id, code, name) values
    (v_org_a, v_venue, 'G1', 'Cổng chính (VIP, Thường)'), (v_org_a, v_venue, 'G2', 'Cổng phụ (Khu đứng)');
  select id into v_g1 from public.gates where venue_id = v_venue and code = 'G1';
  select id into v_g2 from public.gates where venue_id = v_venue and code = 'G2';
  perform public.set_session_gate_zones(v_ses1, jsonb_build_array(
    jsonb_build_object('gate_id', v_g1, 'zone_ids', jsonb_build_array(v_zone_vip, v_zone_std)),
    jsonb_build_object('gate_id', v_g2, 'zone_ids', jsonb_build_array(v_zone_ga))));
  perform public.set_org_member(v_org_a, 'staff-a@dev.local', array['SCANNER', 'POS']);
  perform public.set_org_member(v_org_a, 'multi@dev.local', array['SCANNER']);
  perform public.assign_staff(v_ses1, c_staff, array['SCAN', 'MANUAL_CHECKIN', 'POS', 'VIEW_ANALYTICS'], v_g1);

  -- Admin duyệt sự kiện -> Session tự mở bán
  perform set_config('request.jwt.claims', json_build_object('sub', c_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.review_event(v_ev, 'APPROVED');
  perform public.run_session_status_transitions();

  -- Org B: Venue và sự kiện nháp, không công bố
  perform set_config('request.jwt.claims', json_build_object('sub', c_owner_b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_venue_b := public.save_venue(jsonb_build_object('tenant_id', v_org_b, 'name', 'Sân khấu nhỏ Bình Minh', 'venue_type', 'HALL',
               'address_line', '12 Nguyễn Huệ', 'city', 'TP.HCM', 'capacity', 200));
  v_lv_b := (public.create_layout(v_venue_b, 'Sân khấu') ->> 'layout_version_id')::uuid;
  perform public.save_layout_draft(v_lv_b, '{"zones":[{"id":"GA","name":"Khu đứng","type":"standing","capacity":150}]}');
  perform public.publish_layout_version(v_lv_b);
  perform public.save_session(jsonb_build_object(
    'event_id', public.save_event(jsonb_build_object('tenant_id', v_org_b, 'title', 'Kịch nói (nháp)', 'slug', 'kich-noi-nhap')),
    'venue_id', v_venue_b, 'layout_version_id', v_lv_b,
    'starts_at', now() + interval '30 days', 'ends_at', now() + interval '30 days 2 hours',
    'sales_start_at', now() + interval '1 day', 'sales_end_at', now() + interval '29 days'));

  perform set_config('request.jwt.claims', '', true);
end $$;
