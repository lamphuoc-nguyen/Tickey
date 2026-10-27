import { useState } from 'react';
import { Image } from 'expo-image';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Copy, c, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { evidenceSize, isEvidenceImage } from '../evidence-file';

export function EvidenceFileCard({
  asset,
  disabled,
  onRemove,
}: {
  asset: DocumentPickerAsset;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [failed, setFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const image = isEvidenceImage(asset);
  return (
    <Card>
      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        {image ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem ảnh ${asset.name}`}
            onPress={() => setPreview(true)}
          >
            <Image
              source={asset.uri}
              contentFit="cover"
              style={{ width: 72, height: 72, borderRadius: 8 }}
              onError={() => setFailed(true)}
            />
          </Pressable>
        ) : (
          <View
            style={{
              width: 56,
              height: 64,
              borderRadius: 8,
              backgroundColor: c.tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Copy style={ui.semibold}>PDF</Copy>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Copy style={ui.semibold}>{asset.name}</Copy>
          <Copy style={ui.muted}>{evidenceSize(asset.size)}</Copy>
          {failed && <Copy style={ui.muted}>Chưa thể hiển thị ảnh trên thiết bị.</Copy>}
        </View>
      </View>
      <TextAction
        accessibilityLabel={`Bỏ tệp ${asset.name}`}
        disabled={disabled}
        disabledReason="Đang gửi phản ánh."
        onPress={onRemove}
      >
        Bỏ tệp
      </TextAction>
      <Modal visible={preview} animationType="fade" onRequestClose={() => setPreview(false)}>
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: c.background,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 20,
            gap: 16,
          }}
        >
          <Copy style={ui.semibold}>{asset.name}</Copy>
          <Image
            source={asset.uri}
            contentFit="contain"
            style={{ flex: 1 }}
            onError={() => setFailed(true)}
          />
          {failed && <Copy>Chưa thể hiển thị ảnh trên thiết bị.</Copy>}
          <Button secondary onPress={() => setPreview(false)}>
            Đóng ảnh
          </Button>
        </View>
      </Modal>
    </Card>
  );
}
