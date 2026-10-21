import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, Copy, fonts, Heading, Icon, icons } from '@/components/ui';

export type StaffTab = 'home' | 'check-in' | 'pos' | 'more';

export function StaffFrame({
  title,
  subtitle,
  children,
  active = 'home',
  back = false,
  contentStyle,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  active?: StaffTab;
  back?: boolean;
  contentStyle?: ViewStyle;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarInner}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/staff'))}
              style={styles.iconButton}
            >
              <Icon name="back" />
            </Pressable>
          ) : (
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>T</Text>
            </View>
          )}
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>TICKEY STAFF</Text>
            <Text style={styles.brandCaption}>Vận hành sự kiện</Text>
          </View>
          <View style={styles.onlineDot} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            onPress={() => router.push('/staff/tickets')}
            style={styles.iconButton}
          >
            <Icon name="bell" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }, contentStyle]}
      >
        <View>
          <Heading>{title}</Heading>
          {subtitle ? <Copy style={styles.subtitle}>{subtitle}</Copy> : null}
        </View>
        {children}
      </ScrollView>
      <StaffTabBar active={active} bottomInset={insets.bottom} />
    </View>
  );
}

export function StaffTabBar({ active, bottomInset }: { active: StaffTab; bottomInset: number }) {
  const tabs: { id: StaffTab; label: string; icon: keyof typeof icons; path: Href }[] = [
    { id: 'home', label: 'Ca làm', icon: 'home', path: '/staff' },
    { id: 'check-in', label: 'Soát vé', icon: 'ticket', path: '/staff/check-in' },
    { id: 'pos', label: 'Bán vé', icon: 'calendar', path: '/staff/pos' },
    { id: 'more', label: 'Thêm', icon: 'account', path: '/staff/tickets' },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: active === tab.id }}
          onPress={() => router.replace(tab.path)}
          style={styles.tab}
        >
          <View style={[styles.tabIcon, active === tab.id && styles.tabIconActive]}>
            <Icon name={tab.icon} />
          </View>
          <Text style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function StaffCard({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StaffSectionTitle({
  children,
  action,
  onAction,
}: PropsWithChildren<{ action?: string; onAction?: () => void }>) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StaffStatus({
  children,
  tone = 'info',
}: PropsWithChildren<{ tone?: 'info' | 'success' | 'warning' | 'danger' }>) {
  const palette = {
    info: { backgroundColor: '#EBF0FA', color: '#315D99' },
    success: { backgroundColor: '#E8F5EF', color: '#237857' },
    warning: { backgroundColor: '#FFF3D9', color: '#946018' },
    danger: { backgroundColor: '#FBEAED', color: '#B93824' },
  }[tone];
  return (
    <View style={[styles.status, { backgroundColor: palette.backgroundColor }]}>
      <View style={[styles.statusDot, { backgroundColor: palette.color }]} />
      <Text style={[styles.statusText, { color: palette.color }]}>{children}</Text>
    </View>
  );
}

export function StaffAction({
  label,
  caption,
  icon,
  onPress,
  tone = 'primary',
}: {
  label: string;
  caption: string;
  icon: keyof typeof icons;
  onPress: () => void;
  tone?: 'primary' | 'soft';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        tone === 'soft' && styles.actionCardSoft,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, tone === 'soft' && styles.actionIconSoft]}>
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionCaption}>{caption}</Text>
      </View>
      <Text style={styles.actionChevron}>›</Text>
    </Pressable>
  );
}

export function EventImage({ height = 132 }: { height?: number }) {
  return (
    <Image
      source={require('../../../../assets/figma/1-2125-imgPhotographyTheater.png')}
      style={{ width: '100%', height, borderRadius: 12 }}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  topBar: { backgroundColor: c.background },
  topBarInner: {
    height: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: 'white', fontFamily: fonts.heading, fontSize: 20 },
  brandBlock: { flex: 1, gap: 1 },
  brand: { color: c.text, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4 },
  brandCaption: { color: c.muted, fontFamily: fonts.regular, fontSize: 10 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B7956' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 10, gap: 18 },
  subtitle: { color: c.muted, marginTop: 3 },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  actionText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 12 },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.semibold, fontSize: 10 },
  actionCard: {
    backgroundColor: c.primary,
    borderRadius: 16,
    padding: 14,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCardSoft: { backgroundColor: c.container },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSoft: { backgroundColor: c.surface },
  actionLabel: { color: 'white', fontFamily: fonts.semibold, fontSize: 14 },
  actionCaption: { color: 'rgba(255,255,255,0.78)', fontFamily: fonts.regular, fontSize: 11 },
  actionChevron: { color: 'white', fontSize: 28, fontFamily: fonts.regular },
  pressed: { opacity: 0.82 },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { width: 50, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: c.primaryContainer },
  tabLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 10 },
  tabLabelActive: { color: c.primary, fontFamily: fonts.semibold },
});

export const staffStyles = styles;
