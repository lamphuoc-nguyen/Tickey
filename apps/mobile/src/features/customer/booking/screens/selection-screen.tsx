import { useEffect, useMemo, useState } from 'react';
import { ApiError, formatMoney, formatSessionTime, type BookingItemInput } from '@event/core';
import { NativeSeatMap } from '@event/seat-map/native';
import type { LayoutData, SeatState } from '@event/seat-map';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import {
  ActionFooter,
  Button,
  Card,
  Copy,
  ErrorNotice,
  Heading,
  Notice,
  QueryState,
  Screen,
  c,
  ui,
  Select,
  errorMessage,
} from '@/components/ui';
import { DetailRow } from '@/components/detail';
import { Badge, Disclosure, TextAction } from '@/components/customer-controls';
import {
  useAvailability,
  useLayout,
  useSeatPricing,
  useTicketTypes,
  useSessions,
} from '@/features/customer/catalog/hooks/use-catalog';
import { useBookingDraft } from '../draft-store';
import { useSelectionBooking } from '../hooks/use-selection-booking';
import { BuyerInfo } from '../components/buyer-info';
import { QuantityControl } from '../components/quantity-control';
import { BookingStatusCard } from '../components/booking-status-card';
import { usePaymentAvailability } from '@/features/customer/payment/hooks/use-payment-availability';
import { orderHistoryRoute } from '@/features/customer/tickets/order-presentation';
import { selectedSeatItems, selectionLimit, ticketTypeSaleState } from '../selection-rules';
import { selectionMapHeight } from '../seat-map-viewport';

const seatStatusLabels: Record<SeatState, string> = {
  AVAILABLE: 'Còn trống',
  LOCKED: 'Đang khóa tạm',
  SOLD: 'Đã bán',
  BLOCKED: 'Chặn bán',
  HELD: 'Được giữ bởi ban tổ chức',
};

export default function SelectionScreen() {
  const { height: screenHeight } = useWindowDimensions();
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
  // Ticket types open and close on their own schedule: re-check the sale windows every 30 seconds.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    useBookingDraft.getState().chooseSession(sessionId, eventId);
  }, [sessionId, eventId]);
  const zone = layout.data?.zones.find((z) => z.id === draft.zoneId);
  const listedTypes = (types.data ?? []).filter(
    (t) => t.kind !== 'COMP' && t.visibility === 'PUBLIC' && t.status === 'ACTIVE',
  );
  const activeTypes = listedTypes.filter((t) => ticketTypeSaleState(t, now) === 'ON_SALE');
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
  const seated = selectedSeatItems(draft.selected, seatsToType);
  const mixedSelection = zone?.type === 'standing' && draft.selected.length > 0;
  const items: BookingItemInput[] =
    zone?.type === 'standing'
      ? selectedType
        ? [{ ticketTypeId: selectedType.id, zoneId: zone.id, quantity: draft.quantity }]
        : []
      : zone?.type === 'seated'
        ? seated.items
        : [];
  const limit = selectionLimit(
    items,
    activeTypes,
    sessions.data?.find((s) => s.id === sessionId)?.maxTicketsPerAccount,
  );
  const allSeats = useMemo(() => layout.data?.zones.flatMap((z) => z.seats) ?? [], [layout.data]);
  const seatById = useMemo(() => new Map(allSeats.map((s) => [s.id, s])), [allSeats]);
  const total =
    zone?.type === 'standing'
      ? (selectedType?.priceAmount ?? 0) * draft.quantity
      : draft.selected.reduce(
          (sum, id) => sum + (activeTypes.find((t) => t.id === seatsToType.get(id))?.priceAmount ?? 0),
          0,
        );
  const priceReady =
    zone?.type === 'standing'
      ? !!selectedType
      : draft.selected.length > 0 &&
        draft.selected.every((id) => activeTypes.some((type) => type.id === seatsToType.get(id)));
  const isFree =
    items.length > 0 && items.every((i) => activeTypes.find((t) => t.id === i.ticketTypeId)?.kind === 'FREE');
  const paymentAvailable = usePaymentAvailability();
  const checkoutUnavailable = priceReady && items.length > 0 && !isFree && !paymentAvailable;
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
  const error = layout.error ?? availability.error ?? pricing.error ?? types.error ?? sessions.error;
  const layoutData: LayoutData = useMemo(
    () => ({
      version: layout.data?.version ?? 1,
      zones: layout.data?.zones.filter((z) => z.id === draft.zoneId) ?? [],
    }),
    [layout.data, draft.zoneId],
  );
  const mapHeight = useMemo(() => selectionMapHeight(layoutData, screenHeight), [layoutData, screenHeight]);
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
      checkoutUnavailable ||
      mixedSelection ||
      seated.missing.length > 0 ||
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
        <Button secondary onPress={() => router.push(orderHistoryRoute)}>
          Kiểm tra Đơn của tôi
        </Button>
      </Screen>
    );
  return (
    <Screen
      footer={
        <>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Copy style={[ui.semibold, { flex: 1 }]}>
              {draft.unresolved
                ? 'Đang kiểm tra đơn'
                : items.length
                  ? `Đã chọn ${items.reduce((sum, item) => sum + ('quantity' in item ? item.quantity : 1), 0)} chỗ`
                  : 'Chưa chọn vé'}
            </Copy>
            <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '60%', gap: 2 }}>
              <Copy style={[ui.muted, { fontSize: 12 }]}>Tạm tính</Copy>
              <Copy style={{ color: c.accent, fontFamily: 'Outfit-Bold', fontSize: 17, textAlign: 'right' }}>
                {items.length ? (priceReady ? formatMoney(total) : 'Cần cập nhật giá') : '—'}
              </Copy>
            </View>
          </View>
          <ActionFooter
            disabled={disabled}
            disabledReason={
              (mixedSelection ? 'Bỏ chọn các ghế đang chọn trước khi đặt vé khu đứng.' : null) ??
              (seated.missing.length
                ? 'Chưa tải được hạng vé của một số ghế. Bỏ chọn hoặc tải lại thông tin.'
                : null) ??
              limit ??
              (error
                ? 'Chưa thể tải đầy đủ thông tin chỗ. Vui lòng thử lại.'
                : !isReady
                  ? 'Đang tải thông tin chỗ.'
                  : !onSale
                    ? 'Suất diễn hiện không bán vé.'
                    : standingContractMissing
                      ? 'Chưa xác định được hạng vé cho khu này. Vui lòng chọn khu hoặc suất khác.'
                      : checkoutUnavailable
                        ? 'Thanh toán vé trả phí hiện chưa khả dụng.'
                        : !zone
                          ? 'Chọn khu vực để tiếp tục.'
                          : !items.length
                            ? 'Chọn ghế hoặc số lượng vé để tiếp tục.'
                            : changed
                              ? 'Một số ghế không còn trống. Vui lòng chọn lại.'
                              : maxQuantity < 1
                                ? 'Hạng vé này đã hết chỗ.'
                                : `Số lượng vé phải từ 1 đến ${maxQuantity}.`)
            }
            busy={booking.isPending}
            onPress={() => void booking.hold(items)}
          >
            {draft.unresolved ? 'Kiểm tra lại đơn' : isFree ? 'Đăng ký miễn phí' : 'Tiếp tục'}
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
              : zone
                ? 'Chọn ghế'
                : 'Chọn vé'}
      </Heading>
      <QueryState
        loading={!isReady && !error}
        error={error}
        retry={() => {
          void layout.refetch();
          void availability.refetch();
          void pricing.refetch();
          void types.refetch();
          if (eventId) void sessions.refetch();
        }}
        empty={!!isReady && !layout.data?.zones.length}
        emptyText="Chưa có sơ đồ hoặc khu vé."
      />
      {!!booking.error && !freeUnavailable && <ErrorNotice error={booking.error} />}
      {!paymentAvailable && activeTypes.some((type) => type.kind === 'PAID') && !checkoutUnavailable && (
        <Copy style={[ui.muted, { fontSize: 12 }]}>Thanh toán vé trả phí hiện chưa khả dụng.</Copy>
      )}
      {!!listedTypes.length && (
        <Disclosure title="Hạng vé và thời gian mở bán">
          {listedTypes.map((type) => {
            const state = ticketTypeSaleState(type, now);
            return (
              <View key={type.id} style={{ gap: 6, paddingVertical: 8 }}>
                <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                  <Copy style={ui.semibold}>{type.name}</Copy>
                  <Copy>{formatMoney(type.priceAmount)}</Copy>
                </View>
                <View style={{ alignSelf: 'flex-start' }}>
                  <Badge>
                    {state === 'ON_SALE'
                      ? 'Đang mở bán'
                      : state === 'NOT_STARTED'
                        ? 'Chưa mở bán'
                        : 'Đã đóng bán'}
                  </Badge>
                </View>
                {state === 'NOT_STARTED' && type.saleStartAt && (
                  <Copy style={ui.muted}>Mở bán {formatSessionTime(type.saleStartAt)}</Copy>
                )}
                {state === 'ENDED' && type.saleEndAt && (
                  <Copy style={ui.muted}>Đã đóng {formatSessionTime(type.saleEndAt)}</Copy>
                )}
              </View>
            );
          })}
        </Disclosure>
      )}
      {freeUnavailable && (
        <>
          <BookingStatusCard
            title="Chưa thể đăng ký"
            description={errorMessage(booking.error)}
            kind="warning"
          />
          <Button secondary onPress={() => router.push(orderHistoryRoute)}>
            Đơn của tôi
          </Button>
        </>
      )}
      {draft.unresolved && (
        <Notice warning>
          Chưa xác nhận được đơn. Giữ nguyên lựa chọn và thử lại cùng yêu cầu để tránh đặt trùng.
        </Notice>
      )}
      {draft.unresolved && (
        <Button secondary onPress={() => router.push(orderHistoryRoute)}>
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
          <Heading small>Khu vực</Heading>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
                    justifyContent: 'center',
                    padding: 12,
                    borderColor: zone?.id === z.id ? c.accent : c.border,
                    backgroundColor: zone?.id === z.id ? c.tint : 'white',
                  },
                ]}
              >
                <Copy numberOfLines={1}>{z.name}</Copy>
              </Pressable>
            ))}
          </ScrollView>
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
              <QuantityControl
                value={draft.quantity}
                max={maxQuantity}
                disabled={draft.unresolved || booking.isPending || standingContractMissing || !selectedType}
                onChange={(quantity) => draft.setStanding({ quantity })}
              />
              {selectedType && (
                <Copy style={ui.muted}>
                  {maxQuantity < 1 ? 'Hạng vé đã hết chỗ' : `Tối đa ${maxQuantity} vé mỗi đơn`}
                </Copy>
              )}
            </>
          ) : zone ? (
            <>
              <View
                style={{
                  alignSelf: 'center',
                  width: '70%',
                  borderRadius: 6,
                  backgroundColor: c.gray,
                  padding: 8,
                }}
              >
                <Copy style={{ textAlign: 'center', fontSize: 12 }}>SƠ ĐỒ GHẾ</Copy>
              </View>
              <NativeSeatMap
                key={zone.id}
                layout={layoutData}
                height={mapHeight}
                seatStates={seatStates}
                selectedSeatIds={new Set(draft.selected)}
                conflictSeatIds={new Set(draft.conflicts)}
                fontSource={require('../../../../../assets/fonts/BeVietnamPro-Medium.ttf')}
                mode={draft.unresolved ? 'view' : 'select'}
                onSeatPress={(id) => {
                  if (!draft.unresolved) draft.toggleSeat(id);
                }}
              />
              <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
                {['○ Còn trống', '✓ Đang chọn', '! Vừa được đặt', '× Không thể chọn'].map((label) => (
                  <Copy key={label} style={[ui.muted, { fontSize: 11 }]}>
                    {label}
                  </Copy>
                ))}
              </View>
              <Disclosure title="Chú thích ghế">
                <Copy style={ui.muted}>Xám: đã bán · Vàng: đang được giữ · Xanh nhạt: ban tổ chức giữ</Copy>
              </Disclosure>
              <TextAction expanded={accessible} onPress={() => setAccessible((p) => !p)}>
                {accessible ? 'Ẩn danh sách ghế' : 'Chọn ghế dạng danh sách'}
              </TextAction>
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
                  <TextAction
                    disabled={page === 0}
                    disabledReason="Đang ở trang đầu."
                    onPress={() => setPage((p) => p - 1)}
                  >
                    Trang trước
                  </TextAction>
                  <TextAction
                    disabled={(page + 1) * 20 >= zone.seats.length}
                    disabledReason="Đã đến trang cuối của danh sách ghế."
                    onPress={() => setPage((p) => p + 1)}
                  >
                    Trang sau
                  </TextAction>
                </>
              )}
            </>
          ) : null}
          {(draft.selected.length > 0 || (zone?.type === 'standing' && selectedType)) && (
            <Card>
              <Heading small>Vé đã chọn</Heading>
              {mixedSelection && (
                <Notice warning>
                  Bạn còn ghế đang chọn ở khu ngồi. Bỏ chọn các ghế này trước khi đặt vé khu đứng.
                </Notice>
              )}
              {draft.selected.map((id) => (
                <View key={id} style={[ui.row, { flexWrap: 'wrap' }]}>
                  <Copy style={{ flex: 1 }}>
                    {seatById.get(id)?.code ?? 'Ghế chưa tải được'} ·{' '}
                    {activeTypes.find((t) => t.id === seatsToType.get(id))?.name ?? 'Chưa có hạng vé'}
                  </Copy>
                  <TextAction
                    accessibilityLabel={`Bỏ chọn ghế ${seatById.get(id)?.code ?? 'đã chọn'}`}
                    disabled={draft.unresolved || booking.isPending}
                    disabledReason="Đang kiểm tra yêu cầu đặt vé, cần giữ nguyên lựa chọn."
                    onPress={() => draft.toggleSeat(id)}
                  >
                    Bỏ chọn
                  </TextAction>
                </View>
              ))}
              <DetailRow
                label="Số lượng"
                value={`${zone?.type === 'standing' ? draft.quantity : draft.selected.length} vé`}
              />
              {!mixedSelection && priceReady && (
                <DetailRow label="Tổng tham khảo" value={formatMoney(total)} />
              )}
            </Card>
          )}
          {isFree && items.length > 0 && <BuyerInfo />}
          {!draft.unresolved && draft.selected.length > 0 && (
            <TextAction onPress={() => draft.selected.forEach((id) => draft.toggleSeat(id))}>
              Bỏ chọn tất cả
            </TextAction>
          )}
        </>
      )}
    </Screen>
  );
}
