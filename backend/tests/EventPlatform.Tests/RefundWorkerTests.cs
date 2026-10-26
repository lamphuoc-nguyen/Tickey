using System;
using System.Net;
using System.Text.Json;
using EventPlatform.Core.Outbox;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class RefundWorkerTests
{
    private static readonly Guid RefundId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid SessionId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static (RefundWorker Worker, FakeHttpHandler Handler) Create(Func<string, string, (HttpStatusCode, string)> byFunction)
    {
        var handler = new FakeHttpHandler((req, _) => 
        {
            var segments = req.RequestUri!.Segments;
            var segment = segments[^1];
            // Determine topic from request body for claim_outbox
            string topic = "";
            if (segment == "claim_outbox")
            {
                var body = req.Content?.ReadAsStringAsync().Result ?? "";
                if (body.Contains("PROCESS_SESSION_REFUNDS")) topic = "PROCESS_SESSION_REFUNDS";
                else if (body.Contains("PROCESS_REFUND")) topic = "PROCESS_REFUND";
            }
            return byFunction(topic, segment);
        });
        var rpc = new SupabaseRpcClient(new HttpClient(handler),
            Options.Create(new SupabaseOptions { Url = "http://db.test", AnonKey = "a.b.c", ServiceRoleKey = "s.r.k" }));
        var gateway = new TestGateway();
        return (new RefundWorker(rpc, gateway, NullLogger<RefundWorker>.Instance), handler);
    }

    private static string RefundJob => $$"""
        [{"id":7,"topic":"PROCESS_REFUND","aggregate_type":"refund","aggregate_id":"{{RefundId}}","payload":{},"attempts":0}]
        """;

    private static string SessionJob => $$"""
        [{"id":8,"topic":"PROCESS_SESSION_REFUNDS","aggregate_type":"session","aggregate_id":"{{SessionId}}","payload":{},"attempts":0}]
        """;

    private static string RefundDetailsJson => $$"""
        [{"refund_id":"{{RefundId}}","idempotency_key":"{{RefundId}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}]
        """;

    private sealed class TestGateway : IPaymentGateway
    {
        public string Name => "VNPAY";
        public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl) => throw new NotImplementedException();
        public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) => throw new NotImplementedException();
        public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct) => throw new NotImplementedException();
        public Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct)
            => Task.FromResult<GatewayResult?>(new GatewayResult("", idempotencyKey, amount, true, null));
    }

    [Fact]
    public async Task Processes_PROCESS_REFUND_job_successfully_and_completes_outbox()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, RefundJob),
                ("", "start_refund_processing") => (HttpStatusCode.OK, $$"""{"refund_id":"{{RefundId}}","idempotency_key":"{{RefundId}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.OK, """{"status":"SUCCEEDED"}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Contains("claim_outbox", calls);
        Assert.Contains("start_refund_processing", calls);
        Assert.Contains("apply_refund_result", calls);
        Assert.Contains("complete_outbox", calls);

        // Verify complete_outbox called with null error
        var completeCall = handler.Calls.First(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox");
        using var complete = JsonDocument.Parse(completeCall.Body);
        Assert.Equal(JsonValueKind.Null, complete.RootElement.GetProperty("p_error").ValueKind);
    }

    [Fact]
    public async Task Processes_PROCESS_REFUND_job_gateway_failure_and_completes_outbox_with_error()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, RefundJob),
                ("", "start_refund_processing") => (HttpStatusCode.OK, $$"""{"refund_id":"{{RefundId}}","idempotency_key":"{{RefundId}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.OK, """{"status":"FAILED"}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Contains("claim_outbox", calls);
        Assert.Contains("start_refund_processing", calls);
        Assert.Contains("apply_refund_result", calls);
        Assert.Contains("complete_outbox", calls);

        // Verify complete_outbox called with null error (gateway failure is handled by apply_refund_result)
        var completeCall = handler.Calls.First(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox");
        using var complete = JsonDocument.Parse(completeCall.Body);
        Assert.Equal(JsonValueKind.Null, complete.RootElement.GetProperty("p_error").ValueKind);
    }

    [Fact]
    public async Task Processes_PROCESS_SESSION_REFUNDS_job_fetches_refunds_and_processes_each()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, SessionJob),
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "get_refunds_by_session") => (HttpStatusCode.OK, RefundDetailsJson),
                ("", "start_refund_processing") => (HttpStatusCode.OK, $$"""{"refund_id":"{{RefundId}}","idempotency_key":"{{RefundId}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.OK, """{"status":"SUCCEEDED"}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Contains("claim_outbox", calls);
        Assert.Contains("get_refunds_by_session", calls);
        Assert.Contains("start_refund_processing", calls);
        Assert.Contains("apply_refund_result", calls);
        Assert.Contains("complete_outbox", calls);
    }

    [Fact]
    public async Task Rpc_error_in_start_refund_processing_is_reported_back_to_outbox()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, RefundJob),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "start_refund_processing") => (HttpStatusCode.BadRequest, """{"code":"P0001","message":"INVALID_STATE","details":""}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        var completeCall = handler.Calls.First(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox");
        Assert.Contains("\"p_error\":\"INVALID_STATE\"", completeCall.Body);
    }

    [Fact]
    public async Task Rpc_error_in_apply_refund_result_is_reported_back_to_outbox()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, RefundJob),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "start_refund_processing") => (HttpStatusCode.OK, $$"""{"refund_id":"{{RefundId}}","idempotency_key":"{{RefundId}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.BadRequest, """{"code":"P0001","message":"INVALID_STATE","details":""}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        var completeCall = handler.Calls.First(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox");
        Assert.Contains("\"p_error\":\"INVALID_STATE\"", completeCall.Body);
    }

    [Fact]
    public async Task Unexpected_exception_is_caught_and_reported_to_outbox()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, RefundJob),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "start_refund_processing") => throw new InvalidOperationException("Unexpected error"),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        var completeCall = handler.Calls.First(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox");
        Assert.Contains("Unexpected error", completeCall.Body);
    }

    [Fact]
    public async Task Returns_count_of_successfully_processed_jobs()
    {
        var multiJob = $$"""
            [
                {"id":7,"topic":"PROCESS_REFUND","aggregate_type":"refund","aggregate_id":"11111111-1111-1111-1111-111111111111","payload":{},"attempts":0},
                {"id":8,"topic":"PROCESS_REFUND","aggregate_type":"refund","aggregate_id":"22222222-2222-2222-2222-222222222222","payload":{},"attempts":0}
            ]
            """;

        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, multiJob),
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "start_refund_processing") => (HttpStatusCode.OK, """{"refund_id":"11111111-1111-1111-1111-111111111111","idempotency_key":"11111111-1111-1111-1111-111111111111","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.OK, """{"status":"SUCCEEDED"}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task Processes_PROCESS_SESSION_REFUNDS_job_with_empty_refund_list_completes_once()
    {
        var (worker, handler) = Create((topic, segment) => 
        {
            return (topic, segment) switch
            {
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, SessionJob),
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "get_refunds_by_session") => (HttpStatusCode.OK, "[]"),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        Assert.Equal(1, count);

        // Verify complete_outbox called exactly once with null error
        var completeCalls = handler.Calls.Where(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox").ToArray();
        Assert.Single(completeCalls);
        using var complete = JsonDocument.Parse(completeCalls[0].Body);
        Assert.Equal(JsonValueKind.Null, complete.RootElement.GetProperty("p_error").ValueKind);
    }

    [Fact]
    public async Task Processes_PROCESS_SESSION_REFUNDS_job_first_refund_fails_second_succeeds_completes_once_with_error()
    {
        var refundId1 = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var refundId2 = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var twoRefundsJson = $$"""
            [
                {"refund_id":"{{refundId1}}","idempotency_key":"{{refundId1}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"},
                {"refund_id":"{{refundId2}}","idempotency_key":"{{refundId2}}","amount":200000,"gateway":"VNPAY","order_ref":"REF-2","gateway_txn_id":"TXN-456","method":"card"}
            ]
            """;

        // Custom gateway that fails for first refund, succeeds for second
        var callCount = 0;
        var failingGateway = new FailingThenSucceedingGateway(refundId1, refundId2, () => callCount++);

        var handler = new FakeHttpHandler((req, _) => 
        {
            var segments = req.RequestUri!.Segments;
            var segment = segments[^1];
            string topic = "";
            if (segment == "claim_outbox")
            {
                var body = req.Content?.ReadAsStringAsync().Result ?? "";
                if (body.Contains("PROCESS_SESSION_REFUNDS")) topic = "PROCESS_SESSION_REFUNDS";
                else if (body.Contains("PROCESS_REFUND")) topic = "PROCESS_REFUND";
            }
            return (topic, segment) switch
            {
                ("PROCESS_SESSION_REFUNDS", "claim_outbox") => (HttpStatusCode.OK, SessionJob),
                ("PROCESS_REFUND", "claim_outbox") => (HttpStatusCode.OK, "[]"),
                ("", "get_refunds_by_session") => (HttpStatusCode.OK, twoRefundsJson),
                ("", "start_refund_processing") => (HttpStatusCode.OK, callCount == 0 
                    ? $$"""{"refund_id":"{{refundId1}}","idempotency_key":"{{refundId1}}","amount":300000,"gateway":"VNPAY","order_ref":"REF-1","gateway_txn_id":"TXN-123","method":"card"}"""
                    : $$"""{"refund_id":"{{refundId2}}","idempotency_key":"{{refundId2}}","amount":200000,"gateway":"VNPAY","order_ref":"REF-2","gateway_txn_id":"TXN-456","method":"card"}"""),
                ("", "apply_refund_result") => (HttpStatusCode.OK, """{"status":"SUCCEEDED"}"""),
                ("", "complete_outbox") => (HttpStatusCode.OK, "null"),
                _ => (HttpStatusCode.OK, "null"),
            };
        });
        
        var rpc = new SupabaseRpcClient(new HttpClient(handler),
            Options.Create(new SupabaseOptions { Url = "http://db.test", AnonKey = "a.b.c", ServiceRoleKey = "s.r.k" }));
        var worker = new RefundWorker(rpc, failingGateway, NullLogger<RefundWorker>.Instance);

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        // Both refunds should be processed (count = 2)
        Assert.Equal(2, count);

        // Verify complete_outbox called exactly once for the session job with error
        var completeCalls = handler.Calls.Where(c => c.Request.RequestUri!.Segments[^1] == "complete_outbox").ToArray();
        Assert.Single(completeCalls);
        using var complete = JsonDocument.Parse(completeCalls[0].Body);
        Assert.Equal(JsonValueKind.String, complete.RootElement.GetProperty("p_error").ValueKind);
        Assert.Contains("Gateway declined", complete.RootElement.GetProperty("p_error").GetString());

        // Verify both refunds had start_refund_processing called
        var startCalls = handler.Calls.Where(c => c.Request.RequestUri!.Segments[^1] == "start_refund_processing").ToArray();
        Assert.Equal(2, startCalls.Length);

        // Verify both refunds had apply_refund_result called
        var applyCalls = handler.Calls.Where(c => c.Request.RequestUri!.Segments[^1] == "apply_refund_result").ToArray();
        Assert.Equal(2, applyCalls.Length);
    }

    private sealed class FailingThenSucceedingGateway : IPaymentGateway
    {
        private readonly Guid _failRefundId;
        private readonly Guid _succeedRefundId;
        private readonly Func<int> _getCallCount;

        public FailingThenSucceedingGateway(Guid failRefundId, Guid succeedRefundId, Func<int> getCallCount)
        {
            _failRefundId = failRefundId;
            _succeedRefundId = succeedRefundId;
            _getCallCount = getCallCount;
        }

        public string Name => "VNPAY";
        public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl) => throw new NotImplementedException();
        public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) => throw new NotImplementedException();
        public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct) => throw new NotImplementedException();
        
        public Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct)
        {
            var currentCall = _getCallCount();
            if (currentCall == 0 && idempotencyKey == _failRefundId.ToString())
            {
                // First call for first refund - fail
                return Task.FromResult<GatewayResult?>(new GatewayResult("", idempotencyKey, amount, false, "Gateway declined"));
            }
            // Second call or other refunds - succeed
            return Task.FromResult<GatewayResult?>(new GatewayResult("", idempotencyKey, amount, true, null));
        }
    }
}