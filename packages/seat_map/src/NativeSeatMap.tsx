import { useMemo, useState } from 'react';
import { StyleSheet, View, Text as NativeText, Pressable } from 'react-native';
import { Canvas, RoundedRect, Text, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SeatGridIndex } from './spatial-index';
import { displaySeatState, layoutBounds, visibleSeats, type DisplaySeatState } from './render-plan';
import type { SeatMapProps } from './types';
import { seatGeometry } from './seat-geometry';

export interface NativeSeatMapProps extends SeatMapProps {
  conflictSeatIds?: ReadonlySet<string>;
  fontSource: number;
  height?: number;
}
const colors: Record<DisplaySeatState, string> = {
  AVAILABLE: '#FFFFFF',
  SELECTED: '#D9422D',
  CONFLICT: '#B93824',
  SOLD: '#D5D9DA',
  LOCKED: '#FFF3D9',
  BLOCKED: '#20272B',
  HELD: '#EBF0FA',
};
export function NativeSeatMap({
  layout,
  seatStates,
  selectedSeatIds,
  conflictSeatIds,
  onSeatPress,
  mode = 'select',
  fontSource,
  height = 440,
}: NativeSeatMapProps) {
  const [width, setWidth] = useState(350);
  const geometry = useMemo(() => seatGeometry(layout), [layout]);
  const [camera, setCamera] = useState(() => {
    const initialBounds = layoutBounds(layout);
    return {
      x: initialBounds.minX - 57 / geometry.initialZoom,
      y: initialBounds.minY - 24 / geometry.initialZoom,
      zoom: geometry.initialZoom,
    };
  });
  const index = useMemo(() => new SeatGridIndex(layout), [layout]);
  const bounds = useMemo(() => layoutBounds(layout), [layout]);
  const font = useFont(fontSource, 12);
  const visible = useMemo(
    () =>
      visibleSeats(index, {
        x: camera.x,
        y: camera.y,
        width: width / camera.zoom,
        height: height / camera.zoom,
      }),
    [index, camera, width, height],
  );
  const panTo = (dx: number, dy: number) =>
    setCamera((previous) => ({
      ...previous,
      x: Math.max(
        bounds.minX - 57 / geometry.initialZoom,
        Math.min(bounds.maxX, previous.x - dx / previous.zoom),
      ),
      y: Math.max(
        bounds.minY - 24 / geometry.initialZoom,
        Math.min(bounds.maxY, previous.y - dy / previous.zoom),
      ),
    }));
  const zoomTo = (factor: number) =>
    setCamera((previous) => ({
      ...previous,
      zoom: Math.max(geometry.initialZoom, Math.min(geometry.initialZoom * 3, previous.zoom * factor)),
    }));
  const tapAt = (x: number, y: number) => {
    const seat = index.hitTest(x / camera.zoom + camera.x, y / camera.zoom + camera.y, geometry.diameter / 2);
    if (seat && mode === 'select' && (seatStates[seat.id] ?? 'AVAILABLE') === 'AVAILABLE')
      onSeatPress?.(seat.id);
  };
  const pan = Gesture.Pan()
    .minDistance(5)
    .onChange((event) => runOnJS(panTo)(event.changeX, event.changeY));
  const pinch = Gesture.Pinch().onEnd((event) => runOnJS(zoomTo)(event.scale));
  const tap = Gesture.Tap().onEnd((event) => runOnJS(tapAt)(event.x, event.y));
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={Gesture.Race(tap, Gesture.Simultaneous(pan, pinch))}>
        <Canvas style={StyleSheet.absoluteFill}>
          {visible.map((seat) => {
            const state = displaySeatState(seat.id, seatStates, selectedSeatIds, conflictSeatIds);
            const x = (seat.x - camera.x) * camera.zoom,
              y = (seat.y - camera.y) * camera.zoom;
            const size = geometry.diameter * camera.zoom;
            return (
              <RoundedRect
                key={seat.id}
                x={x - size / 2}
                y={y - size / 2}
                width={size}
                height={size}
                r={6}
                color={colors[state]}
              />
            );
          })}
          {font &&
            visible.map((seat) => {
              const state = displaySeatState(seat.id, seatStates, selectedSeatIds, conflictSeatIds);
              const label = `${seat.number}${state === 'CONFLICT' ? '!' : state === 'SELECTED' ? '✓' : state === 'BLOCKED' ? '×' : ''}`;
              return (
                <Text
                  key={seat.id}
                  x={(seat.x - camera.x) * camera.zoom - 10}
                  y={(seat.y - camera.y) * camera.zoom + 5}
                  text={label}
                  font={font}
                  color={['SELECTED', 'CONFLICT', 'BLOCKED'].includes(state) ? 'white' : '#20272B'}
                />
              );
            })}
          {font &&
            [...new Map(visible.map((seat) => [seat.row, seat])).values()].map((seat) => (
              <Text
                key={`row-${seat.row}`}
                x={0}
                y={(seat.y - camera.y) * camera.zoom + 5}
                text={seat.row}
                font={font}
                color="#20272B"
              />
            ))}
        </Canvas>
      </GestureDetector>
      <View style={{ position: 'absolute', right: 0, top: 0, flexDirection: 'row', gap: 4 }}>
        <Pressable
          accessibilityLabel="Thu nhỏ sơ đồ"
          accessibilityRole="button"
          onPress={() => zoomTo(0.8)}
          style={styles.control}
        >
          <NativeText>−</NativeText>
        </Pressable>
        <Pressable
          accessibilityLabel="Phóng to sơ đồ"
          accessibilityRole="button"
          onPress={() => zoomTo(1.25)}
          style={styles.control}
        >
          <NativeText>+</NativeText>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  control: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFF0EC',
  },
});
