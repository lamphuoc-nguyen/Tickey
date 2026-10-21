import { Children, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Copy, Icon, c, ui } from './ui';

/** Customer navigation uses rows; filled buttons are reserved for the main action. */
export function MenuGroup({ title, children }: PropsWithChildren<{ title?: string }>) {
  const rows = Children.toArray(children);
  if (!rows.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {title && (
        <Copy accessibilityRole="header" style={[ui.label, ui.muted]}>
          {title}
        </Copy>
      )}
      <View style={styles.group}>
        {rows.map((child, index) => (
          <View key={index}>
            {index > 0 && <View style={styles.divider} />}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function MenuRow({
  label,
  description,
  status,
  icon,
  onPress,
  disabled = false,
  disabledReason,
  busy = false,
  destructive = false,
  navigation = true,
}: {
  label: string;
  description?: string;
  status?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  destructive?: boolean;
  navigation?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, status].filter(Boolean).join(', ')}
        accessibilityHint={disabled ? disabledReason : description}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.tint }]}
      >
        {icon && (
          <View style={styles.icon} accessible={false}>
            <Icon name={icon} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2, opacity: disabled ? 0.5 : 1 }}>
          <Copy style={[ui.semibold, destructive && { color: c.primary }]}>{label}</Copy>
          {description && <Copy style={[ui.muted, styles.caption]}>{description}</Copy>}
          {status && <Copy style={[ui.muted, styles.caption]}>{status}</Copy>}
        </View>
        {busy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          !disabled &&
          !destructive &&
          navigation && (
            <View style={{ transform: [{ rotate: '-90deg' }] }} accessible={false}>
              <Icon name="chevron" />
            </View>
          )
        )}
      </Pressable>
      {disabled && disabledReason && <Copy style={[ui.muted, styles.reason]}>{disabledReason}</Copy>}
    </View>
  );
}

export function TextAction({
  children,
  onPress,
  disabled,
  disabledReason,
  busy,
  accessibilityLabel,
  expanded,
}: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  accessibilityLabel?: string;
  expanded?: boolean;
}>) {
  return (
    <View style={{ flexShrink: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
        accessibilityHint={disabled ? disabledReason : undefined}
        accessibilityState={{ disabled: disabled || busy, busy, expanded }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.textAction,
          (disabled || busy) && { opacity: 0.5 },
          pressed && { backgroundColor: c.tint },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <Copy style={[ui.semibold, { color: c.primary }]}>{children}</Copy>
        )}
      </Pressable>
      {disabled && disabledReason && <Copy style={[ui.muted, styles.caption]}>{disabledReason}</Copy>}
    </View>
  );
}

export function Badge({ children }: PropsWithChildren) {
  return (
    <View style={styles.badge}>
      <Copy style={styles.caption}>{children}</Copy>
    </View>
  );
}

export function Disclosure({ title, children }: PropsWithChildren<{ title: string }>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.tint }]}
      >
        <Copy style={[ui.semibold, { flex: 1 }]}>{title}</Copy>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} accessible={false}>
          <Icon name="chevron" />
        </View>
      </Pressable>
      {expanded && <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: 16 },
  caption: { fontSize: 12, lineHeight: 19 },
  reason: { fontSize: 12, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 12 },
  textAction: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.tint,
  },
});
