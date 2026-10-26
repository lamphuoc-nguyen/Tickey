using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace EventPlatform.Core.Outbox;

/// <summary>
/// Queries the payment gateway for PAYMENT_PENDING bookings whose gateway session has expired
/// and whose booking lock has also expired (lock_expires_at < now()).
/// Calls apply_payment_success if gateway confirms payment, expire_unpaid_booking otherwise.
/// Runs every minute as a hosted service (like IssueTicketsWorker).
/// </summary>
public sealed class PaymentQueryJob(
    SupabaseRpcClient rpc,
    IPaymentGateway gateway,
    ILogger<PaymentQueryJob> log) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(10);

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
                log.LogError(e, "PaymentQueryJob.RunOnceAsync failed");
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
        var jobs = await rpc.CallAsync<List<PaymentPendingJob>>("list_payment_pending_to_query",
            new { p_limit = 50 }, ct);

        int handledCount = 0;
        foreach (var job in jobs)
        {
            try
            {
                // Check the latest payment status for this booking to handle FAILED case
                var latestPayment = await rpc.CallAsync<JsonElement>("get_payment_by_order_ref",
                    new { p_order_ref = job.OrderRef }, ct);

                bool shouldExpireImmediately = false;
                if (latestPayment.ValueKind != JsonValueKind.Null &&
                    latestPayment.TryGetProperty("status", out var statusProp) &&
                    statusProp.GetString() == "FAILED")
                {
                    // Contract: payment mới nhất FAILED → expire_unpaid_booking ngay, không hỏi cổng
                    shouldExpireImmediately = true;
                }

                if (shouldExpireImmediately)
                {
                    await rpc.CallAsync("expire_unpaid_booking", new { p_booking_id = job.BookingId }, ct);
                    log.LogInformation("Booking {BookingId} expired (payment FAILED)", job.BookingId);
                }
                else
                {
                    // For TestPaymentGateway, QueryAsync returns null (no real gateway)
                    // In real gateway mode, this would call the actual gateway
                    var result = await gateway.QueryAsync(job.OrderRef, ct);

                    if (result?.Succeeded == true)
                    {
                        await rpc.CallAsync("apply_payment_success", new
                        {
                            p_order_ref = result.OrderRef,
                            p_gateway_txn_id = result.GatewayTxnId,
                            p_amount = result.Amount,
                            p_payload = new { method = gateway.Name, order_ref = result.OrderRef }
                        }, ct);
                        log.LogInformation("Payment confirmed for booking {BookingId} via {Gateway}", job.BookingId, gateway.Name);
                    }
                    else
                    {
                        // Gateway says not paid or no response: expire the booking
                        await rpc.CallAsync("expire_unpaid_booking", new { p_booking_id = job.BookingId }, ct);
                        log.LogInformation("Booking {BookingId} expired (no payment confirmed)", job.BookingId);
                    }
                }
                handledCount++;
            }
            catch (RpcException e)
            {
                log.LogWarning("Payment query for booking {BookingId} failed: {Code}", job.BookingId, e.Message);
                // Don't retry here - the DB outbox mechanism handles retries for other jobs
                // This job is polled directly, so we just log and continue
            }
        }
        return handledCount;
    }
}

/// <summary>Shape returned by list_payment_pending_to_query.</summary>
public sealed record PaymentPendingJob(
    Guid BookingId,
    string OrderRef,
    string Gateway,
    long Amount,
    DateTimeOffset InitiatedAt);