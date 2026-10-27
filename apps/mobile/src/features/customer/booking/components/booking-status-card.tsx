import { View } from 'react-native';
import { Copy, Icon, c, ui } from '@/components/ui';

/** One compact server-state message; keep order information visible below it. */
export function BookingStatusCard({
  title,
  description,
  kind = 'waiting',
}: {
  title: string;
  description: string;
  kind?: 'waiting' | 'warning' | 'expired';
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        ui.row,
        {
          alignItems: 'flex-start',
          padding: 16,
          borderRadius: 16,
          backgroundColor: kind === 'waiting' ? c.amberTint : c.tint,
        },
      ]}
    >
      <View accessible={false}>
        <Icon name={kind === 'expired' ? 'expired' : kind === 'waiting' ? 'clock' : 'shield'} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Copy style={ui.semibold}>{title}</Copy>
        <Copy style={[ui.muted, { fontSize: 12, lineHeight: 19 }]}>{description}</Copy>
      </View>
    </View>
  );
}
