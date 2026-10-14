import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { reportInputSchema } from '@event/core';
import {
  ActionFooter,
  Button,
  Card,
  Copy,
  ErrorNotice,
  Field,
  Heading,
  Notice,
  QueryState,
  Screen,
  Select,
} from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTicket } from '@/features/tickets/hooks/use-ticket';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useSupportActions } from '../hooks/use-support-actions';
import { reportCategoryLabels } from '../presentation';
type Category = 'NOT_AS_DESCRIBED' | 'EVENT_NOT_HELD' | 'ENTRY_DENIED' | 'SAFETY' | 'SEAT_ISSUE' | 'OTHER';
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId?: string }>();
  const { ticket, query, online } = useTicket(ticketId);
  const actions = useSupportActions();
  const { draft, update, clear } = useFormDraft(`report:${ticketId}`, {
    category: 'NOT_AS_DESCRIBED' as Category,
    description: '',
    assets: [] as DocumentPickerAsset[],
  });
  const [checked, setChecked] = useState(false);
  async function submit() {
    if (actions.report.isPending || !ticket || !online || query.error) return;
    setChecked(true);
    const input = { ticketId, category: draft.category, description: draft.description };
    if (!reportInputSchema.safeParse({ ...input, attachmentPaths: [] }).success) return;
    try {
      const result = await actions.report.mutateAsync({ input, assets: draft.assets });
      clear();
      router.replace({ pathname: '/reports/[reportId]', params: { reportId: result.reportId } });
    } catch {
      /* Keep entered text and files visible. */
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!online || !ticket || !!query.error || actions.report.isSuccess}
          disabledReason={
            !online
              ? 'Cần kết nối mạng để gửi phản ánh.'
              : query.error
                ? 'Cần tải được vé trước khi gửi.'
                : !ticket
                  ? 'Chọn vé liên quan để gửi phản ánh.'
                  : 'Phản ánh đã được tiếp nhận.'
          }
          busy={actions.report.isPending}
          onPress={() => void submit()}
        >
          Gửi phản ánh
        </ActionFooter>
      }
    >
      <Heading>Gửi phản ánh</Heading>
      <QueryState
        loading={!!ticketId && query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <Card>
        <Heading small>Vé liên quan</Heading>
        <Copy>{ticket?.session?.event?.title ?? 'Chưa chọn được vé'}</Copy>
        <Copy>{ticket?.seat?.seatCode ?? (ticket ? 'Khu đứng' : 'Chưa có thông tin vị trí')}</Copy>
        {!ticketId && (
          <Button secondary onPress={() => router.push('/tickets')}>
            Chọn vé của tôi
          </Button>
        )}
      </Card>
      <Notice>Gửi trong thời hạn phản ánh. Quyền sở hữu vé và thời hạn được kiểm tra khi gửi.</Notice>
      <Select
        label="Loại vấn đề"
        value={draft.category}
        disabled={actions.report.isPending}
        onChange={(category) => update({ category })}
        options={Object.entries(reportCategoryLabels).map(([value, label]) => ({
          value: value as Category,
          label,
        }))}
      />
      <Field
        label="Mô tả"
        value={draft.description}
        editable={!actions.report.isPending}
        onChangeText={(description) => update({ description })}
        multiline
        placeholder="Mô tả vấn đề bạn gặp"
        error={checked && draft.description.trim().length < 10 ? 'Mô tả cần ít nhất 10 ký tự.' : undefined}
      />
      <Heading small>Bằng chứng</Heading>
      <Button
        secondary
        disabled={actions.report.isPending}
        disabledReason="Đang gửi phản ánh."
        busy={actions.pickEvidence.isPending}
        onPress={() =>
          void actions.pickEvidence
            .mutateAsync()
            .then((picked) =>
              update({
                assets: [
                  ...draft.assets,
                  ...picked.filter((a) => !draft.assets.some((p) => p.uri === a.uri)),
                ],
              }),
            )
            .catch(() => {})
        }
      >
        Chọn ảnh hoặc PDF · Tối đa 10 MB/tệp
      </Button>
      {draft.assets.map((asset) => (
        <Card key={asset.uri}>
          <Copy>{asset.name}</Copy>
          <Button
            secondary
            disabled={actions.report.isPending}
            disabledReason="Đang gửi phản ánh."
            onPress={() => update({ assets: draft.assets.filter((a) => a.uri !== asset.uri) })}
          >
            Bỏ bằng chứng
          </Button>
        </Card>
      ))}
      {!!actions.pickEvidence.error && <ErrorNotice error={actions.pickEvidence.error} />}{' '}
      {!!actions.report.error && (
        <>
          <ErrorNotice error={actions.report.error} />
          <Button secondary onPress={() => router.push('/reports')}>
            Kiểm tra phản ánh của tôi trước khi gửi lại
          </Button>
        </>
      )}
    </Screen>
  );
}
export default function ReportScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
