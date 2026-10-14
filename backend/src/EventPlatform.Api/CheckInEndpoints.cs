using System.Text.Json;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

public sealed record RegisterDeviceRequest(Guid OrgId, string Fingerprint, string Name, string Platform);

/// <summary>ClientScanId is generated on the device and makes a retried scan a no-op.</summary>
public sealed record CheckInRequest(Guid TicketId, Guid SessionId, Guid GateId, Guid DeviceId, string ClientScanId);

public sealed record OfflineScan(string ClientScanId, Guid TicketId, Guid GateId, DateTimeOffset ScannedAt, string? LocalResult);

public sealed record SyncScansRequest(Guid SessionId, Guid DeviceId, OfflineScan[] Scans);

public sealed record ManualCheckInRequest(Guid TicketId, Guid SessionId, Guid GateId, Guid DeviceId, bool IdVerified);

/// <summary>
/// Staff app: device registration, manifest, online / offline / manual check-in, attendee search, gate stats
/// (MT §20.6). The RPCs check the caller's staff assignment, gate and device; DEVICE_REVOKED (403) means the app
/// must wipe its local data.
/// </summary>
public static class CheckInEndpoints
{
    public static void MapCheckInEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireBearer();

        // Idempotent per (org, fingerprint); returns device_id and the QR public keys.
        api.MapPost("/devices", async (RegisterDeviceRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
        {
            // gate_devices.platform is ANDROID or IOS; normalise instead of surfacing a check-constraint error.
            var platform = body.Platform?.Trim().ToUpperInvariant();
            if (platform is not ("ANDROID" or "IOS"))
            {
                return Results.BadRequest(new { message = "VALIDATION_FAILED", details = """{"field":"platform"}""" });
            }
            return Results.Ok(await rpc.CallAsUserAsync<JsonElement>("register_gate_device", new
            {
                p_org_id = body.OrgId, p_fingerprint = body.Fingerprint, p_name = body.Name, p_platform = platform,
            }, http.Jwt(), ct));
        });

        // Full manifest without since; delta (changed tickets + revocations) with since = the last server_now.
        api.MapGet("/sessions/{id:guid}/manifest", async (Guid id, Guid deviceId, DateTimeOffset? since, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("get_session_manifest",
                new { p_session_id = id, p_device_id = deviceId, p_since = since }, http.Jwt(), ct)));

        // Accept / reject with a reason (AC-07/08); the ticket id comes from the verified QR payload.
        api.MapPost("/check-in", async (CheckInRequest body, HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("check_in", new
            {
                p_ticket_id = body.TicketId, p_session_id = body.SessionId, p_gate_id = body.GateId,
                p_device_id = body.DeviceId, p_client_scan_id = body.ClientScanId,
            }, http.Jwt(), ct)));

        // First Write Wins by scanned_at; duplicates come back as DUPLICATE_ENTRY alerts (AC-10).
        api.MapPost("/check-in/sync", async (SyncScansRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("sync_offline_scans",
                new { p_session_id = body.SessionId, p_device_id = body.DeviceId, p_scans = body.Scans }, http.Jwt(), ct)));

        api.MapPost("/check-in/manual", async (ManualCheckInRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("manual_check_in", new
            {
                p_ticket_id = body.TicketId, p_session_id = body.SessionId, p_gate_id = body.GateId,
                p_device_id = body.DeviceId, p_id_verified = body.IdVerified,
            }, http.Jwt(), ct)));

        // q (3+ chars): booking code, last 4+ phone digits or name. Phones come back masked; each search is audited.
        api.MapGet("/sessions/{id:guid}/attendees", async (Guid id, string? q, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("search_attendees",
                new { p_session_id = id, p_query = q ?? "" }, http.Jwt(), ct)));

        api.MapGet("/sessions/{id:guid}/gate-analytics", async (Guid id, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("get_gate_analytics", new { p_session_id = id }, http.Jwt(), ct)));
    }
}
