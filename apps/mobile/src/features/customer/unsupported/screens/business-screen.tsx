import { useState } from 'react';
import { z } from 'zod';
import { router, useLocalSearchParams } from 'expo-router';
import { formatMoney } from '@event/core';
import { Button, Card, Copy, Field, Heading, QueryState, Screen } from '@/components/ui';
import { DetailRow, Unavailable, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { BookingSummary } from '@/features/customer/booking/components/booking-summary';
import { useFormDraft } from '@/features/forms/use-form-draft';
const businessSchema = z.object({
  name: z.string().trim().min(1),
  tax: z.string().regex(/^\d{10}(?:-?\d{3})?$/),
  address: z.string().trim().min(1),
  email: z.email(),
  attendees: z.array(z.string().trim().min(1)),
});
function Content({ review = false }: { review?: boolean }) {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const { draft, update } = useFormDraft(`business:${bookingId}`, {
    name: '',
    tax: '',
    address: '',
    email: '',
    attendees: [] as string[],
  });
  const [checked, setChecked] = useState(false);
  const booking = query.data;
  const attendees = Array.from({ length: booking?.itemCount ?? 0 }, (_, i) => draft.attendees[i] ?? '');
  const valid = businessSchema.safeParse({ ...draft, attendees }).success;
  return (
    <Screen
      footer={
        review ? (
          <UnavailableAction
            label="Thanh toán doanh nghiệp"
            reason="Mua vé và thanh toán cho doanh nghiệp chưa được hỗ trợ. Thông tin nhập chưa được gửi."
          />
        ) : (
          <Button
            disabled={!booking || !!query.error}
            disabledReason="Cần tải được đơn thật trước khi kiểm tra thông tin."
            onPress={() => {
              setChecked(true);
              if (valid)
                router.push({ pathname: '/booking/[bookingId]/business-review', params: { bookingId } });
            }}
          >
            Kiểm tra thông tin
          </Button>
        )
      }
    >
      <Heading>{review ? 'Kiểm tra đơn doanh nghiệp' : 'Mua cho doanh nghiệp'}</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <Unavailable>
        Chức năng mua vé cho doanh nghiệp chưa được hỗ trợ. Bạn có thể nhập và kiểm tra thông tin; thông tin
        này chưa được gửi hoặc lưu vào đơn.
      </Unavailable>
      {review ? (
        <>
          <BookingSummary booking={booking} />
          <Card>
            <Heading small>Thông tin vừa nhập · Chưa gửi</Heading>
            <DetailRow label="Doanh nghiệp" value={draft.name} />
            <DetailRow label="Mã số thuế" value={draft.tax} />
            <DetailRow label="Địa chỉ" value={draft.address} />
            <DetailRow label="Email" value={draft.email} />
          </Card>
          {booking && (
            <Card>
              <Heading small>Đơn hiện tại {booking.code}</Heading>
              <DetailRow label="Số vé" value={String(booking.itemCount)} />
              <DetailRow label="Ghế" value={booking.items.map((i) => i.seatCode ?? 'Khu đứng').join(', ')} />
              <DetailRow label="Giá của đơn hiện tại" value={formatMoney(booking.totalAmount)} />
              <DetailRow label="Cổng" />
            </Card>
          )}
          <Button secondary onPress={() => router.back()}>
            Chỉnh sửa thông tin
          </Button>
        </>
      ) : (
        <>
          <Field
            label="Tên doanh nghiệp"
            value={draft.name}
            onChangeText={(name) => update({ name })}
            error={checked && !draft.name.trim() ? 'Nhập tên doanh nghiệp.' : undefined}
          />
          <Field
            label="Mã số thuế"
            value={draft.tax}
            onChangeText={(tax) => update({ tax })}
            keyboardType="number-pad"
            error={
              checked && !/^\d{10}(?:-?\d{3})?$/.test(draft.tax)
                ? 'Nhập mã số thuế 10 hoặc 13 chữ số.'
                : undefined
            }
          />
          <Field
            label="Địa chỉ xuất hóa đơn"
            value={draft.address}
            onChangeText={(address) => update({ address })}
            error={checked && !draft.address.trim() ? 'Nhập địa chỉ.' : undefined}
          />
          <Field
            label="Email nhận hóa đơn"
            value={draft.email}
            onChangeText={(email) => update({ email })}
            autoCapitalize="none"
            keyboardType="email-address"
            error={checked && !z.email().safeParse(draft.email).success ? 'Email chưa hợp lệ.' : undefined}
          />
          {booking && (
            <Copy>
              {booking.itemCount} vé trong đơn hiện tại ·{' '}
              {booking.items.map((i) => i.seatCode ?? 'Khu đứng').join(', ')}
            </Copy>
          )}
          {attendees.map((name, i) => (
            <Field
              key={i}
              label={`Người tham dự ${i + 1}`}
              value={name}
              onChangeText={(value) => update({ attendees: attendees.map((n, j) => (j === i ? value : n)) })}
              error={checked && !name.trim() ? 'Nhập tên người tham dự.' : undefined}
            />
          ))}
          {!booking && (
            <Field
              label="Người tham dự"
              value=""
              editable={false}
              helper="Tải thông tin đơn để xác định số người tham dự."
            />
          )}
        </>
      )}
      <Button
        secondary
        onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
      >
        Về đơn hiện tại
      </Button>
    </Screen>
  );
}
export default function BusinessScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
export function BusinessReviewScreen() {
  return (
    <AuthGate>
      <Content review />
    </AuthGate>
  );
}
