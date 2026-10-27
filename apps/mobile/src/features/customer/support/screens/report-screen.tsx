import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { formatSessionTime, reportInputSchema } from '@event/core';
import {
  ActionFooter,
  Button,
  Card,
  Copy,
  ErrorNotice,
  Field,
  Heading,
  QueryState,
  Screen,
  Select,
  ui,
} from '@/components/ui';
import { MenuGroup, MenuRow, TextAction } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTickets } from '@/features/customer/account/hooks/use-customer-data';
import { useTicket } from '@/features/customer/tickets/hooks/use-ticket';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useSupportActions } from '../hooks/use-support-actions';
import { reportCategoryLabels } from '../presentation';
import { EvidenceFileCard } from '../components/evidence-file-card';
import { EvidenceValidationError } from '../evidence-file';
type Category = 'NOT_AS_DESCRIBED' | 'EVENT_NOT_HELD' | 'ENTRY_DENIED' | 'SAFETY' | 'SEAT_ISSUE' | 'OTHER';
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId?: string }>();
  const { ticket, query, online } = useTicket(ticketId);
  const tickets = useTickets();
  const actions = useSupportActions();
  const { draft, update, clear } = useFormDraft('report-new', {
    category: 'NOT_AS_DESCRIBED' as Category,
    description: '',
    assets: [] as DocumentPickerAsset[],
  });
  const [checked, setChecked] = useState(false);
  async function submit() {
    if (actions.report.isPending || actions.pickEvidence.isPending || !ticket || !online || query.error)
      return;
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
          disabled={
            !online || !ticket || !!query.error || actions.report.isSuccess || actions.pickEvidence.isPending
          }
          disabledReason={
            !online
              ? 'Cần kết nối mạng để gửi phản ánh.'
              : query.error
                ? 'Cần tải được vé trước khi gửi.'
                : actions.pickEvidence.isPending
                  ? 'Đang chọn tệp minh chứng.'
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
        <View style={[ui.row, { alignItems: 'flex-start' }]}>
          {ticket?.session?.event?.coverImageUrl && (
            <Image
              source={ticket.session.event.coverImageUrl}
              contentFit="cover"
              style={{ width: 72, height: 80, borderRadius: 8 }}
            />
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Copy style={ui.semibold}>{ticket?.session?.event?.title ?? 'Chọn vé liên quan'}</Copy>
            {ticket?.session && (
              <Copy style={ui.muted}>
                {formatSessionTime(ticket.session.startsAt, ticket.session.venue?.timezone)}
              </Copy>
            )}
            {ticket?.session?.venue?.name && <Copy style={ui.muted}>{ticket.session.venue.name}</Copy>}
            {ticket && <Copy>{ticket.seat?.seatCode ?? ticket.ticketType?.name ?? 'Khu đứng'}</Copy>}
          </View>
        </View>
        {!!ticketId && (
          <TextAction
            disabled={actions.report.isPending}
            disabledReason="Đang gửi phản ánh."
            onPress={() => router.setParams({ ticketId: '' })}
          >
            Đổi vé liên quan
          </TextAction>
        )}
        {!ticketId && (
          <>
            <Select
              label="Chọn vé của tôi"
              value=""
              disabled={tickets.isPending || !!tickets.error || !tickets.data?.pages.flat().length}
              options={(tickets.data?.pages.flat() ?? []).map((t) => ({
                value: t.id,
                label: `${t.session?.event?.title ?? 'Vé Tickey'} · ${t.seat?.seatCode ?? t.ticketType?.name ?? 'Khu đứng'}`,
              }))}
              onChange={(id) => router.replace({ pathname: '/reports/new', params: { ticketId: id } })}
            />
            <QueryState
              loading={tickets.isPending}
              error={tickets.error}
              retry={() => void tickets.refetch()}
              empty={!tickets.isPending && !tickets.error && !tickets.data?.pages.flat().length}
              emptyText="Bạn chưa có vé để gửi phản ánh."
              compact
            />
            {tickets.hasNextPage && (
              <Button
                secondary
                busy={tickets.isFetchingNextPage}
                onPress={() => void tickets.fetchNextPage()}
              >
                Tải thêm vé
              </Button>
            )}
          </>
        )}
      </Card>
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
      <MenuGroup>
        <MenuRow
          icon="upload"
          navigation={false}
          label="Thêm ảnh hoặc PDF"
          description="Tối đa 10 MB/tệp"
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
        />
      </MenuGroup>
      {draft.assets.map((asset) => (
        <EvidenceFileCard
          key={asset.uri}
          asset={asset}
          disabled={actions.report.isPending}
          onRemove={() => update({ assets: draft.assets.filter((a) => a.uri !== asset.uri) })}
        />
      ))}
      {!!actions.pickEvidence.error &&
        (actions.pickEvidence.error instanceof EvidenceValidationError ? (
          <Copy accessibilityRole="alert">{actions.pickEvidence.error.message}</Copy>
        ) : (
          <ErrorNotice error={actions.pickEvidence.error} />
        ))}
      {!!actions.report.error && (
        <>
          {actions.report.error instanceof EvidenceValidationError ? (
            <Copy accessibilityRole="alert">{actions.report.error.message}</Copy>
          ) : (
            <ErrorNotice error={actions.report.error} />
          )}
          <TextAction onPress={() => router.push('/reports')}>Kiểm tra phản ánh đã gửi</TextAction>
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
