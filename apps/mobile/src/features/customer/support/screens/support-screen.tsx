import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supportInputSchema } from '@event/core';
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
} from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useOrders, useSupport } from '@/features/customer/account/hooks/use-customer-data';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useSupportActions } from '../hooks/use-support-actions';
import { supportCategoryLabels, visibleStatus } from '../presentation';
type Category = 'PAYMENT' | 'TICKET' | 'REFUND' | 'ACCOUNT' | 'APP_BUG' | 'OTHER';
function Content() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const query = useSupport(),
    orders = useOrders();
  const { createSupport } = useSupportActions();
  const { draft, update, clear } = useFormDraft(`support:${bookingId ?? 'general'}`, {
    bookingId: bookingId ?? '',
    category: 'PAYMENT' as Category,
    subject: '',
    body: '',
  });
  const [checked, setChecked] = useState(false);
  const rows = query.data?.pages.flat() ?? [];
  async function submit() {
    if (createSupport.isPending) return;
    setChecked(true);
    const input = { ...draft, bookingId: draft.bookingId || null };
    if (!supportInputSchema.safeParse(input).success) return;
    try {
      const request = await createSupport.mutateAsync(input);
      clear();
      router.push({ pathname: '/support/[requestId]', params: { requestId: request.id } });
    } catch {
      /* Keep draft. */
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter busy={createSupport.isPending} onPress={() => void submit()}>
          Gửi yêu cầu
        </ActionFooter>
      }
    >
      <Heading>Yêu cầu hỗ trợ</Heading>
      <Select
        label="Loại hỗ trợ"
        disabled={createSupport.isPending}
        value={draft.category}
        onChange={(category) => update({ category })}
        options={Object.entries(supportCategoryLabels).map(([value, label]) => ({
          value: value as Category,
          label,
        }))}
      />
      <Field
        label="Chủ đề"
        value={draft.subject}
        editable={!createSupport.isPending}
        onChangeText={(subject) => update({ subject })}
        error={checked && !draft.subject.trim() ? 'Nhập chủ đề cần hỗ trợ.' : undefined}
      />
      <Select
        label="Mã đơn liên quan"
        disabled={createSupport.isPending}
        value={draft.bookingId}
        onChange={(bookingId) => update({ bookingId })}
        options={[
          { value: '', label: 'Không có đơn liên quan' },
          ...(orders.data?.pages.flat().map((order) => ({ value: order.id, label: order.code })) ?? []),
          ...(draft.bookingId && !orders.data?.pages.flat().some((o) => o.id === draft.bookingId)
            ? [{ value: draft.bookingId, label: 'Đơn đã chọn · Chưa tải được tên' }]
            : []),
        ]}
      />
      <QueryState error={orders.error} retry={() => void orders.refetch()} compact />
      {orders.hasNextPage && (
        <Button secondary busy={orders.isFetchingNextPage} onPress={() => void orders.fetchNextPage()}>
          Tải thêm đơn để chọn
        </Button>
      )}
      <Field
        label="Nội dung"
        value={draft.body}
        editable={!createSupport.isPending}
        onChangeText={(body) => update({ body })}
        multiline
        placeholder="Bạn cần hỗ trợ điều gì?"
        error={checked && !draft.body.trim() ? 'Nhập nội dung cần hỗ trợ.' : undefined}
      />
      {!!createSupport.error && <ErrorNotice error={createSupport.error} />}
      <Heading small>Yêu cầu của tôi</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !rows.length}
        emptyText="Bạn chưa có yêu cầu hỗ trợ."
      />
      {rows.map((request) => (
        <Card key={request.id}>
          <Copy>
            {request.subject} · {visibleStatus(request.status)}
          </Copy>
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: '/support/[requestId]', params: { requestId: request.id } })
            }
          >
            Xem trao đổi
          </Button>
        </Card>
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm yêu cầu
        </Button>
      )}
    </Screen>
  );
}
export default function SupportScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
