using System.Text.Json;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

/// <summary>One line of create_booking: a seat (seat_id, quantity 1) or standing places (zone_id + quantity).</summary>
public sealed record BookingItemRequest(Guid TicketTypeId, Guid? SeatId, Guid? ZoneId, int? Quantity);

/// <summary>
/// create_booking's p_options. BookingType defaults to CUSTOMER; Staff POS sends "POS" with the buyer's details.
/// Comp tickets use POST /api/sessions/{id}/comp-tickets (Org portal), not this.
/// </summary>
public sealed record BookingOptions(string? BookingType, Guid? CorporateAccountId, string? BuyerName, string? BuyerPhone,
    string? BuyerEmail);

/// <summary>IdempotencyKey (8+ chars) may also come as the Idempotency-Key header; a retry returns the same Booking.</summary>
public sealed record CreateBookingRequest(Guid SessionId, BookingItemRequest[] Items, string? IdempotencyKey,
    BookingOptions? Options);

public sealed record StartPaymentRequest(string Gateway);

public sealed record AssignHolderRequest(string Name, string? Email, string? Phone);

/// <summary>Customer bookings and tickets (MT §20.3, §24). Writes go through the booking RPCs as the caller.</summary>
public static class BookingEndpoints
{
    private const string TicketColumns = """
        id, booking_id, session_id, ticket_type_id, zone_id, seat_id, holder_name, holder_email, holder_phone,
        status, used_at, issued_at,
        credential:ticket_credentials(kid, payload, signature),
        seat:seats(seat_code),
        ticket_type:ticket_types(name, kind),
        session:sessions(id, title, starts_at, ends_at, doors_open_at, status,
                         event:events(id, title, cover_image_url),
                         venue:venues(id, name, address_line, city, timezone))
        """;

    public static void MapBookingEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireBearer();

        // "My bookings": bookings the caller holds or created (RLS would also show an Org's bookings to its staff).
        api.MapGet("/bookings", async (string? status, int? limit, int? offset, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
        {
            var me = http.UserId();
            return Results.Ok(await db.SelectAsync("bookings", Query(
                Select("""
                    id, code, status, booking_type, session_id, item_count, list_amount, discount_amount, total_amount,
                    currency, lock_expires_at, payment_deadline_at, paid_at, confirmed_at, cancelled_at, created_at,
                    session:sessions(id, title, starts_at, event:events(id, title, cover_image_url))
                    """),
                $"or=(user_id.eq.{me:D},created_by.eq.{me:D})",
                string.IsNullOrWhiteSpace(status) ? null : Eq("status", status.Trim().ToUpperInvariant()),
                "order=created_at.desc",
                Page(limit, offset)), http.Jwt(), ct));
        });

        api.MapGet("/bookings/{id:guid}", async (Guid id, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("get_booking", new { p_booking_id = id }, http.Jwt(), ct)));

        // Holds the seats / places all-or-nothing; SEAT_CONFLICT details list the seats that were taken (AC-01/02).
        api.MapPost("/bookings", async (CreateBookingRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var key = body.IdempotencyKey ?? http.Request.Headers["Idempotency-Key"].ToString();
            var booking = await rpc.CallAsUserAsync<JsonElement>("create_booking", new
            {
                p_session_id = body.SessionId,
                p_items = body.Items,
                p_idempotency_key = key,
                p_options = body.Options ?? new BookingOptions(null, null, null, null, null),
            }, http.Jwt(), ct);
            return Results.Created($"/api/bookings/{booking.GetProperty("id").GetString()}", booking);
        });

        // Only PENDING bookings: PAYMENT_PENDING may already have money on the way (INVALID_STATE).
        api.MapDelete("/bookings/{id:guid}", async (Guid id, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("cancel_booking", new { p_booking_id = id }, http.Jwt(), ct)));

        api.MapPost("/bookings/{id:guid}/payment", (Guid id, StartPaymentRequest body, HttpContext http,
            SupabaseRpcClient rpc, IPaymentGateway gateway, IConfiguration config, CancellationToken ct) =>
            PaymentEndpoints.CreateSessionAsync(id, body.Gateway, http.Jwt(), rpc, gateway, config, ct));

        // "My tickets" with the signed QR credential; the app renders the QR from kid + payload + signature.
        api.MapGet("/tickets", async (string? status, int? limit, int? offset, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("tickets", Query(
                Select(TicketColumns),
                Eq("owner_id", http.UserId()),
                string.IsNullOrWhiteSpace(status) ? null : Eq("status", status.Trim().ToUpperInvariant()),
                "order=issued_at.desc.nullslast",
                Page(limit, offset)), http.Jwt(), ct)));

        api.MapGet("/tickets/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("tickets", Query(Select(TicketColumns), Eq("id", id)), http.Jwt(), ct)));

        api.MapPut("/tickets/{id:guid}/holder", async (Guid id, AssignHolderRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("assign_ticket_holder", new
            {
                p_ticket_id = id, p_name = body.Name, p_email = body.Email, p_phone = body.Phone,
            }, http.Jwt(), ct);
            return Results.NoContent();
        });
    }
}
