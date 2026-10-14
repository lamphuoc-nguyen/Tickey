import { useLocalSearchParams, router } from 'expo-router';
import { Button, Field, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { Unavailable } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useBooking } from '../hooks/use-booking';
import { BookingSummary } from '../components/booking-summary';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const { draft, update } = useFormDraft(`holder-before-issue:${bookingId}`, {
    names: [] as string[],
    email: '',
  });
  const booking = query.data;
  const names = Array.from({ length: booking?.itemCount ?? 0 }, (_, i) => draft.names[i] ?? '');
  return (
    <Screen
      footer={
        <Button
          disabled={!booking || !!query.error}
          disabledReason="Cần tải được đơn trước khi tiếp tục."
          onPress={() =>
            router.push({
              pathname:
                booking?.status === 'PENDING' ? '/booking/[bookingId]/payment' : '/booking/[bookingId]',
              params: { bookingId },
            })
          }
        >
          {booking?.status === 'PENDING' ? 'Tiếp tục thanh toán' : 'Về đơn và vé'}
        </Button>
      }
    >
      <Heading>Người tham dự</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <BookingSummary booking={booking} />
      <Unavailable>
        Thông tin nhập ở đây chưa được gửi. Bạn có thể ghi tên lên từng vé sau khi vé được phát hành.
      </Unavailable>
      {names.map((name, i) => (
        <Field
          key={i}
          label={`Vé ${i + 1} · Họ tên người tham dự`}
          value={name}
          onChangeText={(value) => update({ names: names.map((n, j) => (i === j ? value : n)) })}
          helper={!name.trim() ? 'Tên người tham dự chưa được nhập.' : undefined}
        />
      ))}
      {!booking && (
        <Field
          label="Họ tên người tham dự"
          value=""
          editable={false}
          helper="Tải thông tin đơn để xác định số người tham dự."
        />
      )}
      <Field
        label="Email nhận thông tin"
        value={draft.email}
        onChangeText={(email) => update({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        helper="Thông tin này chưa được lưu vào đơn."
      />
      <Notice>Bạn vẫn có thể tiếp tục thanh toán theo trạng thái hiện tại của đơn.</Notice>
    </Screen>
  );
}
export default function BookingHolderScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
