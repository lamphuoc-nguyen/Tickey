import type { SeatState } from '@event/seat-map';
import {
  ApiError,
  SeatConflictError,
  formatMoney,
  type Booking,
  type CreateBookingParams,
} from '@event/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Copy, ErrorNotice, Notice, QueryState, c, fonts } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { bookingIntent, keepNonConflictingSelections } from '@/features/customer/booking/booking-intent';
import { bookingLabels } from '@/features/customer/booking/booking-presentation';
import { useAvailability, useLayout, useSeatPricing } from '@/features/customer/catalog/hooks/use-catalog';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { repositories } from '@/lib/repositories';
import { sessionScope } from '@/lib/session-scope';
import { PosCheckout } from '../components/pos-checkout';
import { PosSeatPicker } from '../components/pos-seat-picker';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';
import {
  canSellSeat,
  orderLimit,
  posItems,
  seatTypeMap,
  sellableTicketTypes,
  typeRemaining,
  zonesForType,
} from '../lib/pos-sale';
import { getStaffPosBookings, getStaffTicketTypes } from '../lib/staff-api';

const POS_SESSION_STATES = ['ON_SALE', 'SALES_CLOSED', 'ONGOING'];

export default function StaffPosScreen() {
  const { selected, query } = useSelectedStaffShift();
  if (query.isPending || query.isError || !selected)
    return (
      <StaffFrame title="Bán vé tại quầy" active="pos">
        <QueryState
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
          empty={!query.isPending && !query.isError}
          emptyText="Chưa có session được phân công."
        />
      </StaffFrame>
    );
  return (
    <StaffFrame
      title="Bán vé tại quầy"
      subtitle={`${selected.session?.title ?? 'Session'} · POS`}
      active="pos"
    >
      <PosSale
        key={selected.sessionId}
        sessionId={selected.sessionId}
        canSell={selected.permissions.includes('POS')}
      />
    </StaffFrame>
  );
}

function PosSale({ sessionId, canSell }: { sessionId: string; canSell: boolean }) {
  const { session } = useAuth();
  const cache = useQueryClient();
  const [bookingId, setBookingId] = useState<string>();
  const recentKey = useMemo(
    () => ['staff-pos-bookings', ...sessionScope(session), sessionId],
    [session, sessionId],
  );
  const recent = useQuery({
    queryKey: recentKey,
    queryFn: ({ signal }) => getStaffPosBookings(sessionId, signal),
  });
  const refreshSale = useCallback(() => {
    void cache.invalidateQueries({ queryKey: recentKey });
    void cache.invalidateQueries({ queryKey: ['staff-ticket-types', sessionId] });
    void cache.invalidateQueries({ queryKey: ['catalog', 'availability', sessionId] });
  }, [cache, recentKey, sessionId]);

  if (bookingId)
    return (
      <PosCheckout bookingId={bookingId} onChanged={refreshSale} onClose={() => setBookingId(undefined)} />
    );
  return (
    <>
      <StaffStatus tone={canSell ? 'success' : 'danger'}>
        {canSell ? 'Được phép bán vé tại quầy' : 'Phân công này không có quyền bán vé'}
      </StaffStatus>
      <PosSelection
        sessionId={sessionId}
        canSell={canSell}
        onBooked={(booking) => {
          refreshSale();
          setBookingId(booking.id);
        }}
      />
      {!!recent.data?.length && (
        <View style={styles.stack}>
          <StaffSectionTitle>Đơn đã bán gần đây</StaffSectionTitle>
          {recent.data.slice(0, 5).map((row) => (
            <Pressable key={row.id} accessibilityRole="button" onPress={() => setBookingId(row.id)}>
              <StaffCard>
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{row.code}</Text>
                    <Text style={styles.detail}>{bookingLabels[row.status]}</Text>
                  </View>
                  <Text style={styles.name}>{formatMoney(row.total_amount)}</Text>
                </View>
              </StaffCard>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

function PosSelection({
  sessionId,
  canSell,
  onBooked,
}: {
  sessionId: string;
  canSell: boolean;
  onBooked: (booking: Booking) => void;
}) {
  const cache = useQueryClient();
  const ticketTypes = useQuery({
    queryKey: ['staff-ticket-types', sessionId],
    queryFn: () => getStaffTicketTypes(sessionId),
  });
  const layout = useLayout(sessionId);
  const availability = useAvailability(sessionId);
  const pricing = useSeatPricing(sessionId);
  const [typeId, setTypeId] = useState<string>();
  const [zoneId, setZoneId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [seatIds, setSeatIds] = useState<string[]>([]);
  // A retry after a lost response must reuse its key and payload, or the buyer ends up with two holds.
  const intent = useRef<CreateBookingParams | null>(null);
  const [unresolved, setUnresolved] = useState(false);
  const create = useExclusiveMutation<Booking, CreateBookingParams>(`pos-booking:${sessionId}`, {
    mutationFn: (params) =>
      repositories.booking.createBooking({ ...params, options: { booking_type: 'POS' } }),
  });

  const types = useMemo(() => sellableTicketTypes(ticketTypes.data ?? []), [ticketTypes.data]);
  const seatTypes = useMemo(() => seatTypeMap(pricing.data ?? {}), [pricing.data]);
  const chosen = types.find((type) => type.id === typeId) ?? types[0];
  const zones = useMemo(
    () => (chosen && layout.data ? zonesForType(chosen, layout.data.zones, seatTypes) : []),
    [chosen, layout.data, seatTypes],
  );
  const zone = zones.find((candidate) => candidate.id === zoneId) ?? zones[0];
  const zoneRemaining =
    zone?.type === 'standing'
      ? availability.data?.zones.find((row) => row.zoneId === zone.id)?.remaining
      : undefined;
  const limit = chosen ? orderLimit(chosen, zoneRemaining) : 0;
  const count = zone?.type === 'standing' ? Math.min(quantity, Math.max(limit, 1)) : seatIds.length;
  const items = chosen && zone ? posItems({ ticketTypeId: chosen.id, zone, quantity: count, seatIds }) : [];
  const total = (chosen?.price_amount ?? 0) * count;

  const seatStates = useMemo(() => {
    const states: Record<string, SeatState> = {};
    if (zone?.type === 'seated' && chosen)
      for (const seat of zone.seats)
        if (!canSellSeat(chosen, zone.id, seat.id, seatTypes)) states[seat.id] = 'BLOCKED';
    return { ...states, ...availability.data?.unavailableSeats };
  }, [zone, chosen, seatTypes, availability.data]);
  const seatsChanged = seatIds.some((id) => (seatStates[id] ?? 'AVAILABLE') !== 'AVAILABLE');

  const onSale =
    !!availability.data &&
    !availability.data.salesPaused &&
    POS_SESSION_STATES.includes(availability.data.sessionStatus);
  const blockedReason = !canSell
    ? 'Phân công này không có quyền bán vé.'
    : !onSale
      ? 'Suất diễn hiện không bán tại quầy.'
      : !chosen
        ? 'Chọn hạng vé để tiếp tục.'
        : !zone
          ? 'Hạng vé này chưa được gán ghế hoặc khu vực.'
          : limit < 1
            ? 'Hạng vé hoặc khu vực này đã hết chỗ.'
            : zone.type === 'seated' && !seatIds.length
              ? 'Chọn ít nhất một ghế.'
              : seatsChanged
                ? 'Có ghế vừa được người khác đặt. Bỏ chọn ghế đó để tiếp tục.'
                : undefined;

  const chooseType = (id: string) => {
    setTypeId(id);
    setZoneId(undefined);
    setQuantity(1);
    setSeatIds([]);
  };
  const chooseZone = (id: string) => {
    setZoneId(id);
    setQuantity(1);
    setSeatIds([]);
  };
  const toggleSeat = (id: string) => {
    if (seatIds.includes(id)) setSeatIds(seatIds.filter((seatId) => seatId !== id));
    else if ((seatStates[id] ?? 'AVAILABLE') === 'AVAILABLE' && seatIds.length < limit)
      setSeatIds([...seatIds, id]);
  };
  const hold = async () => {
    const params = bookingIntent(intent.current, sessionId, items, randomUUID, unresolved);
    intent.current = params;
    setUnresolved(true);
    try {
      onBooked(await create.mutateAsync(params));
    } catch (error) {
      if (error instanceof SeatConflictError) {
        setSeatIds((current) => keepNonConflictingSelections(current, error.seatIds));
        setUnresolved(false);
        void cache.invalidateQueries({ queryKey: ['catalog', 'availability', sessionId] });
      } else if (error instanceof ApiError && error.code !== 'NETWORK' && error.code !== 'UNKNOWN')
        setUnresolved(false);
      // NETWORK/UNKNOWN may mean the hold committed: only replay this intent or check the recent sales.
    }
  };

  const error = ticketTypes.error ?? layout.error ?? availability.error ?? pricing.error;
  if (!ticketTypes.data || !layout.data || !availability.data || !pricing.data)
    return (
      <QueryState
        loading={!error}
        error={error}
        retry={() => {
          void ticketTypes.refetch();
          void layout.refetch();
          void availability.refetch();
          void pricing.refetch();
        }}
      />
    );
  if (!types.length) return <QueryState empty emptyText="Suất diễn chưa có hạng vé bán tại quầy." />;

  return (
    <>
      <View style={styles.stack}>
        <StaffSectionTitle>Hạng vé</StaffSectionTitle>
        {types.map((type) => {
          const active = type.id === chosen?.id;
          const remaining = typeRemaining(type);
          return (
            <Pressable
              key={type.id}
              disabled={unresolved}
              onPress={() => chooseType(type.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: unresolved }}
            >
              <StaffCard style={active ? styles.selected : undefined}>
                <View style={styles.row}>
                  <View style={styles.ticketText}>
                    <Text style={styles.name}>{type.name}</Text>
                    <Text style={styles.detail}>{type.description ?? type.kind}</Text>
                    <Text style={styles.price}>{formatMoney(type.price_amount)}</Text>
                    <Text style={styles.detail}>
                      {remaining === undefined ? 'Chưa rõ số vé còn lại' : `Còn ${remaining} vé`}
                    </Text>
                  </View>
                  <Text style={active ? styles.check : styles.circle}>{active ? '✓' : '○'}</Text>
                </View>
              </StaffCard>
            </Pressable>
          );
        })}
      </View>

      {zones.length > 1 && (
        <View style={styles.stack}>
          <StaffSectionTitle>Khu vực</StaffSectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zones}>
            {zones.map((candidate) => (
              <Pressable
                key={candidate.id}
                disabled={unresolved}
                accessibilityRole="radio"
                accessibilityState={{ checked: candidate.id === zone?.id, disabled: unresolved }}
                onPress={() => chooseZone(candidate.id)}
              >
                <StaffCard style={candidate.id === zone?.id ? styles.selected : undefined}>
                  <Text style={styles.name}>{candidate.name}</Text>
                </StaffCard>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {zone?.type === 'seated' && (
        <PosSeatPicker
          version={layout.data.version}
          zone={zone}
          seatStates={seatStates}
          selected={seatIds}
          disabled={unresolved}
          onToggle={toggleSeat}
        />
      )}

      {chosen && zone && (
        <StaffCard>
          {zone.type === 'standing' ? (
            <View style={styles.row}>
              <Text style={[styles.name, styles.grow]}>Số lượng</Text>
              <View style={styles.quantityBox}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Giảm số lượng"
                  disabled={unresolved}
                  onPress={() => setQuantity(Math.max(1, count - 1))}
                  style={styles.quantityButton}
                >
                  <Text style={styles.quantityText}>−</Text>
                </Pressable>
                <Text style={styles.quantity}>{count}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tăng số lượng"
                  disabled={unresolved}
                  onPress={() => setQuantity(Math.min(Math.max(limit, 1), count + 1))}
                  style={styles.quantityButton}
                >
                  <Text style={styles.quantityText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.seatList}>
              {seatIds.length ? (
                seatIds.map((id) => (
                  <Pressable
                    key={id}
                    disabled={unresolved}
                    accessibilityRole="button"
                    onPress={() => toggleSeat(id)}
                  >
                    <Text style={styles.seatChip}>
                      {zone.seats.find((seat) => seat.id === id)?.code ?? 'Ghế đã chọn'} ×
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.detail}>Chưa chọn ghế</Text>
              )}
            </View>
          )}
          {limit > 0 && <Text style={styles.detail}>Tối đa {limit} vé mỗi đơn</Text>}
          <View style={styles.row}>
            <Text style={[styles.detail, styles.grow]}>Tổng dự kiến</Text>
            <Text style={styles.total}>{count > 0 ? formatMoney(total) : '—'}</Text>
          </View>
        </StaffCard>
      )}

      {unresolved && !create.isPending && (
        <Notice warning>
          Chưa xác nhận được đơn. Thử lại sẽ không tạo đơn trùng; hãy xem cả danh sách đơn gần đây bên dưới.
        </Notice>
      )}
      {!!create.error && <ErrorNotice error={create.error} />}
      <Button
        busy={create.isPending}
        disabled={!!blockedReason}
        disabledReason={blockedReason}
        onPress={() => void hold()}
      >
        {unresolved ? 'Thử lại' : chosen?.price_amount === 0 ? 'Phát vé miễn phí' : 'Giữ chỗ và thu tiền'}
      </Button>
      <Copy style={styles.note}>Giá và số chỗ do hệ thống quyết định khi giữ chỗ.</Copy>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  ticketText: { flex: 1, gap: 3 },
  selected: { borderColor: c.primary, borderWidth: 1.5, backgroundColor: c.tint },
  name: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  detail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  price: { color: c.primary, fontFamily: fonts.semibold, fontSize: 13, marginTop: 3 },
  check: { color: c.primary, fontFamily: fonts.heading, fontSize: 26 },
  circle: { color: c.muted, fontFamily: fonts.heading, fontSize: 26 },
  zones: { gap: 8 },
  quantityBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { color: c.primary, fontFamily: fonts.heading, fontSize: 20 },
  quantity: { color: c.text, fontFamily: fonts.semibold, fontSize: 14, minWidth: 18, textAlign: 'center' },
  seatList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seatChip: {
    color: c.primary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    backgroundColor: c.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  total: { color: c.primary, fontFamily: fonts.heading, fontSize: 20 },
  note: { color: c.muted, fontSize: 11, lineHeight: 17 },
});
