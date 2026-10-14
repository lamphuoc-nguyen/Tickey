using System.Text.Json;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

/// <summary>AttachmentPaths are object paths already uploaded to the report-evidence bucket.</summary>
public sealed record SubmitReportRequest(Guid TicketId, string Category, string Description, string[]? AttachmentPaths);

public sealed record CreateSupportRequest(string Category, string Subject, string Body, Guid? BookingId);

public sealed record SupportMessageRequest(string Body);

public sealed record RefundBankInfoRequest(string BankCode, string AccountNumber, string AccountHolder);

/// <summary>Customer side of reports, support requests and refunds. Lists show what RLS lets the caller see.</summary>
public static class SupportEndpoints
{
    public static void MapSupportEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireBearer();

        api.MapGet("/reports", async (int? limit, int? offset, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("reports", Query(
                Select("id, org_id, session_id, ticket_id, category, description, status, dispute_case_id, created_at, updated_at"),
                "order=created_at.desc",
                Page(limit, offset)), http.Jwt(), ct)));

        // Within REPORT_WINDOW after the Session, for an ISSUED / USED / NO_SHOW ticket the caller owns.
        api.MapPost("/reports", async (SubmitReportRequest body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("submit_report", new
            {
                p_ticket_id = body.TicketId,
                p_category = body.Category,
                p_description = body.Description,
                p_attachment_paths = body.AttachmentPaths ?? [],
            }, http.Jwt(), ct)));

        api.MapGet("/support-requests", async (int? limit, int? offset, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("support_requests", Query(
                Select("""
                    id, booking_id, org_id, category, subject, status, created_at, updated_at,
                    messages:support_messages(id, author_id, author_side, body, created_at)
                    """),
                "order=created_at.desc",
                "messages.order=created_at",
                Page(limit, offset)), http.Jwt(), ct)));

        api.MapPost("/support-requests", async (CreateSupportRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            var id = await rpc.CallAsUserAsync<Guid>("create_support_request", new
            {
                p_category = body.Category, p_subject = body.Subject, p_body = body.Body, p_booking_id = body.BookingId,
            }, http.Jwt(), ct);
            return Results.Created($"/api/support-requests/{id}", new { id });
        });

        api.MapPost("/support-requests/{id:guid}/messages", async (Guid id, SupportMessageRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var messageId = await rpc.CallAsUserAsync<Guid>("add_support_message",
                new { p_request_id = id, p_body = body.Body }, http.Jwt(), ct);
            return Results.Ok(new { id = messageId });
        });

        api.MapGet("/refunds", async (string? status, int? limit, int? offset, HttpContext http, SupabaseRestClient db,
            CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("refunds", Query(
                Select("id, booking_id, amount, reason, source_type, status, created_at, updated_at, succeeded_at"),
                string.IsNullOrWhiteSpace(status) ? null : Eq("status", status.Trim().ToUpperInvariant()),
                "order=created_at.desc",
                Page(limit, offset)), http.Jwt(), ct)));

        // For AWAITING_BANK_INFO refunds. Needs a recent OTP in the token (OTP_REQUIRED otherwise):
        // POST /api/auth/otp, then /api/auth/otp/verify, then retry with the new access token.
        api.MapPost("/refunds/{id:guid}/bank-info", async (Guid id, RefundBankInfoRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var approvalId = await rpc.CallAsUserAsync<Guid?>("submit_refund_bank_info", new
            {
                p_refund_id = id, p_bank_code = body.BankCode, p_account_number = body.AccountNumber,
                p_account_holder = body.AccountHolder,
            }, http.Jwt(), ct);
            return Results.Ok(new { approval_id = approvalId });
        });
    }
}
