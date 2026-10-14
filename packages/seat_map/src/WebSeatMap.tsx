import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { NativeSeatMapProps } from './NativeSeatMap';
import { SeatGridIndex } from './spatial-index';
import { displaySeatState, layoutBounds, visibleSeats } from './render-plan';
import { seatGeometry } from './seat-geometry';

/** Web inspection renderer shares the props/index; native uses Skia. */
export function NativeSeatMap({
  layout,
  seatStates,
  selectedSeatIds,
  conflictSeatIds,
  onSeatPress,
  mode = 'select',
  height = 440,
}: NativeSeatMapProps) {
  const [width, setWidth] = useState(350);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const geometry = useMemo(() => seatGeometry(layout), [layout]);
  const [zoom, setZoom] = useState(() => geometry.initialZoom);
  const index = useMemo(() => new SeatGridIndex(layout), [layout]);
  const bounds = useMemo(() => layoutBounds(layout), [layout]);
  const left = 57 / geometry.initialZoom,
    top = 24 / geometry.initialZoom,
    size = geometry.diameter * zoom;
  const seats = visibleSeats(index, {
    x: offset.x / zoom - left + bounds.minX,
    y: offset.y / zoom - top + bounds.minY,
    width: width / zoom,
    height: height / zoom,
  });
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        style={{ height }}
        onScroll={(e) => setOffset((p) => ({ ...p, x: e.nativeEvent.contentOffset.x }))}
        scrollEventThrottle={16}
      >
        <ScrollView
          style={{ width: (bounds.maxX - bounds.minX + left * 2) * zoom, height }}
          onScroll={(e) => setOffset((p) => ({ ...p, y: e.nativeEvent.contentOffset.y }))}
          scrollEventThrottle={16}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sơ đồ ghế"
            onPress={(event) => {
              const seat = index.hitTest(
                event.nativeEvent.locationX / zoom - left + bounds.minX,
                event.nativeEvent.locationY / zoom - top + bounds.minY,
                geometry.diameter / 2,
              );
              if (seat && mode === 'select' && (seatStates[seat.id] ?? 'AVAILABLE') === 'AVAILABLE')
                onSeatPress?.(seat.id);
            }}
          >
            <Svg
              style={{ pointerEvents: 'none' }}
              width={(bounds.maxX - bounds.minX + left * 2) * zoom}
              height={(bounds.maxY - bounds.minY + top * 2) * zoom}
            >
              {seats.map((seat) => {
                const state = displaySeatState(seat.id, seatStates, selectedSeatIds, conflictSeatIds);
                const colors = {
                  AVAILABLE: 'white',
                  SELECTED: '#D9422D',
                  CONFLICT: '#B93824',
                  SOLD: '#D5D9DA',
                  LOCKED: '#FFF3D9',
                  HELD: '#EBF0FA',
                  BLOCKED: '#20272B',
                };
                const x = (seat.x + left - bounds.minX) * zoom,
                  y = (seat.y + top - bounds.minY) * zoom;
                return (
                  <Rect
                    key={seat.id}
                    x={x - size / 2}
                    y={y - size / 2}
                    width={size}
                    height={size}
                    rx={6}
                    fill={colors[state]}
                    stroke="#E7E4DF"
                  />
                );
              })}
              {seats.map((seat) => (
                <SvgText
                  key={seat.id}
                  x={(seat.x + left - bounds.minX) * zoom}
                  y={(seat.y + top - bounds.minY) * zoom + 5}
                  fill={selectedSeatIds?.has(seat.id) ? 'white' : '#20272B'}
                  fontSize={12}
                  textAnchor="middle"
                >
                  {seat.number}
                  {conflictSeatIds?.has(seat.id) ? '!' : selectedSeatIds?.has(seat.id) ? '✓' : ''}
                </SvgText>
              ))}
              {[...new Map(seats.map((seat) => [seat.row, seat])).values()].map((seat) => (
                <SvgText
                  key={`row-${seat.row}`}
                  x={0}
                  y={(seat.y + top - bounds.minY) * zoom + 5}
                  fill="#20272B"
                  fontSize={12}
                >
                  {seat.row}
                </SvgText>
              ))}
            </Svg>
          </Pressable>
        </ScrollView>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[0.8, 1.25].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityLabel={f < 1 ? 'Thu nhỏ sơ đồ' : 'Phóng to sơ đồ'}
            onPress={() =>
              setZoom((p) => Math.max(geometry.initialZoom, Math.min(geometry.initialZoom * 3, p * f)))
            }
            style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text>{f < 1 ? '−' : '+'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export type { NativeSeatMapProps } from './NativeSeatMap';
