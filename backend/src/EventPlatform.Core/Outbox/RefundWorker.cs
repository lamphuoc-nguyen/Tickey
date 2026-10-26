using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace EventPlatform.Core.Outbox;

/// <summary>
/// Refund worker (S5-BE1-1, DB_INSTRUCTIONS §8):
/// claim_outbox('PROCESS_REFUND' / 'PROCESS_SESSION_REFUNDS') -> start_refund_processing
/// (idempotency key = refund id) -> IPaymentGateway.RefundAsync -> apply_refund_result.
/// Errors go back through complete_outbox(p_error): the database schedules the retry with backoff.
/// </summary>
public sealed class RefundWorker(
    SupabaseRpcClient rpc,
    IPaymentGateway gateway,
    ILogger<RefundWorker> log) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(10);
    private readonly string _workerId = $"refund-{Environment.MachineName}-{Environment.ProcessId}";

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
                log.LogError(e, "RefundWorker.RunOnceAsync failed");
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
        // Process PROCESS_REFUND jobs (single refund per job)
        var refundJobs = await rpc.CallAsync<List<OutboxJob>>("claim_outbox",
            new { p_topic = OutboxTopics.ProcessRefund, p_worker = _workerId, p_limit = 20 }, ct);

        // Process PROCESS_SESSION_REFUNDS jobs (session_id in aggregate_id, process all REQUESTED refunds for that session)
        var sessionJobs = await rpc.CallAsync<List<OutboxJob>>("claim_outbox",
            new { p_topic = OutboxTopics.ProcessSessionRefunds, p_worker = _workerId, p_limit = 20 }, ct);

        int handledCount = 0;

        // Process individual refund jobs
        foreach (var job in refundJobs)
        {
            if (await ProcessSingleRefund(job, ct))
            {
                handledCount++;
            }
        }

        // Process session refund jobs - fetch all REQUESTED refunds for the session
        foreach (var job in sessionJobs)
        {
            string? sessionJobError = null;
            bool completed = false;

            try
            {
                var refunds = await rpc.CallAsync<List<RefundDetails>>("get_refunds_by_session",
                    new { p_session_id = job.AggregateId }, ct);

                if (refunds.Count == 0)
                {
                    // No refunds to process for this session - complete the session job with success
                    await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = (string?)null }, ct);
                    handledCount++;
                    completed = true;
                    continue;
                }

                foreach (var refund in refunds)
                {
                    try
                    {
                        // Process each refund but DON'T complete the session job yet
                        var refundDetails = await rpc.CallAsync<RefundDetails>("start_refund_processing",
                            new { p_refund_id = refund.RefundId }, ct);

                        var result = await gateway.RefundAsync(
                            refundDetails.IdempotencyKey,
                            refundDetails.Amount,
                            refundDetails.GatewayTxnId,
                            ct);

                        if (result?.Succeeded == true)
                        {
                            try
                            {
                                await rpc.CallAsync("apply_refund_result", new
                                {
                                    p_refund_id = refund.RefundId,
                                    p_success = true,
                                    p_gateway_refund_id = result.GatewayTxnId
                                }, ct);
                            }
                            catch (Exception e) when (e is not OperationCanceledException)
                            {
                                log.LogWarning("apply_refund_result (success) failed for refund {RefundId}: {Error}", refund.RefundId, e.Message);
                                if (sessionJobError == null)
                                {
                                    sessionJobError = e.Message;
                                }
                            }
                            log.LogInformation("Refund succeeded for refund {RefundId} via {Gateway}", refund.RefundId, gateway.Name);
                        }
                        else
                        {
                            try
                            {
                                await rpc.CallAsync("apply_refund_result", new
                                {
                                    p_refund_id = refund.RefundId,
                                    p_success = false,
                                    p_error = result?.Reason ?? "Gateway did not confirm refund"
                                }, ct);
                            }
                            catch (Exception e) when (e is not OperationCanceledException)
                            {
                                log.LogWarning("apply_refund_result (failure) failed for refund {RefundId}: {Error}", refund.RefundId, e.Message);
                                if (sessionJobError == null)
                                {
                                    sessionJobError = e.Message;
                                }
                            }
                            log.LogWarning("Refund failed for refund {RefundId}: {Reason}", refund.RefundId, result?.Reason ?? "no response");
                            
                            // Track first error but continue processing other refunds
                            if (sessionJobError == null)
                            {
                                sessionJobError = result?.Reason ?? "Gateway did not confirm refund";
                            }
                        }
                        handledCount++;
                    }
                    catch (Exception e) when (e is not OperationCanceledException)
                    {
                        log.LogWarning("Processing refund {RefundId} failed: {Error}", refund.RefundId, e.Message);
                        try
                        {
                            await rpc.CallAsync("apply_refund_result", new
                            {
                                p_refund_id = refund.RefundId,
                                p_success = false,
                                p_error = e.Message
                            }, ct);
                        }
                        catch (Exception ex) when (ex is not OperationCanceledException)
                        {
                            log.LogWarning("apply_refund_result (exception path) failed for refund {RefundId}: {Error}", refund.RefundId, ex.Message);
                        }
                        
                        if (sessionJobError == null)
                        {
                            sessionJobError = e.Message;
                        }
                    }
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogError(e, "Failed to process session refunds for session {SessionId}", job.AggregateId);
                sessionJobError = e.Message;
            }
            finally
            {
                // Complete the session job ONCE after all refunds are processed (unless already completed for empty list)
                if (!completed)
                {
                    await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = sessionJobError }, ct);
                }
            }
        }

        return handledCount;
    }

    private async Task<bool> ProcessSingleRefund(OutboxJob job, CancellationToken ct)
    {
        try
        {
            // start_refund_processing returns refund details including idempotency_key (= refund_id)
            var refundDetails = await rpc.CallAsync<RefundDetails>("start_refund_processing",
                new { p_refund_id = job.AggregateId }, ct);

            // Call the payment gateway to process the refund
            var result = await gateway.RefundAsync(
                refundDetails.IdempotencyKey,
                refundDetails.Amount,
                refundDetails.GatewayTxnId,
                ct);

            if (result?.Succeeded == true)
            {
                await rpc.CallAsync("apply_refund_result", new
                {
                    p_refund_id = job.AggregateId,
                    p_success = true,
                    p_gateway_refund_id = result.GatewayTxnId
                }, ct);
                log.LogInformation("Refund succeeded for refund {RefundId} via {Gateway}", job.AggregateId, gateway.Name);
            }
            else
            {
                // Gateway says refund failed or no response
                await rpc.CallAsync("apply_refund_result", new
                {
                    p_refund_id = job.AggregateId,
                    p_success = false,
                    p_error = result?.Reason ?? "Gateway did not confirm refund"
                }, ct);
                log.LogWarning("Refund failed for refund {RefundId}: {Reason}", job.AggregateId, result?.Reason ?? "no response");
            }

            // Complete the outbox job on success (both refund success and gateway failure are handled by apply_refund_result)
            await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = (string?)null }, ct);
            return true;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning("Processing refund {RefundId} failed: {Error}", job.AggregateId, e.Message);
            await rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = e.Message }, ct);
            return false;
        }
    }
}

/// <summary>Shape returned by start_refund_processing.</summary>
public sealed record RefundDetails(
    Guid RefundId,
    string IdempotencyKey,
    long Amount,
    string Gateway,
    string OrderRef,
    string GatewayTxnId,
    string Method);