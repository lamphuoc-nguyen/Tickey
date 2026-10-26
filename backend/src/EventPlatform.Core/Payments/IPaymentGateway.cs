using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Payments;

/// <summary>What begin_payment returns in "payment": the server-side order to pay.</summary>
public sealed record PaymentOrder(string OrderRef, long Amount, string Gateway, DateTimeOffset ExpiresAt);

/// <summary>A verified gateway notification (IPN) or query result.</summary>
public sealed record GatewayResult(string OrderRef, string GatewayTxnId, long Amount, bool Succeeded, string? Reason);

/// <summary>
/// Adapter for the payment partner (escrow / split, MT §1). The partner is not chosen yet (OQ-02):
/// implement one class per gateway and register it in Program.cs of Api and Workers.
/// </summary>
public interface IPaymentGateway
{
    string Name { get; }

    /// <summary>Gateway URL for the customer; must expire before the booking lock does.</summary>
    Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl);

    /// <summary>Verifies signature, amount and currency of an IPN. Null means invalid: reject and alert (E-BKG-08).</summary>
    Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct);

    /// <summary>Asks the gateway about a PAYMENT_PENDING order (payment-query job, every 2 min).</summary>
    Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct);

    /// <summary>Requests a refund from the gateway. The idempotencyKey is the refund ID (refunds.id).
    /// Returns null if the gateway is unavailable; the worker will retry via outbox backoff.</summary>
    Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct);
}

/// <summary>Placeholder until OQ-02 is decided: fails loudly instead of pretending to take money.</summary>
public sealed class UnconfiguredPaymentGateway : IPaymentGateway
{
    public string Name => "UNCONFIGURED";

    public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl) => throw NotChosen();

    public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) =>
        throw NotChosen();

    public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct) => throw NotChosen();

    public Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct) =>
        throw NotChosen();

    private static NotSupportedException NotChosen() =>
        new("No payment gateway configured yet (OQ-02). Implement IPaymentGateway for the chosen partner.");
}

/// <summary>
/// Test mode (Payments:Gateway = TEST): no money moves. The payment URL is the API's own checkout page
/// (/payments/test/{orderRef}), where the tester chooses success or failure. Never enable it with real customers.
/// </summary>
public sealed class TestPaymentGateway : IPaymentGateway
{
    public const string Code = "TEST";

    public string Name => Code;

    private readonly string _hmacKey;

    public TestPaymentGateway(IOptions<TestPaymentOptions> options)
    {
        _hmacKey = options.Value.HmacKey ?? throw new InvalidOperationException("Payments:Test:HmacKey is required for TEST gateway");
    }

    public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl)
    {
        var signature = ComputeHmac($"{order.OrderRef}|{order.Amount}|{returnUrl}");
        return new(returnUrl, $"/payments/test/{Uri.EscapeDataString(order.OrderRef)}?amount={order.Amount}"
                           + $"&return={Uri.EscapeDataString(returnUrl.ToString())}"
                           + $"&sig={Uri.EscapeDataString(signature)}");
    }

    /// <summary>Verifies the HMAC signature for a test payment request.</summary>
    public bool VerifySignature(string orderRef, long amount, string returnUrl, string signature)
    {
        var expected = ComputeHmac($"{orderRef}|{amount}|{returnUrl}");
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature));
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_hmacKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash);
    }

    // The checkout page records the result itself; nothing arrives from outside.
    public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) =>
        Task.FromResult<GatewayResult?>(null);

    public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct) => Task.FromResult<GatewayResult?>(null);

    /// <summary>Test mode: always succeeds (no real money moves). Uses idempotencyKey as gateway_refund_id.</summary>
    public Task<GatewayResult?> RefundAsync(string idempotencyKey, long amount, string gatewayTxnId, CancellationToken ct)
    {
        // Simulate successful refund with the idempotency key as the gateway refund ID
        return Task.FromResult<GatewayResult?>(new GatewayResult(
            OrderRef: "", // not used for refund
            GatewayTxnId: idempotencyKey,
            Amount: amount,
            Succeeded: true,
            Reason: null));
    }
}

public sealed class TestPaymentOptions
{
    public string HmacKey { get; set; } = "";
}
