import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Copy, c, fonts, ui } from './ui';
import { backspaceOtp, editOtp, MAX_OTP_LENGTH, otpCellCount } from './otp-input-state';

export function OtpInput({
  label,
  value,
  onChangeText,
  error,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  editable?: boolean;
}) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [width, setWidth] = useState(280);
  const [expandedLength, setExpandedLength] = useState(() => otpCellCount(value));
  // Keep the last cell mounted when deleting from an eight/ten-digit code.
  const count = Math.max(expandedLength, otpCellCount(value));
  const columns = count > 6 ? Math.ceil(count / 2) : count;
  const cellWidth = Math.max(1, Math.min(48, (width - (columns - 1) * 8) / columns));
  const apply = (next: { value: string; focus: number }, replace = false) => {
    if (!editable) return;
    setExpandedLength((previous) =>
      replace ? otpCellCount(next.value) : Math.max(previous, otpCellCount(next.value)),
    );
    onChangeText(next.value);
    // Pasting a longer code can mount additional cells before focus moves.
    requestAnimationFrame(() => inputs.current[next.focus]?.focus());
  };
  return (
    <View style={{ gap: 8 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Copy style={ui.label}>{label}</Copy>
      {Array.from({ length: Math.ceil(count / columns) }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: Math.min(columns, count - row * columns) }, (_, column) => {
            const index = row * columns + column;
            return (
              <TextInput
                key={index}
                ref={(input) => {
                  inputs.current[index] = input;
                }}
                accessibilityLabel={`${label}, chữ số ${index + 1} trên ${count}`}
                accessibilityHint={error}
                accessibilityState={{ disabled: !editable }}
                value={value[index]?.trim() ?? ''}
                editable={editable}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={MAX_OTP_LENGTH}
                selectTextOnFocus
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((current) => (current === index ? null : current))}
                onChangeText={(text) =>
                  apply(editOtp(value, index, text), text.replace(/\D/g, '').length >= 6)
                }
                onKeyPress={(event) => {
                  if (event.nativeEvent.key === 'Backspace' && !value[index]?.trim())
                    apply(backspaceOtp(value, index));
                }}
                style={{
                  width: cellWidth,
                  height: 56,
                  borderRadius: 10,
                  borderWidth: focused === index ? 2 : 1,
                  borderColor: error || focused === index ? c.primary : c.border,
                  backgroundColor: focused === index ? c.tint : c.surface,
                  color: c.text,
                  fontFamily: fonts.medium,
                  fontSize: 22,
                  textAlign: 'center',
                  padding: 0,
                  opacity: editable ? 1 : 0.5,
                }}
              />
            );
          })}
        </View>
      ))}
      {!!error && (
        <Copy accessibilityRole="alert" style={{ color: c.primary }}>
          {error}
        </Copy>
      )}
    </View>
  );
}
