using System.Text.Json;

namespace EventPlatform.Core.Outbox;

/// <summary>A row of public.outbox returned by claim_outbox (SKIP LOCKED; retries and backoff live in the DB).</summary>
public sealed record OutboxJob(
    long Id,
    string Topic,
    string AggregateType,
    Guid AggregateId,
    JsonElement Payload,
    int Attempts);

/// <summary>Outbox topics handled by the .NET workers (DB_INSTRUCTIONS §8).</summary>
public static class OutboxTopics
{
    public const string IssueTickets = "ISSUE_TICKETS";
    public const string ProcessRefund = "PROCESS_REFUND";
    public const string ProcessSessionRefunds = "PROCESS_SESSION_REFUNDS";
    public const string ProcessPayout = "PROCESS_PAYOUT";
}
