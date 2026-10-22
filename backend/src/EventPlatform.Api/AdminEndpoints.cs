using System.Text.Json;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

/// <summary>Decision: APPROVE or REJECT; KYC also accepts NEEDS_INFO, event review accepts CHANGES_REQUESTED.</summary>
public sealed record ReviewRequest(string Decision, string? Note);

/// <summary>Action: SUSPEND, UNSUSPEND or TERMINATE.</summary>
public sealed record OrgStatusChangeRequest(string Action, string Reason);

public sealed record ResolveDisputeRequest(string Resolution, int? RefundPercentBp, string? Scope, string? Note);

public sealed record ManualRefundRequest(Guid BookingId, long Amount, string Note, Guid[]? TicketIds);

/// <summary>Action: RETRY or REQUEST_BANK_INFO.</summary>
public sealed record RefundActionRequest(string Action);

public sealed record ManualTransferRequest(string TransferRef);

public sealed record RecordChargebackRequest(Guid PaymentId, string GatewayCaseId, long Amount, string Reason);

/// <summary>Outcome: WON, LOST or ACCEPTED.</summary>
public sealed record ResolveChargebackRequest(string Outcome, string? Note);

public sealed record ProposePayoutRequest(Guid OrgId);

/// <summary>TxnType: PAYMENT, REFUND, PAYOUT or CHARGEBACK; Raw is the gateway's own line, stored as given.</summary>
public sealed record StatementLine(string TxnType, string GatewayTxnId, long Amount, JsonElement? Raw);

public sealed record ImportStatementRequest(string Gateway, DateOnly StatementDate, StatementLine[] Lines);

/// <summary>
/// Admin portal (MT §20.7): KYC and event review, Org status, two-person approvals, disputes, refunds,
/// chargebacks, bank accounts, settlements, payouts, gateway statements and the audit log.
/// The RPCs check the platform role (KYC_REVIEWER, DISPUTE_ADMIN, FINANCE_ADMIN, ...) and TOTP; RLS limits reads
/// to platform members. Approvals need votes from different admins, so one admin cannot push a sensitive change alone.
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/admin").RequireBearer();

        MapReview(admin);
        MapApprovals(admin);
        MapMoney(admin);
    }

    private static void MapReview(RouteGroupBuilder admin)
    {
        admin.MapGet("/organizations", async (string? status, string? q, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("organizations", Query(
                Select("*"), Status(status),
                string.IsNullOrWhiteSpace(q) ? null : $"name=ilike.{Escape($"*{q.Trim()}*")}",
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // Opens a two-person approval; the change happens when it is approved. Returns { approval_id }.
        admin.MapPost("/organizations/{id:guid}/status-change", async (Guid id, OrgStatusChangeRequest body,
            HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var approvalId = await rpc.CallAsUserAsync<Guid>("request_org_status_change", new
            {
                p_org_id = id, p_action = body.Action?.Trim().ToUpperInvariant(), p_reason = body.Reason,
            }, http.Jwt(), ct);
            return Results.Ok(new { approval_id = approvalId });
        });

        admin.MapGet("/kyc-submissions", async (string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("kyc_submissions", Query(
                Select("""
                    id, org_id, status, legal_info, submitted_by, reviewed_by, review_note, submitted_at, reviewed_at,
                    org:organizations(id, name, slug, status),
                    documents:kyc_documents(id, doc_type, storage_path, created_at)
                    """),
                Status(status), "order=submitted_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // KYC_REVIEWER + TOTP. Documents are in the private kyc-private bucket.
        admin.MapPost("/kyc-submissions/{id:guid}/review", async (Guid id, ReviewRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("review_kyc", new
            {
                p_submission_id = id, p_decision = ReviewStatus(body.Decision), p_note = body.Note,
            }, http.Jwt(), ct);
            return Results.NoContent();
        });

        // Default: events waiting for review. Ticket types ride along so the reviewer sees prices and quotas.
        admin.MapGet("/events", async (string? status, int? limit, int? offset, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("events", Query(
                Select("*, org:organizations(id, name, slug), sessions(id, title, starts_at, ends_at, status, " +
                    "ticket_types(id, name, kind, price_amount, quota, visibility, status, sort_order))"),
                Eq("status", string.IsNullOrWhiteSpace(status) ? "PENDING_REVIEW" : status.Trim().ToUpperInvariant()),
                "order=updated_at", Page(limit, offset)), http.Jwt(), ct)));

        admin.MapPost("/events/{id:guid}/review", async (Guid id, ReviewRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("review_event", new
            {
                p_event_id = id, p_decision = ReviewStatus(body.Decision), p_note = body.Note,
            }, http.Jwt(), ct);
            return Results.NoContent();
        });

        // DISPUTE_ADMIN + TOTP. Returns { refunds_created }. Case list / detail / messages: /api/disputes.
        admin.MapPost("/disputes/{id:guid}/resolve", async (Guid id, ResolveDisputeRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("resolve_dispute_case", new
            {
                p_case_id = id, p_resolution = body.Resolution, p_refund_percent_bp = body.RefundPercentBp,
                p_scope = body.Scope ?? "REPORTERS", p_note = body.Note,
            }, http.Jwt(), ct)));

        admin.MapGet("/audit-logs", async (Guid? orgId, string? action, string? targetType, string? targetId,
            int? limit, int? offset, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("audit_logs", Query(
                Select("*"),
                orgId is { } o ? Eq("org_id", o) : null,
                string.IsNullOrWhiteSpace(action) ? null : Eq("action", action.Trim()),
                string.IsNullOrWhiteSpace(targetType) ? null : Eq("target_type", targetType.Trim()),
                string.IsNullOrWhiteSpace(targetId) ? null : Eq("target_id", targetId.Trim()),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));
    }

    private static void MapApprovals(RouteGroupBuilder admin)
    {
        // Default: PENDING. votes shows who already voted, so the portal can hide the buttons for them.
        admin.MapGet("/approvals", async (string? status, string? subjectType, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("approvals", Query(
                Select("*, votes:approval_votes(voter_id, decision, note, created_at)"),
                Eq("status", string.IsNullOrWhiteSpace(status) ? "PENDING" : status.Trim().ToUpperInvariant()),
                string.IsNullOrWhiteSpace(subjectType) ? null : Eq("subject_type", subjectType.Trim()),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        admin.MapGet("/approvals/{id:guid}", async (Guid id, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Single(await db.SelectAsync("approvals", Query(
                Select("*, votes:approval_votes(voter_id, decision, note, created_at)"), Eq("id", id)), http.Jwt(), ct)));

        // Returns { status, approve_votes, required }. Each admin votes once; the requester's own vote is already counted.
        admin.MapPost("/approvals/{id:guid}/votes", async (Guid id, ReviewRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("vote_approval", new
            {
                p_approval_id = id, p_decision = body.Decision?.Trim().ToUpperInvariant(), p_note = body.Note,
            }, http.Jwt(), ct)));
    }

    private static void MapMoney(RouteGroupBuilder admin)
    {
        admin.MapGet("/refunds", async (Guid? orgId, string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("refunds", Query(
                Select("*"), orgId is { } o ? Eq("org_id", o) : null, Status(status),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // The customer's destination for a manual refund; RLS permits FINANCE_ADMIN to read it.
        admin.MapGet("/refunds/{id:guid}/bank-info", async (Guid id, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Single(await db.SelectAsync("refund_bank_infos", Query(
                Select("refund_id, bank_code, account_number, account_holder, otp_verified_at, transferred_at, transfer_ref"),
                Eq("refund_id", id)), http.Jwt(), ct)));

        // Above the threshold it becomes a two-person approval. Returns { refund_id | approval_id, status }.
        admin.MapPost("/refunds", async (ManualRefundRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("create_manual_refund", new
            {
                p_booking_id = body.BookingId, p_amount = body.Amount, p_note = body.Note, p_ticket_ids = body.TicketIds,
            }, http.Jwt(), ct)));

        admin.MapPost("/refunds/{id:guid}/actions", async (Guid id, RefundActionRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var status = await rpc.CallAsUserAsync<string>("admin_refund_action",
                new { p_refund_id = id, p_action = body.Action?.Trim().ToUpperInvariant() }, http.Jwt(), ct);
            return Results.Ok(new { status });
        });

        // After the money was sent by hand to the bank account the customer submitted.
        admin.MapPost("/refunds/{id:guid}/manual-transfer", async (Guid id, ManualTransferRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("confirm_manual_transfer",
                new { p_refund_id = id, p_transfer_ref = body.TransferRef }, http.Jwt(), ct);
            return Results.NoContent();
        });

        admin.MapGet("/chargebacks", async (Guid? orgId, string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("chargebacks", Query(
                Select("*"), orgId is { } o ? Eq("org_id", o) : null, Status(status),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        admin.MapPost("/chargebacks", async (RecordChargebackRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var id = await rpc.CallAsUserAsync<Guid>("record_chargeback", new
            {
                p_payment_id = body.PaymentId, p_gateway_case_id = body.GatewayCaseId, p_amount = body.Amount,
                p_reason = body.Reason,
            }, http.Jwt(), ct);
            return Results.Created($"/api/admin/chargebacks/{id}", new { id });
        });

        admin.MapPost("/chargebacks/{id:guid}/resolve", async (Guid id, ResolveChargebackRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("resolve_chargeback", new
            {
                p_chargeback_id = id, p_outcome = body.Outcome?.Trim().ToUpperInvariant(), p_note = body.Note,
            }, http.Jwt(), ct);
            return Results.NoContent();
        });

        // Default: accounts waiting for review.
        admin.MapGet("/bank-accounts", async (string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("org_bank_accounts", Query(
                Select("*, org:organizations(id, name, slug)"),
                Eq("status", string.IsNullOrWhiteSpace(status) ? "PENDING" : status.Trim().ToUpperInvariant()),
                "order=created_at", Page(limit, offset)), http.Jwt(), ct)));
        admin.MapPost("/bank-accounts/{id:guid}/review", async (Guid id, ReviewRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("review_bank_account", new
            {
                p_bank_account_id = id, p_decision = body.Decision?.Trim().ToUpperInvariant(), p_note = body.Note,
            }, http.Jwt(), ct);
            return Results.NoContent();
        });

        admin.MapPost("/sessions/{id:guid}/settlement", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("recompute_settlement", new { p_session_id = id },
                http.Jwt(), ct)));

        // Platform-wide reconciliation periods (FINANCE_ADMIN / DISPUTE_ADMIN see all via RLS).
        admin.MapGet("/settlements", async (Guid? orgId, string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("settlements", Query(
                Select("*, session:sessions(id, title, starts_at, event:events(id, title))"),
                orgId is { } o ? Eq("tenant_id", o) : null, Status(status),
                "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // Imported gateway statement lines with their match status (FINANCE_ADMIN only).
        admin.MapGet("/gateway-statements", async (string? gateway, DateOnly? date, int? limit, int? offset,
            HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("gateway_statement_lines", Query(
                Select("*"),
                string.IsNullOrWhiteSpace(gateway) ? null : Eq("gateway", gateway.Trim()),
                date is { } d ? Eq("statement_date", d.ToString("yyyy-MM-dd")) : null,
                "order=statement_date.desc,gateway.asc,gateway_txn_id.asc", Page(limit, offset)), http.Jwt(), ct)));

        admin.MapGet("/payouts", async (Guid? orgId, string? status, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("payouts", Query(
                Select("*, org:organizations(id, name, slug)"), orgId is { } o ? Eq("tenant_id", o) : null,
                Status(status), "order=created_at.desc", Page(limit, offset)), http.Jwt(), ct)));

        // The READY balance to the Org's verified account; needs a second FINANCE_ADMIN's vote.
        // Returns { payout_id, approval_id, amount }.
        admin.MapPost("/payouts", async (ProposePayoutRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("propose_payout", new { p_org_id = body.OrgId },
                http.Jwt(), ct)));

        admin.MapPost("/payouts/{id:guid}/cancel", async (Guid id, ReasonRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            await rpc.CallAsUserAsync<JsonElement>("cancel_payout", new { p_payout_id = id, p_reason = body.Reason },
                http.Jwt(), ct);
            return Results.NoContent();
        });

        // Returns { matched, mismatches }. Re-importing the same date is matched again, not duplicated.
        admin.MapPost("/gateway-statements", async (ImportStatementRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("import_gateway_statement", new
            {
                p_gateway = body.Gateway, p_statement_date = body.StatementDate, p_lines = body.Lines,
            }, http.Jwt(), ct)));
    }

    private static string? ReviewStatus(string? decision) => decision?.Trim().ToUpperInvariant() switch
    {
        "APPROVE" => "APPROVED",
        "REJECT" => "REJECTED",
        var value => value,
    };
}
