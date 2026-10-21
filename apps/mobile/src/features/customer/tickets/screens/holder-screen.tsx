import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, ErrorNotice, Field, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useHolder, useTicket } from '../hooks/use-ticket';
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, query, online } = useTicket(ticketId);
  const holder = useHolder();
  const { draft, update, clear } = useFormDraft(`holder:${ticketId}`, { name: '', email: '', phone: '' });
  const [checked, setChecked] = useState(false);
  const canAssign = online && !query.error && ticket?.status === 'ISSUED' && !ticket.holderName;
  async function submit() {
    if (!canAssign || holder.isPending) return;
    setChecked(true);
    if (
      !draft.name.trim() ||
      (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) ||
      (draft.phone && !/^[+\d\s()-]{6,20}$/.test(draft.phone))
    )
      return;
    try {
      await holder.mutateAsync({
        id: ticketId,
        name: draft.name,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
      });
      clear();
      router.back();
    } catch {
      /*Keep entered fields.*/
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!canAssign}
          disabledReason={
            !online
              ? 'Cần kết nối mạng để ghi tên.'
              : query.error
                ? 'Cần tải được vé trước khi ghi tên.'
                : ticket?.holderName
                  ? 'Vé đã có người tham dự và chưa hỗ trợ chuyển nhượng.'
                  : 'Chỉ ghi tên cho vé đã phát hành còn cho phép gán tên.'
          }
          busy={holder.isPending}
          onPress={() => void submit()}
        >
          Lưu người tham dự
        </ActionFooter>
      }
    >
      <Heading>Người tham dự</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <Notice>Tên người tham dự chỉ được ghi một lần. Hãy kiểm tra trước khi lưu.</Notice>
      <Field
        label="Họ tên người tham dự"
        value={draft.name}
        editable={!holder.isPending}
        onChangeText={(name) => update({ name })}
        error={checked && !draft.name.trim() ? 'Nhập họ tên người tham dự.' : undefined}
      />
      <Field
        label="Email"
        value={draft.email}
        editable={!holder.isPending}
        onChangeText={(email) => update({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        error={
          checked && draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)
            ? 'Email chưa hợp lệ.'
            : undefined
        }
      />
      <Field
        label="Số điện thoại"
        value={draft.phone}
        editable={!holder.isPending}
        onChangeText={(phone) => update({ phone })}
        keyboardType="phone-pad"
        error={
          checked && draft.phone && !/^[+\d\s()-]{6,20}$/.test(draft.phone)
            ? 'Số điện thoại cần 6–20 ký tự hợp lệ.'
            : undefined
        }
      />
      {!!holder.error && <ErrorNotice error={holder.error} />}
    </Screen>
  );
}
export default function HolderScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
