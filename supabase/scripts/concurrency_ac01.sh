#!/usr/bin/env bash
# ============================================================================
# AC-01 song song (tài liệu mục 26): N kết nối cùng gọi create_booking cho MỘT ghế.
# Kỳ vọng: đúng 1 thành công, N-1 SEAT_CONFLICT, ticket_type_inventory.locked = 1.
#
#   bash supabase/scripts/concurrency_ac01.sh [DB_URL] [N]
#   DB_URL mặc định: DB local của `supabase start`
#
# Chỉ chạy trên DB local: dữ liệu test được commit (audit log bất biến nên không xóa được);
# dọn bằng `supabase db reset`.
# ============================================================================
set -euo pipefail
DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
N="${2:-50}"
RUN="ac01-$(date +%s)"
CR=$(printf '\r')
q() { psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 "$@" | tr -d "$CR"; }   # psql trên Windows in CRLF

# 1. Dữ liệu: Org đã duyệt, Session đang bán, 1 ghế, quota 1; N khách
read -r SES TT SEAT < <(q <<SQL | tail -n 1
do \$\$
declare
  v_owner uuid := gen_random_uuid(); v_admin uuid := gen_random_uuid();
  v_org uuid; v_kyc uuid; v_venue uuid; v_lv uuid; v_ev uuid; v_ses uuid; v_zone uuid; v_tt uuid;
begin
  insert into auth.users (id, email) values (v_owner, '$RUN-owner@test.vn'), (v_admin, '$RUN-admin@test.vn');
  insert into auth.users (id, email) select gen_random_uuid(), '$RUN-c' || n || '@test.vn' from generate_series(1, $N) n;
  insert into public.memberships (user_id, scope, roles) values (v_admin, 'PLATFORM', array['KYC_REVIEWER']);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'aal', 'aal2')::text, true);
  v_org := public.create_organization('AC01 $RUN', '$RUN');
  v_kyc := public.submit_kyc(v_org, '{}', '$RUN', jsonb_build_array(jsonb_build_object('doc_type', 'OTHER', 'storage_path', v_org || '/x.pdf')));
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'aal', 'aal2')::text, true);
  perform public.review_kyc(v_kyc, 'APPROVED');
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'aal', 'aal2')::text, true);
  v_venue := public.save_venue(jsonb_build_object('tenant_id', v_org, 'name', 'V', 'address_line', 'x', 'city', 'HCM', 'capacity', 10));
  v_lv := (public.create_layout(v_venue, 'L') ->> 'layout_version_id')::uuid;
  perform public.save_layout_draft(v_lv, '{"zones":[{"id":"A","name":"A","type":"seated","seats":[{"id":"A-1","row":"1","number":"1","x":0,"y":0}]}]}');
  perform public.publish_layout_version(v_lv);
  select id into v_zone from public.zones where layout_version_id = v_lv;
  v_ev := public.save_event(jsonb_build_object('tenant_id', v_org, 'title', 'AC01', 'slug', '$RUN'));
  v_ses := public.save_session(jsonb_build_object('event_id', v_ev, 'venue_id', v_venue, 'layout_version_id', v_lv,
             'starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 2 hours',
             'sales_start_at', now() - interval '1 hour', 'sales_end_at', now() + interval '1 day'));
  v_tt := public.save_ticket_type(jsonb_build_object('session_id', v_ses, 'name', 'T', 'kind', 'PAID', 'price_amount', 100000,
             'quota', 1, 'zone_ids', jsonb_build_array(v_zone)));
  perform public.submit_event_for_review(v_ev);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'aal', 'aal2')::text, true);
  perform public.review_event(v_ev, 'APPROVED');
  perform public.run_session_status_transitions();
  create temp table ac01_out as select v_ses as ses, v_tt as tt, (select id from public.seats where layout_version_id = v_lv) as seat;
end \$\$;
select ses || ' ' || tt || ' ' || seat from ac01_out;
SQL
)
echo "session=$SES ticket_type=$TT seat=$SEAT, $N kết nối song song..."

# 2. N kết nối song song, mỗi kết nối một khách
TMP="$(mktemp -d)"
i=0
for uid in $(q -c "select id from auth.users where email like '$RUN-c%' order by email"); do
  i=$((i + 1))
  ( q -c "begin; set local role authenticated;
          select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true) is not null;
          select 'RESULT:' || (public.create_booking('$SES', '[{\"ticket_type_id\":\"$TT\",\"seat_id\":\"$SEAT\"}]', 'ac01-key-$i') ->> 'status');
          commit;" > "$TMP/$i.out" 2>&1 || true ) &
done
wait

OK=$(cat "$TMP"/*.out | grep -c '^RESULT:PENDING$' || true)
CONFLICT=$(cat "$TMP"/*.out | grep -c 'ERROR: *SEAT_CONFLICT' || true)
if [ $((OK + CONFLICT)) -ne "$N" ]; then
  echo "Kết quả khác:"; grep -h -e ERROR -e RESULT "$TMP"/*.out | grep -v -e 'RESULT:PENDING' -e SEAT_CONFLICT | sort | uniq -c | head
fi
LOCKED=$(q -c "select locked from public.ticket_type_inventory where ticket_type_id = '$TT'")
echo "thành công=$OK  SEAT_CONFLICT=$CONFLICT  khác=$((N - OK - CONFLICT))  inventory.locked=$LOCKED"
rm -rf "$TMP"
if [ "$OK" -eq 1 ] && [ "$CONFLICT" -eq $((N - 1)) ] && [ "$LOCKED" -eq 1 ]; then
  echo "AC-01 PASS"
else
  echo "AC-01 FAIL"; exit 1
fi
