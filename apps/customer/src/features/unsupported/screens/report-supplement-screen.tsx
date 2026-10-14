import type { DocumentPickerAsset } from 'expo-document-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Copy, ErrorNotice, Field, Heading, QueryState, Screen } from '@/components/ui';
import { Unavailable, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useReport, useSupportActions } from '@/features/support/hooks/use-support-actions';
import { useFormDraft } from '@/features/forms/use-form-draft';
function Content() {
  const { reportId = '' } = useLocalSearchParams<{ reportId: string }>();
  const query = useReport(reportId);
  const actions = useSupportActions();
  const { draft, update } = useFormDraft(`supplement:${reportId}`, {
    body: '',
    assets: [] as DocumentPickerAsset[],
  });
  return (
    <Screen
      footer={
        <UnavailableAction
          label="Gửi bổ sung"
          reason="Bổ sung phản ánh chưa được hỗ trợ. Nội dung và tệp bạn chọn chưa được gửi."
        />
      }
    >
      <Heading>Bổ sung phản ánh</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && <Copy>{query.data.description}</Copy>}
      <Unavailable>
        Bạn có thể chuẩn bị nội dung và chọn tệp trên thiết bị. Thông tin này chưa được gửi.
      </Unavailable>
      <Field
        label="Nội dung bổ sung"
        value={draft.body}
        onChangeText={(body) => update({ body })}
        multiline
        placeholder="Nêu thông tin hoặc bằng chứng mới"
        helper={!draft.body.trim() ? 'Nhập nội dung cần bổ sung.' : undefined}
      />
      <Heading small>Bằng chứng</Heading>
      <Button
        secondary
        busy={actions.pickEvidence.isPending}
        onPress={() =>
          void actions.pickEvidence
            .mutateAsync()
            .then((assets) =>
              update({
                assets: [
                  ...draft.assets,
                  ...assets.filter((a) => !draft.assets.some((p) => p.uri === a.uri)),
                ],
              }),
            )
            .catch(() => {})
        }
      >
        Chọn ảnh hoặc PDF · Tối đa 10 MB/tệp
      </Button>
      {!!actions.pickEvidence.error && <ErrorNotice error={actions.pickEvidence.error} />}
      {draft.assets.map((a) => (
        <Button
          key={a.uri}
          secondary
          onPress={() => update({ assets: draft.assets.filter((p) => p.uri !== a.uri) })}
        >
          Bỏ {a.name}
        </Button>
      ))}
      <Button
        secondary
        onPress={() => router.replace({ pathname: '/reports/[reportId]', params: { reportId } })}
      >
        Về phản ánh
      </Button>
    </Screen>
  );
}
export default function ReportSupplementScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
