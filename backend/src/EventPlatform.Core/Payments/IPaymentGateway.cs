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
}

/// <summary>Placeholder until OQ-02 is decided: fails loudly instead of pretending to take money.</summary>
public sealed class UnconfiguredPaymentGateway : IPaymentGateway
{
    public string Name => "UNCONFIGURED";

    public Uri BuildPaymentUrl(PaymentOrder order, Uri returnUrl) => throw NotChosen();

    public Task<GatewayResult?> VerifyIpnAsync(IReadOnlyDictionary<string, string> fields, CancellationToken ct) =>
        throw NotChosen();

    public Task<GatewayResult?> QueryAsync(string orderRef, CancellationToken ct) => throw NotChosen();

    private static NotSupportedException NotChosen() =>
        new("No payment gateway configured yet (OQ-02). Implement IPaymentGateway for the chosen partner.");
}
