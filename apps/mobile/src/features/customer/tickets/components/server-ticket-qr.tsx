import QRCode from 'react-native-qrcode-svg';
import { Notice } from '@/components/ui';
import { View } from 'react-native';

/** Accepts a server/contract-provided encoded credential; never signs or constructs an envelope. */
export function ServerTicketQr({ encodedCredential }: { encodedCredential: string | null }) {
  return encodedCredential ? (
    <QRCode value={encodedCredential} size={160} color="#172A35" backgroundColor="white" />
  ) : (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}>
      <View
        accessibilityLabel="Vùng mã QR chưa khả dụng"
        style={{
          width: 160,
          height: 160,
          borderWidth: 1,
          borderColor: '#E7E4DF',
          borderRadius: 12,
          backgroundColor: '#FFFAF8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Notice warning>Mã QR chưa khả dụng</Notice>
      </View>
      <Notice warning>
        Mã QR chưa khả dụng. Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ trước khi đến cổng.
      </Notice>
    </View>
  );
}
