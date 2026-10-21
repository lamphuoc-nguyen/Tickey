import { Copy, Field, Heading, ui } from '@/components/ui';
import { useFormDraft } from '@/features/forms/use-form-draft';
export function FreeRegistrationFields({ sessionId, count }: { sessionId: string; count: number }) {
  const { draft, update } = useFormDraft(`free:${sessionId}`, { names: [] as string[] });
  const names = Array.from({ length: count }, (_, i) => draft.names[i] ?? '');
  return (
    <>
      <Heading small>Thông tin người tham dự</Heading>
      <Copy style={ui.muted}>Thông tin tạm nhập, chưa gửi. Có thể ghi tên lên vé sau khi phát hành.</Copy>
      {names.map((name, i) => (
        <Field
          key={i}
          label={`Vé ${i + 1} · Họ tên`}
          value={name}
          onChangeText={(value) => update({ names: names.map((n, j) => (j === i ? value : n)) })}
        />
      ))}
    </>
  );
}
