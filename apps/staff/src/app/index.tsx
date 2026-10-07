import { fontSize, lightColors, spacing } from '@event/ui-kit';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder. Spike S0-FE2-2 decides QR scanning (expo-camera / vision-camera) and the encrypted
// local DB (SQLite + SQLCipher). Runs as an Expo development build, not in Expo Go (MT §23.2).
export default function StaffHomeScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Soát vé' }} />
      <Text style={styles.title}>Event Staff</Text>
      <Text style={styles.body}>
        Quét QR, check-in thủ công, POS. Xem docs/Mo_ta_du_an_va_huong_dan.docx mục 23.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.sm, justifyContent: 'center' },
  title: { fontSize: fontSize.headline, fontWeight: '700', color: lightColors.text },
  body: { fontSize: fontSize.body, color: lightColors.textMuted },
});
