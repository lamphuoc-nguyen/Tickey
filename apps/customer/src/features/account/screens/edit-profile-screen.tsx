import { useState } from 'react';
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
  async function submit() {
    if (actions.updateProfile.isPending || !profile.data || profile.error) return;
    setChecked(true);
    if (!draft.fullName.trim() || !/^[+\d\s()-]{0,20}$/.test(draft.phone)) return;
    try {
      await actions.updateProfile.mutateAsync(draft);
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
        editable={!actions.updateProfile.isPending}
        onChangeText={(fullName) => update({ fullName })}
        autoComplete="name"
        error={checked && !draft.fullName.trim() ? 'Nhập họ và tên.' : undefined}
      />
      <Field
        label="Số điện thoại"
        value={draft.phone}
        editable={!actions.updateProfile.isPending}
        onChangeText={(phone) => update({ phone })}
        keyboardType="phone-pad"
        error={checked && !/^[+\d\s()-]{0,20}$/.test(draft.phone) ? 'Số điện thoại chưa hợp lệ.' : undefined}
      />
      <Copy>Email: {profile.data?.email ?? 'Chưa tải được thông tin email'}</Copy>
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
