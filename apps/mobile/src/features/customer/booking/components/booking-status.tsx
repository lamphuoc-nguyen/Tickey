import type { BookingStatus } from '@event/core';
import { View } from 'react-native';
import { Copy, c, ui } from '@/components/ui';
import { bookingLabels } from '../booking-presentation';

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const complete = status === 'CONFIRMED';
  const inactive = ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status);
  const refund = ['REFUND_PENDING', 'PARTIALLY_REFUNDED'].includes(status);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: complete ? '#E8F5EF' : inactive ? c.tint : refund ? c.blueTint : c.amberTint,
      }}
    >
      <Copy
        style={[
          ui.semibold,
          { fontSize: 11, color: complete ? '#237857' : inactive ? c.muted : refund ? c.blue : c.amber },
        ]}
      >
        {bookingLabels[status]}
      </Copy>
    </View>
  );
}
