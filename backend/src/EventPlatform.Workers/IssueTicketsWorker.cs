using EventPlatform.Core.Outbox;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Workers;

/// <summary>Ticket to sign, as returned by issue_tickets: the payload holds ids only, no personal data.</summary>
public sealed record TicketToSign(Guid TicketId, string Payload);

/// <summary>
/// PAID booking -> signed tickets -> CONFIRMED (MT §5, S2-BE1-3/4):
/// claim_outbox('ISSUE_TICKETS') -> issue_tickets -> sign Ed25519 -> attach_ticket_credentials -> complete_outbox.
/// Errors go back through complete_outbox(p_error): the database schedules the retry with backoff.
/// </summary>
public sealed class IssueTicketsWorker(
    SupabaseRpcClient rpc,
    QrSigner signer,
    ILogger<IssueTicketsWorker> log) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(2);
    private readonly string _workerId = $"issue-{Environment.MachineName}-{Environment.ProcessId}";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            int handled;
            try
            {
                handled = await RunOnceAsync(ct);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogError(e, "claim_outbox failed");
                handled = 0;
            }
            if (handled == 0)
            {
                await Task.Delay(IdleDelay, ct);
            }
        }
    }

    public async Task<int> RunOnceAsync(CancellationToken ct)
    {
        var jobs = await rpc.CallAsync<List<OutboxJob>>("claim_outbox",
            new { p_topic = OutboxTopics.IssueTickets, p_worker = _workerId, p_limit = 20 }, ct);

        foreach (var job in jobs)
        {
            try
            {
                var toSign = await rpc.CallAsync<List<TicketToSign>>("issue_tickets",
                    new { p_booking_id = job.AggregateId, p_kid = signer.Kid }, ct);
                var items = toSign.Select(t => new
                {
                    ticket_id = t.TicketId,
                    kid = signer.Kid,
                    payload = t.Payload,
                    signature = signer.Sign(t.Payload),
                });
                await rpc.CallAsync("attach_ticket_credentials", new { p_booking_id = job.AggregateId, p_items = items }, ct);
                await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = (string?)null }, ct);
            }
            catch (RpcException e)
            {
                log.LogWarning("Issuing tickets for booking {BookingId} failed: {Code}", job.AggregateId, e.Message);
                await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = e.Message }, ct);
            }
        }
        return jobs.Count;
    }
}
