import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { ActionFooter, Copy, ErrorNotice, Field, Heading, QueryState, Screen } from '@/components/ui';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useAccountActions, useProfile } from '../hooks/use-customer-data';
import { ProfileIdentity } from '../components/profile-identity';
function Content() {
  const profile = useProfile(),
    actions = useAccountActions();
  const { draft, update, clear } = useFormDraft('edit-profile', {
    fullName: profile.data?.fullName ?? '',
    phone: profile.data?.phone ?? '',
  });
  const [checked, setChecked] = useState(false);
  const phoneInput = useRef<TextInput>(null);
  const ready = !!profile.data && !profile.error;
  const editable = ready && !actions.updateProfile.isPending;
  async function submit() {
    if (actions.updateProfile.isPending || !profile.data || profile.error) return;
    setChecked(true);
    if (!draft.fullName.trim() || !/^[+\d\s()-]{0,20}$/.test(draft.phone)) return;
    try {
      await actions.updateProfile.mutateAsync({ fullName: draft.fullName.trim(), phone: draft.phone.trim() });
      clear();
      router.back();
    } catch {
      /*Keep fields.*/
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!profile.data || !!profile.error}
          disabledReason="Cần tải được hồ sơ trước khi lưu thay đổi."
          busy={actions.updateProfile.isPending}
          onPress={() => void submit()}
        >
          Lưu thay đổi
        </ActionFooter>
      }
    >
      <Heading>Thông tin cá nhân</Heading>
      <QueryState loading={profile.isPending} error={profile.error} retry={() => void profile.refetch()} />
      <ProfileIdentity profile={profile.data} />
      <Field
        label="Họ và tên"
        value={draft.fullName}
        editable={editable}
        onChangeText={(fullName) => update({ fullName })}
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneInput.current?.focus()}
        error={checked && !draft.fullName.trim() ? 'Nhập họ và tên.' : undefined}
      />
      <Field
        label="Số điện thoại"
        inputRef={phoneInput}
        value={draft.phone}
        editable={editable}
        onChangeText={(phone) => update({ phone })}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        error={checked && !/^[+\d\s()-]{0,20}$/.test(draft.phone) ? 'Số điện thoại chưa hợp lệ.' : undefined}
      />
      <View style={{ gap: 8 }}>
        <Copy style={{ fontSize: 12 }}>Email</Copy>
        <Copy selectable>{profile.data?.email ?? 'Chưa tải được thông tin email'}</Copy>
      </View>
      {!!actions.updateProfile.error && <ErrorNotice error={actions.updateProfile.error} />}
    </Screen>
  );
}
export default function EditProfileScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
