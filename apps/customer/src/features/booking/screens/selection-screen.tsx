import { useEffect, useMemo, useState } from 'react';
import { ApiError, formatMoney, type BookingItemInput } from '@event/core';
import { NativeSeatMap } from '@event/seat-map/native';
import type { LayoutData, SeatState } from '@event/seat-map';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  ActionFooter,
  Button,
  Copy,
  ErrorNotice,
  Field,
  Heading,
  Notice,
  QueryState,
  Screen,
  c,
  ui,
  Select,
  errorMessage,
} from '@/components/ui';
import { ResultPanel } from '@/components/detail';
import {
  useAvailability,
  useLayout,
  useSeatPricing,
  useTicketTypes,
  useSessions,
} from '@/features/catalog/hooks/use-catalog';
import { useBookingDraft } from '../draft-store';
import { useSelectionBooking } from '../hooks/use-selection-booking';
import { FreeRegistrationFields } from '../components/free-registration-fields';
import { selectionLimit } from '../selection-rules';

const seatStatusLabels: Record<SeatState, string> = {
  AVAILABLE: 'Còn trống',
  LOCKED: 'Đang khóa tạm',
  SOLD: 'Đã bán',
  BLOCKED: 'Chặn bán',
  HELD: 'Được giữ bởi ban tổ chức',
};

export default function SelectionScreen() {
  const { sessionId = '', eventId = '' } = useLocalSearchParams<{ sessionId: string; eventId: string }>();
  const layout = useLayout(sessionId);
  const availability = useAvailability(sessionId);
  const pricing = useSeatPricing(sessionId);
  const types = useTicketTypes(sessionId);
  const sessions = useSessions(eventId);
  const draft = useBookingDraft();
  const booking = useSelectionBooking(sessionId, eventId);
  const [accessible, setAccessible] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    useBookingDraft.getState().chooseSession(sessionId, eventId);
  }, [sessionId, eventId]);
  const zone = layout.data?.zones.find((z) => z.id === draft.zoneId);
  const activeTypes = (types.data ?? []).filter(
    (t) => t.kind !== 'COMP' && t.visibility === 'PUBLIC' && t.status === 'ACTIVE',
  );
  const selectedType = activeTypes.find((t) => t.id === draft.ticketTypeId);
  const seatsToType = useMemo(
    () =>
      new Map(
        Object.entries(pricing.data ?? {}).flatMap(([typeId, seats]) =>
          seats.map((id) => [id, typeId] as const),
        ),
      ),
    [pricing.data],
  );
  const items: BookingItemInput[] =
    zone?.type === 'standing'
      ? selectedType
        ? [{ ticketTypeId: selectedType.id, zoneId: zone.id, quantity: draft.quantity }]
        : []
      : zone?.type === 'seated'
        ? draft.selected.flatMap((id) => {
            const typeId = seatsToType.get(id);
            return typeId ? [{ seatId: id, ticketTypeId: typeId }] : [];
          })
        : [];
  const limit = selectionLimit(
    items,
    activeTypes,
    sessions.data?.find((s) => s.id === sessionId)?.maxTicketsPerAccount,
  );
  const allSeats = layout.data?.zones.flatMap((z) => z.seats) ?? [];
  const seatById = new Map(allSeats.map((s) => [s.id, s]));
  const total =
    zone?.type === 'standing'
      ? (selectedType?.priceAmount ?? 0) * draft.quantity
      : draft.selected.reduce(
          (sum, id) => sum + (activeTypes.find((t) => t.id === seatsToType.get(id))?.priceAmount ?? 0),
          0,
        );
  const isFree =
    items.length > 0 && items.every((i) => activeTypes.find((t) => t.id === i.ticketTypeId)?.kind === 'FREE');
  const freeUnavailable =
    isFree &&
    booking.error instanceof ApiError &&
    ['SOLD_OUT', 'LIMIT_EXCEEDED', 'SESSION_NOT_ON_SALE', 'INVALID_STATE'].includes(booking.error.code);
  const states = availability.data?.unavailableSeats ?? {};
  const blockedByType = Object.fromEntries(
    allSeats
      .filter((s) => !activeTypes.some((t) => t.id === seatsToType.get(s.id)))
      .map((s) => [s.id, 'BLOCKED' as const]),
  );
  const seatStates: Record<string, SeatState> = { ...blockedByType, ...states };
  const onSale = availability.data?.sessionStatus === 'ON_SALE' && !availability.data.salesPaused;
  const isReady = layout.data && availability.data && pricing.data && types.data;
  const changed = draft.selected.some(
    (id) => !seatById.has(id) || (seatStates[id] && seatStates[id] !== 'AVAILABLE'),
  );
  const error = layout.error ?? availability.error ?? pricing.error ?? types.error;
  const refreshing = availability.isRefetching;
  const layoutData: LayoutData = useMemo(
    () => ({
      version: layout.data?.version ?? 1,
      zones: layout.data?.zones.filter((z) => z.id === draft.zoneId) ?? [],
    }),
    [layout.data, draft.zoneId],
  );
  const maxQuantity = Math.min(
    selectedType?.maxPerOrder ?? 1,
    availability.data?.zones.find((z) => z.zoneId === zone?.id)?.remaining ?? 0,
    availability.data?.ticketTypes.find((t) => t.ticketTypeId === selectedType?.id)?.remaining ?? 0,
  );
  const standingContractMissing = zone?.type === 'standing' && (layout.data?.zones.length ?? 0) > 1;
  const disabled =
    !draft.unresolved &&
    (!isReady ||
      !!error ||
      !onSale ||
      !items.length ||
      !zone ||
      standingContractMissing ||
      !!limit ||
      (zone?.type === 'standing' ? draft.quantity > maxQuantity || draft.quantity < 1 : changed));
  const visibleAccessibleSeats = (zone?.seats ?? []).slice(page * 20, page * 20 + 20);
  const reference = seatById.get(draft.conflicts[0] ?? '');
  const replacement = reference
    ? (zone?.seats ?? [])
        .filter((s) => !draft.selected.includes(s.id) && (seatStates[s.id] ?? 'AVAILABLE') === 'AVAILABLE')
        .sort(
          (a, b) =>
            Math.hypot(a.x - reference.x, a.y - reference.y) -
            Math.hypot(b.x - reference.x, b.y - reference.y),
        )[0]
    : undefined;
  if (draft.unresolved && draft.sessionId !== sessionId)
    return (
      <Screen>
        <Heading>Kiểm tra yêu cầu đặt vé trước</Heading>
        <Notice warning>
          Chưa xác nhận được kết quả đặt vé trước đó. Kiểm tra đơn hoặc quay về lựa chọn trước khi bắt đầu yêu
          cầu mới.
        </Notice>
        <Button
          onPress={() =>
            router.replace({
              pathname: '/sessions/[sessionId]/select',
              params: { sessionId: draft.sessionId, eventId: draft.eventId },
            })
          }
        >
          Về lựa chọn đang kiểm tra
        </Button>
        <Button secondary onPress={() => router.push('/orders')}>
          Kiểm tra Đơn của tôi
        </Button>
      </Screen>
    );
  return (
    <Screen
      footer={
        <>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Copy style={ui.semibold}>{draft.unresolved ? 'Giữ nguyên ý định đặt vé' : 'Theo lựa chọn'}</Copy>
            <Copy style={{ color: c.accent, fontFamily: 'Outfit-Bold', fontSize: 17 }}>
              {items.length ? formatMoney(total) : 'Chưa chọn vé'}
            </Copy>
          </View>
          <ActionFooter
            disabled={disabled}
            disabledReason={
              limit ??
              (error
                ? 'Chưa thể tải đầy đủ thông tin chỗ. Vui lòng thử lại.'
                : !isReady
                  ? 'Đang tải thông tin chỗ.'
                  : !onSale
                    ? 'Suất diễn hiện không bán vé.'
                    : standingContractMissing
                      ? 'Chưa xác định được hạng vé cho khu này. Vui lòng chọn khu hoặc suất khác.'
                      : !zone
                        ? 'Chọn khu vực để tiếp tục.'
                        : !items.length
                          ? 'Chọn ghế hoặc số lượng vé để tiếp tục.'
                          : changed
                            ? 'Một số ghế không còn trống. Vui lòng chọn lại.'
                            : `Số lượng vé phải từ 1 đến ${maxQuantity}.`)
            }
            busy={booking.isPending}
            onPress={() => void booking.hold(items)}
          >
            {draft.unresolved ? 'Thử lại cùng yêu cầu' : isFree ? 'Xác nhận đăng ký' : 'Giữ chỗ'}
          </ActionFooter>
        </>
      }
    >
      <Heading>
        {draft.conflicts.length
          ? 'Ghế vừa được đặt'
          : isFree
            ? 'Đăng ký vé miễn phí'
            : zone?.type === 'standing'
              ? 'Vé khu đứng'
              : 'Chọn ghế'}
      </Heading>
      <QueryState
        loading={!isReady && !error}
        error={error}
        retry={() => {
          void layout.refetch();
          void availability.refetch();
          void pricing.refetch();
          void types.refetch();
        }}
        empty={!!isReady && !layout.data?.zones.length}
        emptyText="Chưa có sơ đồ hoặc khu vé."
      />
      {standingContractMissing && (
        <Notice warning>
          Hạng vé cho khu đứng trong sơ đồ nhiều khu chưa khả dụng. Vui lòng chọn suất khác hoặc liên hệ hỗ
          trợ.
        </Notice>
      )}
      {!!booking.error && <ErrorNotice error={booking.error} />}
      {freeUnavailable && (
        <>
          <ResultPanel title="Chưa thể đăng ký" description={errorMessage(booking.error)} kind="warning" />
          <Button secondary onPress={() => router.push('/orders')}>
            Đơn của tôi
          </Button>
        </>
      )}
      {draft.unresolved && (
        <Notice warning>
          Chưa biết máy chủ đã nhận yêu cầu hay chưa. Giữ nguyên lựa chọn và thử lại cùng yêu cầu để tránh tạo
          đơn trùng.
        </Notice>
      )}
      {draft.unresolved && (
        <Button secondary onPress={() => router.push('/orders')}>
          Kiểm tra đơn của tôi
        </Button>
      )}
      {!!draft.conflicts.length && (
        <Notice warning>
          Ghế {draft.conflicts.map((id) => seatById.get(id)?.code ?? id).join(', ')} vừa được đặt. Các ghế còn
          lại vẫn được chọn nhưng chưa được giữ.
        </Notice>
      )}
      {replacement && !draft.unresolved && (
        <Button secondary onPress={() => draft.toggleSeat(replacement.id)}>
          Chọn ghế thay thế {replacement.code}
        </Button>
      )}
      {!!isReady && !onSale && (
        <Notice warning>
          {availability.data?.sessionStatus === 'CANCELLED'
            ? 'Suất diễn đã bị hủy.'
            : 'Suất diễn đang tạm dừng hoặc đã đóng bán.'}
        </Notice>
      )}
      {changed && !draft.unresolved && (
        <Notice warning>Tình trạng ghế đã thay đổi. Chọn lại ghế đang trống trước khi giữ chỗ.</Notice>
      )}
      {!!isReady && (
        <>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {layout.data?.zones.map((z) => (
              <Pressable
                disabled={draft.unresolved || booking.isPending}
                accessibilityRole="radio"
                accessibilityState={{ checked: zone?.id === z.id }}
                key={z.id}
                onPress={() => {
                  draft.setStanding({ zoneId: z.id, ticketTypeId: '' });
                  setPage(0);
                }}
                style={[
                  ui.card,
                  {
                    minHeight: 48,
                    borderColor: zone?.id === z.id ? c.accent : c.border,
                    backgroundColor: zone?.id === z.id ? c.tint : 'white',
                  },
                ]}
              >
                <Copy>{z.name}</Copy>
              </Pressable>
            ))}
          </View>
          {!zone && <Notice>Chọn khu vực để xem ghế hoặc hạng vé.</Notice>}
          {zone?.type === 'standing' ? (
            <>
              <Select
                label="Hạng vé"
                disabled={draft.unresolved || standingContractMissing}
                disabledReason={
                  draft.unresolved
                    ? 'Đang kiểm tra yêu cầu đặt vé.'
                    : 'Chưa xác định được hạng vé cho khu này.'
                }
                value={selectedType?.id ?? ''}
                options={activeTypes.map((t) => ({
                  value: t.id,
                  label: `${t.name} · ${formatMoney(t.priceAmount)}`,
                }))}
                onChange={(ticketTypeId) => draft.setStanding({ ticketTypeId })}
              />
              <Field
                label="Số lượng"
                value={String(draft.quantity)}
                editable={!draft.unresolved}
                keyboardType="number-pad"
                onChangeText={(text) => {
                  if (/^\d{0,3}$/.test(text)) draft.setStanding({ quantity: Number(text) });
                }}
              />
              <Copy style={ui.muted}>
                {selectedType
                  ? `Tối đa hiện hiển thị: ${maxQuantity} vé. Số lượng được xác nhận khi tạo đơn.`
                  : 'Chọn hạng vé để xem giới hạn số lượng.'}
              </Copy>
              <Notice>Giá hiển thị để tham khảo. Giá và số chỗ được xác nhận khi giữ chỗ.</Notice>
            </>
          ) : zone ? (
            <>
              <Notice>SÂN KHẤU</Notice>
              <Copy style={ui.muted}>Vuốt để xem ghế · Chạm ghế để chọn · Chụm để phóng to.</Copy>
              <NativeSeatMap
                key={zone.id}
                layout={layoutData}
                seatStates={seatStates}
                selectedSeatIds={new Set(draft.selected)}
                conflictSeatIds={new Set(draft.conflicts)}
                fontSource={require('../../../../assets/fonts/BeVietnamPro-Medium.ttf')}
                mode={draft.unresolved ? 'view' : 'select'}
                onSeatPress={(id) => {
                  if (!draft.unresolved) draft.toggleSeat(id);
                }}
              />
              <Copy>Còn trống · ✓ Đang chọn · ! Xung đột · × Chặn bán</Copy>
              <Copy style={ui.muted}>Màu xám: đã bán · Vàng: khóa tạm · Xanh nhạt: Ban tổ chức giữ.</Copy>
              {draft.selected.map((id) => (
                <View key={id} style={[ui.card, ui.row]}>
                  <Copy style={{ flex: 1 }}>
                    {seatById.get(id)?.code} · {activeTypes.find((t) => t.id === seatsToType.get(id))?.name}
                  </Copy>
                  <Button
                    disabled={draft.unresolved}
                    disabledReason="Đang kiểm tra yêu cầu đặt vé, cần giữ nguyên lựa chọn."
                    secondary
                    onPress={() => draft.toggleSeat(id)}
                  >
                    Bỏ chọn
                  </Button>
                </View>
              ))}
              <Button secondary onPress={() => setAccessible((p) => !p)}>
                Danh sách ghế dễ truy cập
              </Button>
              {accessible && (
                <>
                  <View style={[ui.row, { flexWrap: 'wrap' }]}>
                    {visibleAccessibleSeats.map((s) => (
                      <Pressable
                        disabled={draft.unresolved || (seatStates[s.id] ?? 'AVAILABLE') !== 'AVAILABLE'}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Ghế ${s.code}, ${seatStatusLabels[seatStates[s.id] ?? 'AVAILABLE']}`}
                        accessibilityState={{
                          checked: draft.selected.includes(s.id),
                          disabled: (seatStates[s.id] ?? 'AVAILABLE') !== 'AVAILABLE',
                        }}
                        key={s.id}
                        onPress={() => draft.toggleSeat(s.id)}
                        style={[
                          ui.card,
                          {
                            minHeight: 48,
                            backgroundColor: draft.selected.includes(s.id) ? c.primaryContainer : 'white',
                          },
                        ]}
                      >
                        <Copy>{s.code}</Copy>
                      </Pressable>
                    ))}
                  </View>
                  <Button
                    disabled={page === 0}
                    disabledReason="Đang ở trang đầu."
                    onPress={() => setPage((p) => p - 1)}
                    secondary
                  >
                    Trang trước
                  </Button>
                  <Button
                    disabled={(page + 1) * 20 >= zone.seats.length}
                    disabledReason="Đã đến trang cuối của danh sách ghế."
                    onPress={() => setPage((p) => p + 1)}
                    secondary
                  >
                    Trang sau
                  </Button>
                </>
              )}
            </>
          ) : null}
          {isFree && (
            <FreeRegistrationFields
              sessionId={sessionId}
              count={
                zone?.type === 'standing'
                  ? draft.quantity > 0 && draft.quantity <= maxQuantity
                    ? draft.quantity
                    : 0
                  : draft.selected.length
              }
            />
          )}
          {!draft.unresolved && draft.selected.length > 0 && (
            <Button secondary onPress={() => draft.selected.forEach((id) => draft.toggleSeat(id))}>
              Bỏ chọn tất cả
            </Button>
          )}
          {refreshing && <Copy style={ui.muted}>Đang cập nhật tình trạng chỗ…</Copy>}
        </>
      )}
    </Screen>
  );
}
