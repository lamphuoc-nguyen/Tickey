-- ============================================================================
-- Mã vào cổng theo đơn: một QR cho cả Booking, mỗi lần quét cho vào N người.
--
--   Worker: issue_tickets -> issue_booking_credential -> ký Ed25519 -> attach_booking_credential
--           -> attach_ticket_credentials (CONFIRMED). QR đơn có trước khi Booking CONFIRMED.
--   Khách:  get_booking_admission -> QR + tổng / đã vào / còn lại (server đếm, không suy từ cache).
--   Staff:  API .NET xác minh chữ ký QR -> check_in_booking: khóa Booking, cho vào N vé ISSUED
--           theo thứ tự, mỗi vé đi qua apply_scan (giữ nguyên luật WRONG_ZONE / OUTSIDE_TIME / log).
--
-- Payload v2: {"v":2,"bid":<booking>,"sid":<session>,"kid":...,"iat":...}; chỉ chứa id.
-- Lượt vào = vé ISSUED của đơn, nên hoàn / hủy một phần (vé VOID, REFUNDED...) tự trừ khỏi lượt còn lại.
-- ============================================================================

create table public.booking_credentials (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  tenant_id   uuid not null,
  kid         text not null references public.signing_keys (kid),
  payload     text not null,  -- chỉ chứa id, không chứa dữ liệu cá nhân
  signature   text not null,
  created_at  timestamptz not null default now()
);

alter table public.booking_credentials enable row level security;

-- Giống ticket_credentials: chủ đơn; hoặc Staff đã bán đơn POS cho khách vãng lai
create policy booking_credentials_read on public.booking_credentials for select
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_credentials.booking_id
      and (b.user_id = (select auth.uid())
           or (b.booking_type = 'POS' and b.user_id is null and b.sold_by = (select auth.uid())))
  ));

-- Bước 1 (server): payload cần ký, hoặc null nếu đơn đã có QR
create or replace function public.issue_booking_credential(p_booking_id uuid, p_kid text)
returns text
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
  if exists (select 1 from public.booking_credentials where booking_id = p_booking_id) then
    return null;
  end if;
  return jsonb_build_object('v', 2, 'bid', v_b.id, 'sid', v_b.session_id, 'kid', p_kid,
                            'iat', extract(epoch from now())::bigint)::text;
end;
$$;

-- Bước 2 (server): lưu chữ ký; gọi lại không đổi QR đã phát
create or replace function public.attach_booking_credential(p_booking_id uuid, p_kid text, p_payload text,
                                                            p_signature text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_credentials (booking_id, tenant_id, kid, payload, signature)
  select b.id, b.tenant_id, p_kid, p_payload, p_signature
  from public.bookings b
  where b.id = p_booking_id
  on conflict (booking_id) do nothing;
end;
$$;

-- Tổng / đã vào / còn lại của đơn. Vé bị thu hồi (VOID, REFUND_*) không tính là lượt.
create or replace function public.booking_admission_counts(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total',     count(*) filter (where status in ('ISSUED', 'USED', 'NO_SHOW')),
    'used',      count(*) filter (where status = 'USED'),
    'remaining', count(*) filter (where status = 'ISSUED'))
  from public.tickets
  where booking_id = p_booking_id;
$$;

-- Khách: QR của đơn và số lượt do server đếm
create or replace function public.get_booking_admission(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.assert_authenticated();
  v_b    public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if not found or not (v_b.user_id = v_user
                       or (v_b.booking_type = 'POS' and v_b.user_id is null and v_b.sold_by = v_user)) then
    perform public.app_error('NOT_FOUND');
  end if;
  return jsonb_build_object(
           'booking_id', v_b.id,
           'status', v_b.status,
           'credential', (select jsonb_build_object('kid', c.kid, 'payload', c.payload, 'signature', c.signature)
                          from public.booking_credentials c where c.booking_id = v_b.id))
         || public.booking_admission_counts(v_b.id);
end;
$$;

-- Staff: quét QR đơn (API đã xác minh chữ ký), cho vào p_count người trong một transaction.
-- Idempotent theo (device, client_scan_id): mỗi vé dùng client_scan_id '<id>:<n>', gọi lại trả kết quả cũ.
create or replace function public.check_in_booking(p_booking_id uuid, p_session_id uuid, p_gate_id uuid,
                                                   p_device_id uuid, p_client_scan_id text, p_count int default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.assert_authenticated();
  v_tenant   uuid;
  v_b        public.bookings%rowtype;
  v_zoned    boolean;
  v_prefix   text := p_client_scan_id || ':';
  v_eligible uuid[];
  v_scan     jsonb;
  v_admitted jsonb := '[]'::jsonb;
  v_result   text;
  v_info     jsonb := '{}'::jsonb;
  v_first    text;
begin
  select tenant_id into v_tenant from public.sessions where id = p_session_id;
  if v_tenant is null or not public.has_staff_permission(p_session_id, 'SCAN', p_gate_id) then
    perform public.app_error('FORBIDDEN');
  end if;
  perform public.assert_gate_device(p_device_id, v_tenant);
  if coalesce(trim(p_client_scan_id), '') = '' then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_client_scan_id'));
  end if;
  if p_count is null or p_count < 1 then
    perform public.app_error('VALIDATION_FAILED', jsonb_build_object('field', 'p_count'));
  end if;

  -- Gọi lại cùng client_scan_id (mất mạng, bấm 2 lần): trả kết quả đã ghi, không cho vào thêm
  select result into v_first from public.scan_logs
  where device_id = p_device_id and left(client_scan_id, length(v_prefix)) = v_prefix
  order by id limit 1;
  if found then
    select coalesce(jsonb_agg(l.details -> 'ticket' order by l.id), '[]'::jsonb) into v_admitted
    from public.scan_logs l
    where l.device_id = p_device_id and left(l.client_scan_id, length(v_prefix)) = v_prefix and l.result = 'OK';
    return jsonb_build_object('result', case when jsonb_array_length(v_admitted) > 0 then 'OK' else v_first end,
                              'replayed', true, 'booking_id', p_booking_id, 'admitted', v_admitted)
           || public.booking_admission_counts(p_booking_id);
  end if;

  -- Khóa đơn: hai máy quét cùng QR được xếp hàng, không cho vào quá số vé
  select * into v_b from public.bookings where id = p_booking_id and tenant_id = v_tenant for update;
  if not found then
    v_result := 'INVALID_SIGNATURE';
  elsif v_b.session_id <> p_session_id then
    v_result := 'WRONG_SESSION';
    v_info := jsonb_build_object('ticket_session_id', v_b.session_id,
                                 'ticket_session_starts_at', (select starts_at from public.sessions
                                                              where id = v_b.session_id));
  else
    v_zoned := p_gate_id is not null
               and exists (select 1 from public.session_gate_zones
                           where session_id = p_session_id and gate_id = p_gate_id);
    select coalesce(array_agg(t.id order by s.seat_code nulls last, t.id), '{}') into v_eligible
    from public.tickets t
    left join public.seats s on s.id = t.seat_id
    where t.booking_id = p_booking_id and t.status = 'ISSUED'
      and (not v_zoned or exists (select 1 from public.session_gate_zones z
                                  where z.session_id = p_session_id and z.gate_id = p_gate_id
                                    and z.zone_id = t.zone_id));

    if cardinality(v_eligible) = 0 then
      if exists (select 1 from public.tickets where booking_id = p_booking_id and status = 'ISSUED') then
        v_result := 'WRONG_ZONE';
        v_info := jsonb_build_object('allowed_gates', coalesce((
          select jsonb_agg(distinct jsonb_build_object('gate_id', g.id, 'code', g.code, 'name', g.name))
          from public.tickets t
          join public.session_gate_zones sgz on sgz.session_id = p_session_id and sgz.zone_id = t.zone_id
          join public.gates g on g.id = sgz.gate_id
          where t.booking_id = p_booking_id and t.status = 'ISSUED'), '[]'::jsonb));
      elsif exists (select 1 from public.tickets where booking_id = p_booking_id and status = 'USED') then
        v_result := 'ALREADY_USED';
        v_info := jsonb_build_object('used_at', (select max(used_at) from public.tickets
                                                 where booking_id = p_booking_id and status = 'USED'));
      else
        v_result := 'REVOKED';
      end if;
    elsif p_count > cardinality(v_eligible) then
      -- Chưa ghi gì: Staff chọn lại số người
      perform public.app_error('VALIDATION_FAILED', jsonb_build_object(
        'field', 'p_count', 'remaining', cardinality(v_eligible)));
    else
      for i in 1 .. p_count loop
        v_scan := public.apply_scan(v_eligible[i], p_session_id, p_gate_id, p_device_id, 'ONLINE',
                                    v_prefix || i, jsonb_build_object('booking_id', p_booking_id));
        exit when v_scan ->> 'result' <> 'OK';
        v_admitted := v_admitted || jsonb_build_array(v_scan -> 'ticket');
      end loop;
      -- Lỗi của vé đầu (vd. OUTSIDE_TIME) áp cho cả lần quét; apply_scan đã ghi log
      v_result := case when jsonb_array_length(v_admitted) > 0 then 'OK' else v_scan ->> 'result' end;
      return jsonb_build_object('result', v_result, 'booking_id', p_booking_id, 'booking_code', v_b.code,
                                'holder_name', coalesce(v_b.buyer_snapshot ->> 'holder_name',
                                                        (select full_name from public.profiles
                                                         where id = v_b.user_id)),
                                'admitted', v_admitted)
             || public.booking_admission_counts(p_booking_id);
    end if;
  end if;

  -- Từ chối cả đơn: một dòng log không gắn vé
  insert into public.scan_logs (tenant_id, session_id, ticket_id, gate_id, device_id, staff_id, mode, result,
                                scanned_at, client_scan_id, details)
  values (v_tenant, p_session_id, null, p_gate_id, p_device_id, v_user, 'ONLINE', v_result,
          now(), v_prefix || '0', v_info || jsonb_build_object('booking_id', p_booking_id));

  return jsonb_build_object('result', v_result, 'booking_id', p_booking_id, 'admitted', '[]'::jsonb)
         || v_info || public.booking_admission_counts(p_booking_id);
end;
$$;

grant execute on function public.get_booking_admission(uuid) to authenticated;
grant execute on function public.check_in_booking(uuid, uuid, uuid, uuid, text, int) to authenticated;
-- Chỉ server (service_role): issue_booking_credential, attach_booking_credential, booking_admission_counts

-- Đơn đã CONFIRMED trước bản này: xếp lại ISSUE_TICKETS để worker ký QR đơn. issue_tickets không phát
-- vé mới cho đơn đã có vé, attach_ticket_credentials với danh sách rỗng giữ nguyên trạng thái và không
-- gửi lại thông báo.
select public.enqueue('ISSUE_TICKETS', 'booking', b.id)
from public.bookings b
join public.sessions s on s.id = b.session_id
where b.status = 'CONFIRMED'
  and s.ends_at > now()
  and not exists (select 1 from public.booking_credentials c where c.booking_id = b.id);
