import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Button, Copy, Heading, Icon, c, ui } from './ui';

export function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
      <Copy style={[ui.muted, { flex: 1 }]}>{label}</Copy>
      <Copy style={[ui.semibold, { flex: 1.5, textAlign: 'right' }]}>{value || 'Chưa có thông tin'}</Copy>
    </View>
  );
}
export function Unavailable({ children }: PropsWithChildren) {
  return <Copy style={ui.muted}>{children ?? 'Chức năng chưa khả dụng.'}</Copy>;
}
export function ResultPanel({
  title,
  description,
  kind = 'waiting',
  badge,
}: {
  title: string;
  description: string;
  kind?: 'waiting' | 'success' | 'warning' | 'expired';
  badge?: string;
}) {
  return (
    <View style={{ gap: 16, paddingVertical: 8 }}>
      <Heading>{title}</Heading>
      <Copy style={ui.muted}>{description}</Copy>
      <View
        style={{
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: kind === 'success' ? '#E8F5EF' : kind === 'waiting' ? '#FFF2CF' : '#FBEAED',
          marginVertical: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
          }}
        >
          <Icon name={kind === 'expired' ? 'expired' : kind === 'waiting' ? 'clock' : 'shield'} />
        </View>
      </View>
      <View
        style={{
          alignSelf: 'center',
          width: 182,
          borderRadius: 6,
          padding: 8,
          backgroundColor: kind === 'success' ? '#E8F5EF' : kind === 'waiting' ? '#FFF2CF' : '#FBEAED',
        }}
      >
        <Copy
          style={{
            color: kind === 'success' ? '#237857' : kind === 'waiting' ? '#765800' : c.primary,
            fontSize: 12,
          }}
        >
          {badge ??
            (kind === 'waiting'
              ? 'Đang xác nhận'
              : kind === 'success'
                ? 'Đã xác nhận'
                : kind === 'expired'
                  ? 'Hết hạn'
                  : 'Cần kiểm tra')}
        </Copy>
      </View>
    </View>
  );
}
export function UnavailableAction({ label, reason }: { label: string; reason: string }) {
  return (
    <Button disabled disabledReason={reason} onPress={() => {}}>
      {label}
    </Button>
  );
}
