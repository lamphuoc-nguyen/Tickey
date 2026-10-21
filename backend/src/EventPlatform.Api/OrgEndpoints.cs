using System.Text.Json;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

public sealed record CreateOrganizationRequest(string Name, string Slug, string? BusinessType);

public sealed record SetOrgMemberRequest(string Email, string[] Roles);

public sealed record KycDocument(string DocType, string StoragePath);

/// <summary>LegalInfo is stored as given. Documents are paths already uploaded with purpose KYC (`<orgId>/...`).</summary>
public sealed record SubmitKycRequest(JsonElement? LegalInfo, string IdentityNumber, KycDocument[] Documents);

public sealed record BankAccountRequest(string BankCode, string AccountNumber, string AccountHolder);

public sealed record CreateLayoutRequest(string Name);

/// <summary>Definition is the seat_map layout ({ zones: [...] }) and is stored unchanged.</summary>
public sealed record SaveLayoutDraftRequest(JsonElement Definition);

public sealed record AssignSeatsRequest(Guid[] SeatIds, Guid TicketTypeId);

/// <summary>Action: HOLD, BLOCK or RELEASE.</summary>
public sealed record SeatStatusRequest(Guid[] SeatIds, string Action, string? Reason);

public sealed record ZoneHeldRequest(int Held);

/// <summary>SeatId for a seated zone, ZoneId + Quantity for general admission.</summary>
public sealed record CompRecipient(string Email, string? Name, string? Phone, Guid? SeatId, Guid? ZoneId, int? Quantity);

public sealed record IssueCompTicketsRequest(Guid TicketTypeId, CompRecipient[] Recipients, string? IdempotencyKey);

public sealed record GateZones(Guid GateId, Guid[] ZoneIds);

public sealed record SetGateZonesRequest(GateZones[] Config);

public sealed record AssignStaffRequest(Guid UserId, string[] Permissions, Guid? GateId, DateTimeOffset? ValidFrom,
    DateTimeOffset? ValidUntil);

public sealed record ReasonRequest(string Reason);

public sealed record DisputeMessageRequest(string Body, JsonElement? Attachments);

/// <summary>
/// Org portal (MT §20.4–20.5): organization, members, KYC, venues and layouts, events / sessions / ticket types,
/// seat control, comp tickets, gates and staff, devices, cancellations, disputes and finance. Every write is an RPC
/// that checks the caller's Org role (and TOTP where the API list marks 🔐); reads go through RLS.
/// Creates take the Org as tenantId in the body, like the RPCs.
/// </summary>
public static class OrgEndpoints
{
    /// <summary>Columns of a booking for the Org order list: the buyer, the session and what was sold.</summary>
    private const string OrderColumns = """
        id, code, status, booking_type, session_id, item_count, list_amount, discount_amount, total_amount,
        currency, buyer_snapshot, created_at, paid_at, confirmed_at, cancelled_at, expired_at, flagged, flag_reason,
        session:sessions(id, title, starts_at, ends_at, event:events(id, title)),
        items:booking_items(id, quantity, unit_price, ticket_type_id, seat_id, zone_id,
            ticket_type:ticket_types(name, kind), seat:seats(seat_code)),
        payments(gateway, amount, status, paid_at)
        """;

    /// <summary>Order detail also shows the issued tickets (the QR a guest carries).</summary>
    private const string OrderDetailColumns = """
        id, code, status, booking_type, session_id, user_id, created_by, item_count, list_amount, discount_amount,
        total_amount, currency, buyer_snapshot, sold_by, created_at, paid_at, confirmed_at, cancelled_at, expired_at,
        flagged, flag_reason,
        session:sessions(id, title, starts_at, ends_at, event:events(id, title)),
        items:booking_items(id, quantity, unit_price, ticket_type_id, seat_id, zone_id,
            ticket_type:ticket_types(name, kind), seat:seats(seat_code)),
        payments(gateway, amount, status, paid_at, initiated_at),
        tickets:tickets(id, status, holder_name, holder_email, ticket_type:ticket_types(name, kind),
            seat:seats(seat_code))
        """;

    /// <summary>The buyer snapshot holds different keys per booking type (CUSTOMER vs COMP / POS).</summary>
    private static readonly string[] BuyerColumns =
    [
        "buyer_snapshot->>full_name", "buyer_snapshot->>email",
        "buyer_snapshot->>holder_name", "buyer_snapshot->>holder_email",
    ];

    public static void MapOrgEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireBearer();

        MapOrganization(api);
        MapVenues(api);
        MapEvents(api);
        MapSeatsAndStaff(api);
        MapDisputes(api);
        MapFinance(api);
        MapOrders(api);
    }

    private static void MapOrganization(RouteGroupBuilder api)
    {
        // The caller becomes OWNER of a DRAFT Org; switch to it with PUT /api/workspaces/active.
        api.MapPost("/organizations", async (CreateOrganizationRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var id = await rpc.CallAsUserAsync<Guid>("create_organization", new
            {
                p_name = body.Name, p_slug = body.Slug, p_business_type = body.BusinessType ?? "COMPANY",
            }, http.Jwt(), ct);
            return Results.Created($"/api/organizations/{id}", new { id });
        });

        api.MapGet("/organizations/{orgId:guid}", async (Guid orgId, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Single(await db.SelectAsync("organizations", Query(Select("*"), Eq("id", orgId)), http.Jwt(), ct)));

        api.MapGet("/organizations/{orgId:guid}/members", async (Guid orgId, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("memberships", Query(
                Select("id, user_id, scope, org_id, roles, status, invited_by, created_at, updated_at, profile:profiles!memberships_user_id_fkey(full_name, phone)"),
                Eq("org_id", orgId), "order=created_at"), http.Jwt(), ct)));

        // Adds or updates a member by email (the user must have signed up). Empty roles removes them. OWNER + TOTP.
        api.MapPut("/organizations/{orgId:guid}/members", async (Guid orgId, SetOrgMemberRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("set_org_member",
                new { p_org_id = orgId, p_email = body.Email, p_roles = body.Roles }, http.Jwt(), ct)));

        // From DRAFT / NEEDS_INFO / REJECTED; the Org moves to PENDING_REVIEW. OWNER + TOTP.
        api.MapPost("/organizations/{orgId:guid}/kyc", async (Guid orgId, SubmitKycRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var id = await rpc.CallAsUserAsync<Guid>("submit_kyc", new
            {
                p_org_id = orgId,
                p_legal_info = body.LegalInfo,
                p_identity_number = body.IdentityNumber,
                p_documents = body.Documents,
            }, http.Jwt(), ct);
            return Results.Created($"/api/organizations/{orgId}/kyc/{id}", new { id });
        });

        api.MapGet("/organizations/{orgId:guid}/kyc", async (Guid orgId, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("kyc_submissions", Query(
                Select("""
                    id, org_id, status, legal_info, submitted_by, reviewed_by, review_note, submitted_at, reviewed_at,
                    documents:kyc_documents(id, doc_type, storage_path, created_at)
                    """),
                Eq("org_id", orgId), "order=submitted_at.desc"), http.Jwt(), ct)));

        // All the Org's events, any status (the public /api/events shows PUBLISHED only).
        api.MapGet("/organizations/{orgId:guid}/events", async (Guid orgId, string? status, int? limit, int? offset,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("events", Query(
                Select("*, sessions(id, title, starts_at, ends_at, doors_open_at, sales_start_at, sales_end_at, max_tickets_per_account, status, sales_paused, sales_paused_reason, layout_version_id, venue:venues(id, name, timezone))"),
                Eq("tenant_id", orgId), Status(status), "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        api.MapGet("/organizations/{orgId:guid}/devices", async (Guid orgId, string? status, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("gate_devices", Query(
                Select("*"), Eq("tenant_id", orgId), Status(status), "order=created_at.desc"), http.Jwt(), ct)));

        api.MapPost("/devices/{id:guid}/revoke", async (Guid id, ReasonRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("revoke_gate_device", new { p_device_id = id, p_reason = body.Reason },
                http.Jwt(), ct);
            return Results.NoContent();
        });
    }

    private static void MapVenues(RouteGroupBuilder api)
    {
        api.MapGet("/organizations/{orgId:guid}/venues", async (Guid orgId, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("venues", Query(Select("*"), Eq("tenant_id", orgId), "order=name"),
                http.Jwt(), ct)));

        api.MapGet("/venues/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("venues", Query(
                Select("""
                    *, gates(id, code, name, status),
                    layouts(id, name, created_at, versions:layout_versions!layout_versions_layout_id_tenant_id_fkey(id, version_no, status, total_capacity, published_at))
                    """),
                Eq("id", id)), http.Jwt(), ct)));

        // Body: { tenantId, name, venueType, addressLine, ward, district, city, timezone, capacity, ... }.
        api.MapPost("/venues", (JsonElement body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Save(rpc, "save_venue", "/api/venues", SnakeKeys(body), http, ct));
        api.MapPut("/venues/{id:guid}", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) => Save(rpc, "save_venue", null, SnakeKeys(body, id), http, ct));

        // Returns { layout_id, layout_version_id } with an empty DRAFT version.
        // Body: { code, name }. Gate codes are unique per Venue (upper-cased).
        api.MapPost("/venues/{id:guid}/gates", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var p = SnakeKeys(body);
            p["venue_id"] = id.ToString("D");
            return Save(rpc, "save_gate", "/api/gates", p, http, ct);
        });
        // Body: { code?, name?, status? } — status ARCHIVED takes the gate out of use.
        api.MapPut("/gates/{id:guid}", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) => Save(rpc, "save_gate", null, SnakeKeys(body, id), http, ct));

        api.MapPost("/venues/{id:guid}/layouts", async (Guid id, CreateLayoutRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("create_layout",
                new { p_venue_id = id, p_name = body.Name }, http.Jwt(), ct)));

        api.MapGet("/layout-versions/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Single(await db.SelectAsync("layout_versions", Query(
                Select("*, zones!zones_layout_version_id_fkey(id, code, name, kind, capacity, color, sort_order)"),
                Eq("id", id)), http.Jwt(), ct)));

        // DRAFT only (INVALID_STATE otherwise); a published layout is edited through a new version.
        api.MapPut("/layout-versions/{id:guid}/draft", async (Guid id, SaveLayoutDraftRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("save_layout_draft",
                new { p_layout_version_id = id, p_definition = body.Definition }, http.Jwt(), ct);
            return Results.NoContent();
        });

        api.MapPost("/layouts/{id:guid}/versions", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var versionId = await rpc.CallAsUserAsync<Guid>("new_layout_version", new { p_layout_id = id }, http.Jwt(), ct);
            return Results.Created($"/api/layout-versions/{versionId}", new { id = versionId });
        });

        api.MapPost("/layout-versions/{id:guid}/publish", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("publish_layout_version",
                new { p_layout_version_id = id }, http.Jwt(), ct)));
    }

    private static void MapEvents(RouteGroupBuilder api)
    {
        // Body: { tenantId, title, slug, summary, description, categoryId, coverImageUrl, ageLimit, terms }.
        api.MapPost("/events", (JsonElement body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Save(rpc, "save_event", "/api/events", SnakeKeys(body), http, ct));
        api.MapPut("/events/{id:guid}", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) => Save(rpc, "save_event", null, SnakeKeys(body, id), http, ct));

        api.MapPost("/events/{id:guid}/submit", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("submit_event_for_review", new { p_event_id = id },
                http.Jwt(), ct)));

        // Opens a two-person approval per Session (OWNER or Admin + TOTP). Returns { request_ids }.
        api.MapPost("/events/{id:guid}/cancellation", async (Guid id, ReasonRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("request_event_cancellation",
                new { p_event_id = id, p_reason = body.Reason }, http.Jwt(), ct)));

        // Body: { eventId, venueId, layoutVersionId, title, startsAt, endsAt, doorsOpenAt, salesStartAt, salesEndAt,
        //         maxTicketsPerAccount, reportWindowHours }.
        api.MapPost("/sessions", (JsonElement body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Save(rpc, "save_session", "/api/sessions", SnakeKeys(body), http, ct));
        api.MapPut("/sessions/{id:guid}", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) => Save(rpc, "save_session", null, SnakeKeys(body, id), http, ct));

        api.MapPost("/sessions/{id:guid}/cancellation", async (Guid id, ReasonRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var requestId = await rpc.CallAsUserAsync<Guid>("request_session_cancellation",
                new { p_session_id = id, p_reason = body.Reason }, http.Jwt(), ct);
            return Results.Ok(new { request_id = requestId });
        });

        // Body: { sessionId, name, kind, priceAmount, quota, maxPerOrder, refundPolicy, visibility, status, zoneIds, ... }.
        api.MapPost("/ticket-types", (JsonElement body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Save(rpc, "save_ticket_type", "/api/ticket-types", SnakeKeys(body), http, ct));
        api.MapPut("/ticket-types/{id:guid}", (Guid id, JsonElement body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) => Save(rpc, "save_ticket_type", null, SnakeKeys(body, id), http, ct));
    }

    private static void MapSeatsAndStaff(RouteGroupBuilder api)
    {
        // Org view of a Session's ticket types: any visibility/status, with zones, quota, locked and sold.
        // (GET /api/sessions/{id}/ticket-types is the customer view: public and on sale only.)
        api.MapGet("/sessions/{id:guid}/ticket-types/manage", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("ticket_types", Query(
                Select("*, zones:ticket_type_zones(zone_id), inventory:ticket_type_inventory(quota, locked, sold)"),
                Eq("session_id", id), "order=sort_order"), http.Jwt(), ct)));

        // Every seat of the Session with its status and assigned ticket type (seat pricing / hold / block).
        api.MapGet("/sessions/{id:guid}/seats", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("session_seats", Query(
                Select("seat_id, zone_id, ticket_type_id, status, hold_reason, seat:seats(seat_code, row_label, seat_number, x, y)"),
                Eq("session_id", id), "limit=20000"), http.Jwt(), ct)));

        // Standing zones of the Session: capacity, locked, sold and the Org's held count.
        api.MapGet("/sessions/{id:guid}/zone-inventory", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("session_zone_inventory", Query(
                Select("zone_id, capacity, locked, sold, held"), Eq("session_id", id)), http.Jwt(), ct)));

        // Returns { updated, requested }.
        api.MapPut("/sessions/{id:guid}/seats/ticket-type", async (Guid id, AssignSeatsRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("assign_seats_ticket_type",
                new { p_session_id = id, p_seat_ids = body.SeatIds, p_ticket_type_id = body.TicketTypeId }, http.Jwt(), ct)));

        // Returns { updated, conflict_seat_ids } (seats locked / sold are skipped, not an error).
        api.MapPut("/sessions/{id:guid}/seats/status", async (Guid id, SeatStatusRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("set_session_seat_status", new
            {
                p_session_id = id, p_seat_ids = body.SeatIds, p_action = body.Action?.Trim().ToUpperInvariant(),
                p_reason = body.Reason,
            }, http.Jwt(), ct)));

        // General-admission zones: how many places are held back from sale.
        api.MapPut("/sessions/{id:guid}/zones/{zoneId:guid}/held", async (Guid id, Guid zoneId, ZoneHeldRequest body,
            HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("set_zone_held",
                new { p_session_id = id, p_zone_id = zoneId, p_held = body.Held }, http.Jwt(), ct);
            return Results.NoContent();
        });

        // Up to 500 recipients; idempotency key in the body or the Idempotency-Key header. Returns { bookings, remaining }.
        api.MapPost("/sessions/{id:guid}/comp-tickets", async (Guid id, IssueCompTicketsRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var key = body.IdempotencyKey ?? http.Request.Headers["Idempotency-Key"].ToString();
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { message = "VALIDATION_FAILED", details = """{"field":"idempotency_key"}""" });
            }
            return Results.Ok(await rpc.CallAsUserAsync<JsonElement>("issue_comp_tickets", new
            {
                p_session_id = id, p_ticket_type_id = body.TicketTypeId, p_recipients = body.Recipients,
                p_idempotency_key = key.Trim(),
            }, http.Jwt(), ct));
        });

        api.MapGet("/sessions/{id:guid}/gate-zones", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("session_gate_zones", Query(Select("*"), Eq("session_id", id)), http.Jwt(), ct)));

        // Replaces the whole gate → zones mapping of the Session.
        api.MapPut("/sessions/{id:guid}/gate-zones", async (Guid id, SetGateZonesRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("set_session_gate_zones",
                new { p_session_id = id, p_config = body.Config }, http.Jwt(), ct);
            return Results.NoContent();
        });

        api.MapGet("/sessions/{id:guid}/staff-assignments", async (Guid id, string? status, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("staff_assignments", Query(
                Select("*, gate:gates(id, code, name)"), Eq("session_id", id), Status(status), "order=created_at"),
                http.Jwt(), ct)));

        // Permissions: SCAN, MANUAL_CHECKIN, POS, VIEW_ANALYTICS.
        api.MapPost("/sessions/{id:guid}/staff-assignments", async (Guid id, AssignStaffRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var assignmentId = await rpc.CallAsUserAsync<Guid>("assign_staff", new
            {
                p_session_id = id, p_user_id = body.UserId, p_permissions = body.Permissions, p_gate_id = body.GateId,
                p_valid_from = body.ValidFrom, p_valid_until = body.ValidUntil,
            }, http.Jwt(), ct);
            return Results.Created($"/api/staff-assignments/{assignmentId}", new { id = assignmentId });
        });

        api.MapDelete("/staff-assignments/{id:guid}", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("revoke_staff_assignment", new { p_assignment_id = id }, http.Jwt(), ct);
            return Results.NoContent();
        });
    }

    private static void MapDisputes(RouteGroupBuilder api)
    {
        // Org members see their Org's cases, DISPUTE_ADMIN sees all (RLS).
        api.MapGet("/disputes", async (Guid? orgId, string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("dispute_cases", Query(
                Select("*, session:sessions(id, title, starts_at, event:events(id, title))"),
                orgId is { } o ? Eq("org_id", o) : null, Status(status),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        api.MapGet("/disputes/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("dispute_cases", Query(
                Select("""
                    *, session:sessions(id, title, starts_at, event:events(id, title)),
                    messages:dispute_messages(id, author_id, author_side, body, attachments, created_at),
                    reports(id, ticket_id, category, description, status, created_at)
                    """),
                Eq("id", id), "messages.order=created_at"), http.Jwt(), ct)));

        api.MapPost("/disputes/{id:guid}/messages", async (Guid id, DisputeMessageRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var messageId = await rpc.CallAsUserAsync<Guid>("add_dispute_message",
                new { p_case_id = id, p_body = body.Body, p_attachments = body.Attachments }, http.Jwt(), ct);
            return Results.Ok(new { id = messageId });
        });
    }

    private static void MapFinance(RouteGroupBuilder api)
    {
        // { ledger_balance, held, ready, paid_out, in_progress, active_holds }. OWNER / FINANCE or Admin.
        api.MapGet("/organizations/{orgId:guid}/finance", async (Guid orgId, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("get_org_finance_summary", new { p_org_id = orgId },
                http.Jwt(), ct)));

        api.MapGet("/organizations/{orgId:guid}/settlements", async (Guid orgId, int? limit, int? offset,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("settlements", Query(
                Select("*, session:sessions(id, title, starts_at)"), Eq("tenant_id", orgId),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        api.MapGet("/organizations/{orgId:guid}/payouts", async (Guid orgId, string? status, int? limit, int? offset,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("payouts", Query(
                Select("*"), Eq("tenant_id", orgId), Status(status), "order=created_at.desc", Page(limit, offset)),
                http.Jwt(), ct)));

        api.MapGet("/organizations/{orgId:guid}/bank-accounts", async (Guid orgId, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("org_bank_accounts", Query(
                Select("*"), Eq("org_id", orgId), "order=created_at.desc"), http.Jwt(), ct)));

        // A new account waits for FINANCE_ADMIN review before payouts use it. OWNER + TOTP.
        api.MapPost("/organizations/{orgId:guid}/bank-accounts", async (Guid orgId, BankAccountRequest body,
            HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var id = await rpc.CallAsUserAsync<Guid>("request_bank_account_change", new
            {
                p_org_id = orgId, p_bank_code = body.BankCode, p_account_number = body.AccountNumber,
                p_account_holder = body.AccountHolder,
            }, http.Jwt(), ct);
            return Results.Created($"/api/organizations/{orgId}/bank-accounts/{id}", new { id });
        });
    }

    /// <summary>
    /// Đơn vé (bookings) của Org: khách hàng đã mua và vé mời COMP đã phát. Đọc qua RLS (OWNER / FINANCE /
    /// EVENT_MANAGER / GATE_MANAGER); vé mời được phát bằng issue_comp_tickets.
    /// </summary>
    private static void MapOrders(RouteGroupBuilder api)
    {
        // Đơn vé của Org. type: CUSTOMER | COMP | POS | B2B. q tìm theo mã đơn, tên và email người mua.
        api.MapGet("/organizations/{orgId:guid}/orders", async (Guid orgId, string? status, string? type, string? q,
            int? limit, int? offset, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("bookings", Query(
                Select(OrderColumns), Eq("tenant_id", orgId), Status(status), EqUpper("booking_type", type),
                Search(q, new[] { "code" }.Concat(BuyerColumns).ToArray()),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // Chi tiết một đơn vé: gồm vé đã phát (mã QR) và lịch sử thanh toán.
        api.MapGet("/organizations/{orgId:guid}/orders/{bookingId:guid}", async (Guid orgId, Guid bookingId,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("bookings", Query(
                Select(OrderDetailColumns), Eq("tenant_id", orgId), Eq("id", bookingId)), http.Jwt(), ct)));

        // Vé mời (COMP) đã phát của Org, mới nhất trước.
        api.MapGet("/organizations/{orgId:guid}/comp-tickets", async (Guid orgId, Guid? sessionId, string? status,
            int? limit, int? offset, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("bookings", Query(
                Select(OrderColumns), Eq("tenant_id", orgId), Eq("booking_type", "COMP"),
                sessionId is { } session ? Eq("session_id", session) : null, Status(status),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));
    }

    /// <summary>save_* RPC: 201 + Location on create (no id), 200 on update; both return { id }.</summary>
    private static async Task<IResult> Save(SupabaseRpcClient rpc, string function, string? createdAt,
        System.Text.Json.Nodes.JsonObject p, HttpContext http, CancellationToken ct)
    {
        var id = await rpc.CallAsUserAsync<Guid>(function, new { p }, http.Jwt(), ct);
        return createdAt is null ? Results.Ok(new { id }) : Results.Created($"{createdAt}/{id}", new { id });
    }
}
