using System.Text.Json;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

/// <summary>Gateway is accepted from older apps and ignored: the server's configured gateway decides.</summary>
public sealed record CreatePaymentSessionRequest(Guid BookingId, string? Gateway);

/// <summary>Mode tells the app how to finish: TEST = submit the signed test form, REDIRECT = open PaymentUrl.</summary>
public sealed record PaymentSessionResponse(Guid BookingId, string PaymentUrl, DateTimeOffset ExpiresAt, string Mode);

/// <summary>Shape of begin_payment's "payment" object.</summary>
internal sealed record BeginPaymentResult(JsonElement Booking, BeginPaymentOrder Payment);

internal sealed record BeginPaymentOrder(string OrderRef, long Amount, string Gateway, DateTimeOffset ExpiresAt);

public static class PaymentEndpoints
{
    public static void MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/payments");

        // MT §24 step 1: the app asks for a payment session with the user's own JWT.
        // Same as POST /api/bookings/{id}/payment (BookingEndpoints).
        group.MapPost("/sessions", async (CreatePaymentSessionRequest body, HttpContext http,
            SupabaseRpcClient rpc, IPaymentGateway gateway, IConfiguration config, CancellationToken ct) =>
            Bearer.Token(http) is { } jwt
                ? await CreateSessionAsync(body.BookingId, jwt, rpc, gateway, config, ct)
                : Results.Unauthorized());

        group.MapPost("/ipn/{gateway}", HandleIpnAsync);
        app.MapPost("/api/payments/ipn/{gateway}", HandleIpnAsync);

        // MT §24 step 3: the gateway sends the customer back here; hand over to the app's deep link.
        // Its parameters are not trusted: the app polls get_booking for the real status.
        group.MapGet("/return", (Guid booking_id, IConfiguration config) =>
            Results.Redirect($"{config["App:PaymentResultDeepLink"]}?booking_id={booking_id}"));
    }

    /// <summary>begin_payment as the user (PostgREST validates the JWT, the RPC checks ownership), then the gateway URL.</summary>
    public static async Task<IResult> CreateSessionAsync(Guid bookingId, string jwt,
        SupabaseRpcClient rpc, IPaymentGateway gateway, IConfiguration config, CancellationToken ct)
    {
        // Checked before begin_payment, so a closed checkout leaves the booking untouched.
        if (gateway is UnconfiguredPaymentGateway or TestPaymentGateway { CheckoutAllowed: false })
        {
            return Unavailable();
        }

        var result = await rpc.CallAsUserAsync<BeginPaymentResult>("begin_payment",
            new { p_booking_id = bookingId, p_gateway = gateway.Name }, jwt, ct);

        var p = result.Payment;
        var returnUrl = new Uri($"{config["Api:PublicUrl"]?.TrimEnd('/')}/payments/return?booking_id={bookingId}");
        var url = gateway.BuildPaymentUrl(new PaymentOrder(p.OrderRef, p.Amount, p.Gateway, p.ExpiresAt), returnUrl);
        var mode = gateway is TestPaymentGateway ? "TEST" : "REDIRECT";
        return Results.Ok(new PaymentSessionResponse(bookingId, url.ToString(), p.ExpiresAt, mode));
    }

    /// <summary>No usable gateway here: the app shows "payment unavailable" (ApiError PAYMENT_UNAVAILABLE).</summary>
    public static IResult Unavailable() => Results.Json(new { message = "PAYMENT_UNAVAILABLE", details = "{}" },
        statusCode: StatusCodes.Status503ServiceUnavailable);

    // MT §20.5: verify, record, always 200 after recording. Tickets are issued by the worker, not here.
    private static async Task<IResult> HandleIpnAsync(string gateway, HttpRequest request, SupabaseRpcClient rpc,
        IPaymentGateway adapter, ILogger<IpnLog> log, CancellationToken ct)
    {
        var fields = request.HasFormContentType
            ? request.Form.ToDictionary(f => f.Key, f => f.Value.ToString())
            : request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());

        var ipn = await adapter.VerifyIpnAsync(fields, ct);
        if (ipn is null)
        {
            log.LogWarning("Rejected IPN from {Gateway}: invalid signature or amount (E-BKG-08)", gateway);
            return Results.BadRequest();
        }

        var payload = JsonSerializer.SerializeToElement(fields);
        if (ipn.Succeeded)
        {
            // Idempotent on gateway_txn_id: a duplicate IPN is a no-op (AC-06).
            await rpc.CallAsync("apply_payment_success", new
            {
                p_order_ref = ipn.OrderRef, p_gateway_txn_id = ipn.GatewayTxnId, p_amount = ipn.Amount, p_payload = payload,
            }, ct);
        }
        else
        {
            await rpc.CallAsync("apply_payment_failure", new
            {
                p_order_ref = ipn.OrderRef, p_reason = ipn.Reason ?? "GATEWAY_FAILED", p_payload = payload,
            }, ct);
        }
        return Results.Ok();
    }

    /// <summary>Log category for IPN handling.</summary>
    public sealed class IpnLog;
}
