using System.Text.Json;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

public sealed record CreatePaymentSessionRequest(Guid BookingId, string Gateway);

public sealed record PaymentSessionResponse(Guid BookingId, string PaymentUrl, DateTimeOffset ExpiresAt);

/// <summary>Shape of begin_payment's "payment" object.</summary>
internal sealed record BeginPaymentResult(JsonElement Booking, BeginPaymentOrder Payment);

internal sealed record BeginPaymentOrder(string OrderRef, long Amount, string Gateway, DateTimeOffset ExpiresAt);

public static class PaymentEndpoints
{
    public static void MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/payments");

        // MT §24 step 1: the app asks for a payment session with the user's own JWT.
        group.MapPost("/sessions", async (CreatePaymentSessionRequest body, HttpContext http,
            SupabaseRpcClient rpc, IPaymentGateway gateway, IConfiguration config, CancellationToken ct) =>
        {
            var jwt = BearerToken(http);
            if (jwt is null) return Results.Unauthorized();

            // begin_payment runs as the user: PostgREST validates the JWT, the RPC checks ownership.
            var result = await rpc.CallAsUserAsync<BeginPaymentResult>("begin_payment",
                new { p_booking_id = body.BookingId, p_gateway = body.Gateway }, jwt, ct);

            var p = result.Payment;
            var returnUrl = new Uri($"{config["Api:PublicUrl"]?.TrimEnd('/')}/payments/return?booking_id={body.BookingId}");
            var url = gateway.BuildPaymentUrl(new PaymentOrder(p.OrderRef, p.Amount, p.Gateway, p.ExpiresAt), returnUrl);
            return Results.Ok(new PaymentSessionResponse(body.BookingId, url.ToString(), p.ExpiresAt));
        });

        // MT §20.5: verify, record, always 200 after recording. Tickets are issued by the worker, not here.
        group.MapPost("/ipn/{gateway}", async (string gateway, HttpRequest request, SupabaseRpcClient rpc,
            IPaymentGateway adapter, ILogger<IpnLog> log, CancellationToken ct) =>
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
        });

        // MT §24 step 3: the gateway sends the customer back here; hand over to the app's deep link.
        // Its parameters are not trusted: the app polls get_booking for the real status.
        group.MapGet("/return", (Guid booking_id, IConfiguration config) =>
            Results.Redirect($"{config["App:PaymentResultDeepLink"]}?booking_id={booking_id}"));
    }

    private static string? BearerToken(HttpContext http)
    {
        var header = http.Request.Headers.Authorization.ToString();
        return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header["Bearer ".Length..].Trim() : null;
    }

    /// <summary>Log category for IPN handling.</summary>
    public sealed class IpnLog;
}
