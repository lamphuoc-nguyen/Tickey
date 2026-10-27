import { Keyboard, Pressable, TextInput, View } from 'react-native';
import { Copy, Icon, c, ui } from '@/components/ui';

export function EventSearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <View
      style={[ui.card, ui.row, { minHeight: 56, paddingVertical: 0, paddingRight: 4, borderRadius: 999 }]}
    >
      <View accessible={false}>
        <Icon name="search" />
      </View>
      <TextInput
        accessibilityLabel="Tìm sự kiện"
        placeholder="Tên sự kiện"
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        multiline={false}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        style={[ui.body, { flex: 1, minWidth: 0, paddingVertical: 14 }]}
      />
      {!!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa từ khóa"
          onPress={() => onChange('')}
          style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Copy style={{ fontSize: 24, color: c.muted }}>×</Copy>
        </Pressable>
      )}
    </View>
  );
}
