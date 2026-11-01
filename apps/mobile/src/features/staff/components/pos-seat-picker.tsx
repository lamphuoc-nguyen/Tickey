import { NativeSeatMap } from '@event/seat-map/native';
import type { SessionLayout } from '@event/core';
import type { LayoutData, SeatState } from '@event/seat-map';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Copy, c, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { selectionMapHeight } from '@/features/customer/booking/seat-map-viewport';

const PAGE_SIZE = 20;

export function PosSeatPicker({
  version,
  zone,
  seatStates,
  selected,
  disabled,
  onToggle,
}: {
  version: number;
  zone: Extract<SessionLayout['zones'][number], { type: 'seated' }>;
  seatStates: Record<string, SeatState>;
  selected: readonly string[];
  disabled: boolean;
  onToggle: (seatId: string) => void;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const [listed, setListed] = useState(false);
  const [page, setPage] = useState(0);
  const layout: LayoutData = useMemo(() => ({ version, zones: [zone] }), [version, zone]);
  const mapHeight = useMemo(() => selectionMapHeight(layout, screenHeight), [layout, screenHeight]);
  const seats = useMemo(
    () => [...zone.seats].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [zone],
  );
  return (
    <View style={styles.stack}>
      <NativeSeatMap
        key={zone.id}
        layout={layout}
        height={mapHeight}
        seatStates={seatStates}
        selectedSeatIds={new Set(selected)}
        conflictSeatIds={new Set<string>()}
        fontSource={require('../../../../assets/fonts/BeVietnamPro-Medium.ttf')}
        mode={disabled ? 'view' : 'select'}
        onSeatPress={onToggle}
      />
      <Copy style={styles.legend}>Chỉ chọn được ghế còn trống thuộc hạng vé đang chọn.</Copy>
      <TextAction expanded={listed} onPress={() => setListed((value) => !value)}>
        {listed ? 'Ẩn danh sách ghế' : 'Chọn ghế dạng danh sách'}
      </TextAction>
      {listed && (
        <>
          <View style={styles.list}>
            {seats.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((seat) => {
              const checked = selected.includes(seat.id);
              const unavailable = (seatStates[seat.id] ?? 'AVAILABLE') !== 'AVAILABLE';
              return (
                <Pressable
                  key={seat.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Ghế ${seat.code}`}
                  accessibilityState={{ checked, disabled: disabled || (unavailable && !checked) }}
                  disabled={disabled || (unavailable && !checked)}
                  onPress={() => onToggle(seat.id)}
                  style={[
                    ui.card,
                    styles.seat,
                    checked && styles.seatChecked,
                    unavailable && !checked && styles.seatUnavailable,
                  ]}
                >
                  <Copy>{seat.code}</Copy>
                </Pressable>
              );
            })}
          </View>
          <TextAction
            disabled={page === 0}
            disabledReason="Đang ở trang đầu."
            onPress={() => setPage((value) => value - 1)}
          >
            Trang trước
          </TextAction>
          <TextAction
            disabled={(page + 1) * PAGE_SIZE >= seats.length}
            disabledReason="Đã đến trang cuối của danh sách ghế."
            onPress={() => setPage((value) => value + 1)}
          >
            Trang sau
          </TextAction>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  legend: { color: c.muted, fontSize: 11 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seat: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  seatChecked: { backgroundColor: c.tint, borderColor: c.primary },
  seatUnavailable: { opacity: 0.4 },
});
