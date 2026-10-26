using System;
using System.Net;
using System.Text.Json;
using EventPlatform.Core.Outbox;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class PaymentQueryJobTests
{
    private static readonly Guid BookingId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly string OrderRef = "ABC123DEF-1";

    private static (PaymentQueryJob Worker, FakeHttpHandler Handler) Create(Func<string, (HttpStatusCode, string)> byFunction, bool gatewaySucceeded = true)
    {
        var handler = new FakeHttpHandler((req, _) => byFunction(req.RequestUri!.Segments[^1]));
        var rpc = new SupabaseRpcClient(new HttpClient(handler),
            Options.Create(new SupabaseOptions { Url = "http://db.test", AnonKey = "a.b.c", ServiceRoleKey = "s.r.k" }));
        var gateway = new TestGateway(gatewaySucceeded);
        return (new PaymentQueryJob(rpc, gateway, NullLogger<PaymentQueryJob>.Instance), handler);
    }

    private static string Job => $$"""
        [{"booking_id":"{{BookingId}}","order_ref":"{{OrderRef}}","gateway":"VNPAY","amount":300000,"initiated_at":"2026-01-01T10:00:00Z"}]
        """;

    private sealed class TestGateway : IPaymentGateway
    {
        private readonly bool _succeeded;
        public TestGateway(bool succeeded = true) => _succeeded = succeeded;
        public string Name => "VNPAY";
        public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl) => throw new NotImplementedException();
        public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) => throw new NotImplementedException();
        public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct)
            => Task.FromResult<GatewayResult?>(new GatewayResult(orderRef, "TXN-123", 300000, _succeeded, _succeeded ? null : "not paid"));
        public Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct) => throw new NotImplementedException();
    }

    [Fact]
    public async Task Queries_gateway_and_applies_success_for_paid_booking()
    {
        var (worker, handler) = Create(fn => fn switch
        {
            "list_payment_pending_to_query" => (HttpStatusCode.OK, Job),
            "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"INITIATED"}"""),
            "apply_payment_success" => (HttpStatusCode.OK, """{"result":"PAID"}"""),
            _ => (HttpStatusCode.OK, "null"),
        }, gatewaySucceeded: true);

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Equal(["list_payment_pending_to_query", "get_payment_by_order_ref", "apply_payment_success"], calls);
    }

    [Fact]
    public async Task Expires_booking_when_payment_is_failed_immediately_without_querying_gateway()
    {
        var (worker, handler) = Create(fn => fn switch
        {
            "list_payment_pending_to_query" => (HttpStatusCode.OK, Job),
            "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"FAILED"}"""),
            "expire_unpaid_booking" => (HttpStatusCode.OK, "null"),
            _ => (HttpStatusCode.OK, "null"),
        });

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        // Should NOT call QueryAsync (gateway), should call expire_unpaid_booking directly
        Assert.Equal(["list_payment_pending_to_query", "get_payment_by_order_ref", "expire_unpaid_booking"], calls);
    }

    [Fact]
    public async Task Expires_booking_when_gateway_returns_not_paid()
    {
        var (worker, handler) = Create(fn => fn switch
        {
            "list_payment_pending_to_query" => (HttpStatusCode.OK, Job),
            "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"INITIATED"}"""),
            "expire_unpaid_booking" => (HttpStatusCode.OK, "null"),
            _ => (HttpStatusCode.OK, "null"),
        }, gatewaySucceeded: false);

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Contains("expire_unpaid_booking", calls);
    }

    [Fact]
    public async Task Returns_count_of_successfully_handled_jobs()
    {
        var (worker, handler) = Create(fn => fn switch
        {
            "list_payment_pending_to_query" => (HttpStatusCode.OK, Job),
            "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"INITIATED"}"""),
            "apply_payment_success" => (HttpStatusCode.OK, """{"result":"PAID"}"""),
            _ => (HttpStatusCode.OK, "null"),
        });

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Handles_multiple_jobs_and_returns_correct_count()
    {
        var multiJob = $$"""
            [
                {"booking_id":"11111111-1111-1111-1111-111111111111","order_ref":"REF-1","gateway":"VNPAY","amount":300000,"initiated_at":"2026-01-01T10:00:00Z"},
                {"booking_id":"22222222-2222-2222-2222-222222222222","order_ref":"REF-2","gateway":"VNPAY","amount":300000,"initiated_at":"2026-01-01T10:00:00Z"}
            ]
            """;

        var (worker, handler) = Create(fn => fn switch
        {
            "list_payment_pending_to_query" => (HttpStatusCode.OK, multiJob),
            "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"INITIATED"}"""),
            "apply_payment_success" => (HttpStatusCode.OK, """{"result":"PAID"}"""),
            _ => (HttpStatusCode.OK, "null"),
        }, gatewaySucceeded: true);

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task Rpc_error_is_logged_and_continues_with_other_jobs()
    {
        var multiJob = $$"""
            [
                {"booking_id":"11111111-1111-1111-1111-111111111111","order_ref":"REF-1","gateway":"VNPAY","amount":300000,"initiated_at":"2026-01-01T10:00:00Z"},
                {"booking_id":"22222222-2222-2222-2222-222222222222","order_ref":"REF-2","gateway":"VNPAY","amount":300000,"initiated_at":"2026-01-01T10:00:00Z"}
            ]
            """;

        var applySuccessCallCount = 0;
        var (worker, handler) = Create(fn =>
        {
            return fn switch
            {
                "list_payment_pending_to_query" => (HttpStatusCode.OK, multiJob),
                "get_payment_by_order_ref" => (HttpStatusCode.OK, """{"status":"INITIATED"}"""),
                "apply_payment_success" => applySuccessCallCount++ == 0
                    ? (HttpStatusCode.BadRequest, """{"code":"P0001","message":"INVALID_STATE","details":""}""")
                    : (HttpStatusCode.OK, """{"result":"PAID"}"""),
                _ => (HttpStatusCode.OK, "null"),
            };
        }, gatewaySucceeded: true);

        var count = await worker.RunOnceAsync(TestContext.Current.CancellationToken);
        // One job failed with RpcException (not counted), one succeeded (counted = 1)
        Assert.Equal(1, count);
    }
}