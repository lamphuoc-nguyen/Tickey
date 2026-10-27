import { Pressable, View } from 'react-native';
import { Copy, c, ui } from '@/components/ui';

export function QuantityControl({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Copy style={ui.label}>Số lượng vé</Copy>
      <View style={[ui.row, { justifyContent: 'space-between', maxWidth: 280 }]}>
        {([-1, 0, 1] as const).map((step) =>
          step === 0 ? (
            <Copy
              key={step}
              accessibilityLabel={`Đã chọn ${value} vé`}
              style={[ui.semibold, { fontSize: 22 }]}
            >
              {value}
            </Copy>
          ) : (
            <Pressable
              key={step}
              accessibilityRole="button"
              accessibilityLabel={step < 0 ? 'Giảm số lượng vé' : 'Tăng số lượng vé'}
              accessibilityState={{ disabled: disabled || (step < 0 ? value <= 1 : value >= max) }}
              disabled={disabled || (step < 0 ? value <= 1 : value >= max)}
              onPress={() => onChange(value + step)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: c.surface,
                opacity: disabled || (step < 0 ? value <= 1 : value >= max) ? 0.4 : 1,
              }}
            >
              <Copy style={{ fontSize: 24 }}>{step < 0 ? '−' : '+'}</Copy>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}
