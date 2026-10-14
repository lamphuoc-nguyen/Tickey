using System.Text.Json;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

/// <summary>
/// Public catalog: categories, events, sessions, ticket types and seat maps. Works without a token (anon);
/// with one it is forwarded, so Org members also see their own unpublished rows through RLS.
/// </summary>
public static class CatalogEndpoints
{
    private const string EventCard = """
        id, tenant_id, title, slug, summary, cover_image_url, category_id, age_limit, is_featured, status, published_at,
        sessions(id, title, starts_at, ends_at, status)
        """;

    private const string SessionColumns = """
        id, event_id, title, starts_at, ends_at, doors_open_at, sales_start_at, sales_end_at, status, sales_paused,
        max_tickets_per_account, venue:venues(id, name, address_line, ward, district, city, timezone, map_image_url)
        """;

    public static void MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/categories", (HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Rows(db.SelectAsync("categories", Query(Select("id, slug, name, sort_order"), "order=sort_order"),
                Bearer.Token(http), ct)));

        // Published events only, newest first; q searches the title, featured=true for the home banner.
        api.MapGet("/events", (string? q, Guid? categoryId, bool? featured, int? limit, int? offset,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Rows(db.SelectAsync("events", Query(
                Select(EventCard),
                "status=eq.PUBLISHED",
                string.IsNullOrWhiteSpace(q) ? null : $"title=ilike.{Escape($"*{q.Trim()}*")}",
                categoryId is { } c ? Eq("category_id", c) : null,
                featured is true ? "is_featured=is.true" : null,
                "order=is_featured.desc,published_at.desc",
                Page(limit, offset)), Bearer.Token(http), ct)));

        api.MapGet("/events/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("events", Query(
                Select("*, category:categories(id, slug, name)"),
                Eq("id", id)), Bearer.Token(http), ct)));

        api.MapGet("/events/{id:guid}/sessions", (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Rows(db.SelectAsync("sessions", Query(Select(SessionColumns), Eq("event_id", id), "order=starts_at"),
                Bearer.Token(http), ct)));

        api.MapGet("/sessions/{id:guid}/ticket-types", (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Rows(db.SelectAsync("ticket_types", Query(
                Select("""
                    id, session_id, name, description, kind, price_amount, max_per_order, sale_start_at, sale_end_at,
                    refund_policy, refund_deadline_hours, visibility, status, sort_order
                    """),
                Eq("session_id", id), "order=sort_order"), Bearer.Token(http), ct)));

        // Seat map, live availability and per-seat price come from RPCs granted to anon (MT §20.2).
        api.MapGet("/sessions/{id:guid}/layout", (Guid id, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Rpc(rpc, "get_session_layout", id, http, ct));
        api.MapGet("/sessions/{id:guid}/availability", (Guid id, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Rpc(rpc, "get_session_availability", id, http, ct));
        api.MapGet("/sessions/{id:guid}/seat-pricing", (Guid id, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Rpc(rpc, "get_session_seat_pricing", id, http, ct));
    }

    private static async Task<IResult> Rows(Task<JsonElement> rows) => Results.Ok(await rows);

    private static async Task<IResult> Rpc(SupabaseRpcClient rpc, string function, Guid sessionId, HttpContext http,
        CancellationToken ct) =>
        Results.Ok(await rpc.CallAsUserAsync<JsonElement>(function, new { p_session_id = sessionId }, Bearer.Token(http), ct));
}
