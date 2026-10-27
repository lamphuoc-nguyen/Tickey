import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { Copy, c, fonts, ui } from './ui';
import { backspaceOtp, editOtp, OTP_LENGTH } from './otp-input-state';

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
  const count = OTP_LENGTH;
  const columns = count;
  const cellGap = 6;
  const cellWidth = Math.max(1, Math.min(48, (width - (columns - 1) * cellGap) / columns));
  const apply = (next: { value: string; focus: number }) => {
    if (!editable) return;
    onChangeText(next.value);
    requestAnimationFrame(() => inputs.current[next.focus]?.focus());
  };
  return (
    <View style={{ gap: 8 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Copy style={ui.label}>{label}</Copy>
      {Array.from({ length: Math.ceil(count / columns) }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', justifyContent: 'center', gap: cellGap }}>
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
                returnKeyType={index === count - 1 ? 'done' : 'next'}
                submitBehavior="submit"
                onSubmitEditing={() =>
                  index === count - 1 ? Keyboard.dismiss() : inputs.current[index + 1]?.focus()
                }
                // Allow separators in pasted codes; editOtp keeps only eight digits.
                maxLength={OTP_LENGTH * 2}
                selectTextOnFocus
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((current) => (current === index ? null : current))}
                onChangeText={(text) => apply(editOtp(value, index, text))}
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
                  textAlignVertical: 'center',
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
