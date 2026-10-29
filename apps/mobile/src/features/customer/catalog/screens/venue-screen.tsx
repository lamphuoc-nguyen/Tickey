import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, QueryState } from '@/components/ui';
import { CustomerBrowseScreen } from '@/components/customer-browse-screen';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTicket } from '@/features/customer/tickets/hooks/use-ticket';
import { useSessions } from '../hooks/use-catalog';
import { TicketVenueDetails, VenueDetails } from '../components/venue-details';

function TicketContent() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, query, saved, online } = useTicket(ticketId);
  return (
    <CustomerBrowseScreen
      tab="/orders"
      footer={
        <ActionFooter
          onPress={() => router.replace({ pathname: '/tickets/[ticketId]', params: { ticketId } })}
        >
          Về vé của tôi
        </ActionFooter>
      }
    >
      <QueryState
        loading={online ? query.isPending : saved.isPending}
        error={online ? query.error : saved.error}
        retry={() => void query.refetch()}
      />
      {ticket ? <TicketVenueDetails ticket={ticket} /> : <VenueDetails venue={undefined} />}
    </CustomerBrowseScreen>
  );
}
export function TicketVenueScreen() {
  return (
    <AuthGate>
      <TicketContent />
    </AuthGate>
  );
}
export function EventVenueScreen() {
  const { eventId = '', sessionId } = useLocalSearchParams<{ eventId: string; sessionId?: string }>();
  const query = useSessions(eventId);
  const session = query.data?.find((s) => s.id === sessionId);
  return (
    <CustomerBrowseScreen
      tab="/"
      footer={
        <ActionFooter onPress={() => router.replace({ pathname: '/events/[eventId]', params: { eventId } })}>
          Về sự kiện
        </ActionFooter>
      }
    >
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !session}
        emptyText="Chưa có thông tin địa điểm cho suất diễn này."
      />
      <VenueDetails venue={session?.venue} doorsOpenAt={session?.doorsOpenAt} />
    </CustomerBrowseScreen>
  );
}
