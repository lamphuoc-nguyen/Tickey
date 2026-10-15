import { fontSize, lightColors, spacing } from '@event/ui-kit';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder. Spike S0-FE2-2 decides QR scanning (expo-camera / vision-camera) and the encrypted
// local DB (SQLite + SQLCipher). Runs as an Expo development build, not in Expo Go (MT §23.2).
export default function StaffHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Khu vực nhân viên</Text>
      <Text style={styles.body}>Quét vé, kiểm soát vé và bán vé tại quầy hiện chưa sẵn sàng.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.sm, gap: spacing.sm },
  title: { fontSize: fontSize.headline, fontWeight: '700', color: lightColors.text },
  body: { fontSize: fontSize.body, color: lightColors.textMuted },
});
