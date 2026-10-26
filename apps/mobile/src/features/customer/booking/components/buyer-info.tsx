import { Card, Copy, QueryState, ui } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useProfile } from '@/features/customer/account/hooks/use-customer-data';

/** Buyer identity is read from the current account, never from a ticket holder. */
export function BuyerInfo({ online = true }: { online?: boolean }) {
  const { session } = useAuth();
  const profile = useProfile(online);
  if (!session) return null;
  return (
    <Card>
      <Copy style={ui.label}>Người mua</Copy>
      <Copy style={ui.semibold}>
        {profile.data?.fullName?.trim() ||
          (online && profile.isPending ? 'Đang tải thông tin…' : 'Chưa có tên trong hồ sơ')}
      </Copy>
      <Copy selectable style={ui.muted}>
        {profile.data?.email ?? session.email}
      </Copy>
      {online && <QueryState error={profile.error} retry={() => void profile.refetch()} compact />}
    </Card>
  );
}
