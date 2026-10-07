import { fontSize, lightColors, spacing } from '@event/ui-kit';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder home. Routes to add (MT §18 step 9): session picker, seat map, hold countdown,
// payment waiting screen, tickets, refund tracking, report; workspace picker after login.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sự kiện' }} />
      <Text style={styles.title}>Event Platform</Text>
      <Text style={styles.body}>App khách hàng. Xem docs/Mo_ta_du_an_va_huong_dan.docx mục 18.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.sm, justifyContent: 'center' },
  title: { fontSize: fontSize.headline, fontWeight: '700', color: lightColors.text },
  body: { fontSize: fontSize.body, color: lightColors.textMuted },
});
