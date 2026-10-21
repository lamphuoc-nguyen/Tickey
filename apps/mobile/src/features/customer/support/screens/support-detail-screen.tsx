import { useLocalSearchParams } from 'expo-router';
import { ActionFooter, Card, Copy, ErrorNotice, Field, Heading, QueryState, Screen } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useSupportActions, useSupportRequest } from '../hooks/use-support-actions';
import { visibleStatus } from '../presentation';
import { useFormDraft } from '@/features/forms/use-form-draft';
function Content() {
  const { requestId = '' } = useLocalSearchParams<{ requestId: string }>();
  const query = useSupportRequest(requestId);
  const { message } = useSupportActions();
  const { draft, update, clear } = useFormDraft(`message:${requestId}`, { body: '' });
  const body = draft.body;
  const setBody = (body: string) => update({ body });
  const closed = !!query.data && ['RESOLVED', 'CLOSED'].includes(query.data.status);
  const unavailable = !query.data || !!query.error || closed;
  const disabledReason = closed
    ? 'Yêu cầu đã kết thúc và không nhận thêm tin nhắn.'
    : !query.data || query.error
      ? 'Cần tải được yêu cầu để gửi tin nhắn.'
      : 'Nhập nội dung tin nhắn.';
  return (
    <Screen
      footer={
        <>
          {query.data && (
            <Field
              label="Tin nhắn"
              value={body}
              onChangeText={setBody}
              placeholder="Nhập tin nhắn"
              editable={!unavailable && !message.isPending}
              multiline
              style={{ height: 80, maxHeight: 120 }}
            />
          )}
          {!!message.error && <ErrorNotice error={message.error} />}
          <ActionFooter
            disabled={unavailable || !body.trim()}
            disabledReason={disabledReason}
            busy={message.isPending}
            onPress={() => {
              if (unavailable || !body.trim() || message.isPending) return;
              void message
                .mutateAsync({ id: requestId, body })
                .then(() => clear())
                .catch(() => {});
            }}
          >
            Gửi tin nhắn
          </ActionFooter>
        </>
      }
    >
      <Heading>{query.data?.subject ?? 'Chi tiết hỗ trợ'}</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && (
        <>
          <Copy>Trạng thái: {visibleStatus(query.data.status)}</Copy>
          {query.data.messages.map((m) => (
            <Card key={m.id}>
              <Heading small>{m.authorSide === 'CUSTOMER' ? 'Bạn' : 'Tickey'}</Heading>
              <Copy>{m.body}</Copy>
              <Copy>{new Date(m.createdAt).toLocaleString('vi-VN')}</Copy>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
export default function SupportDetailScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
