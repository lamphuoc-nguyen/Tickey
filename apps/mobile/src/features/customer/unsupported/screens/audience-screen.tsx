import { formatMoney } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, Card, Heading, QueryState, Screen, Select } from '@/components/ui';
import { DetailRow, Unavailable } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  return (
    <Screen
      footer={
        <ActionFooter
          onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
        >
          Về kiểm tra đơn
        </ActionFooter>
      }
    >
      <Heading>Giá theo người tham dự</Heading>
      <Unavailable>
        Giá theo nhóm người tham dự chưa được hỗ trợ. Giá trong đơn vẫn theo thông tin đã xác nhận.
      </Unavailable>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data?.items.map((item, i) => (
        <Card key={i}>
          <Heading small>
            Vé {i + 1}
            {item.quantity > 1 ? ` · ${item.quantity} người` : ''}
          </Heading>
          <DetailRow label="Ghế / khu" value={item.seatCode ?? 'Khu đứng'} />
          <Select
            label="Đối tượng"
            disabled
            disabledReason="Chưa có nhóm giá được cung cấp."
            value=""
            options={[]}
            onChange={() => {}}
          />
          <DetailRow label="Giá đang áp dụng" value={formatMoney(item.unitPrice)} />
        </Card>
      ))}
      {!query.data && (
        <Card>
          <Heading small>Thông tin vé</Heading>
          <DetailRow label="Ghế / khu" />
          <Select
            label="Đối tượng"
            disabled
            disabledReason="Chưa có nhóm giá được cung cấp."
            value=""
            options={[]}
            onChange={() => {}}
          />
          <DetailRow label="Giá đang áp dụng" />
        </Card>
      )}
    </Screen>
  );
}
export default function AudienceScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
