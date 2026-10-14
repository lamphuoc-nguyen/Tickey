import { Field, Heading, Notice } from '@/components/ui';
import { useFormDraft } from '@/features/forms/use-form-draft';
export function FreeRegistrationFields({ sessionId, count }: { sessionId: string; count: number }) {
  const { draft, update } = useFormDraft(`free:${sessionId}`, { names: [] as string[] });
  const names = Array.from({ length: count }, (_, i) => draft.names[i] ?? '');
  return (
    <>
      <Heading small>Thông tin người tham dự</Heading>
      <Notice>Vé miễn phí vẫn có số lượng giới hạn. Không có bước thanh toán.</Notice>
      {names.map((name, i) => (
        <Field
          key={i}
          label={`Vé ${i + 1} · Họ tên`}
          value={name}
          onChangeText={(value) => update({ names: names.map((n, j) => (j === i ? value : n)) })}
          helper="Tên nhập tại đây chưa được gửi. Ghi tên lên từng vé sau khi phát hành."
        />
      ))}
    </>
  );
}
