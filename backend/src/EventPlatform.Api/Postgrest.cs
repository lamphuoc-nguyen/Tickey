using System.Net;
using System.Text.Json;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

/// <summary>Builds PostgREST query strings and maps RPC errors to HTTP status codes.</summary>
public static class Postgrest
{
    /// <summary>select=... with whitespace removed, so embeds can be written over several lines.</summary>
    public static string Select(string columns) => "select=" + string.Concat(columns.Where(c => !char.IsWhiteSpace(c)));

    public static string Eq(string column, object value) => $"{column}=eq.{Escape(value)}";

    public static string Page(int? limit, int? offset) =>
        $"limit={Math.Clamp(limit ?? 20, 1, 100)}&offset={Math.Max(offset ?? 0, 0)}";

    public static string Query(params string?[] parts) => string.Join('&', parts.Where(p => !string.IsNullOrEmpty(p)));

    public static string Escape(object value) =>
        Uri.EscapeDataString(value is Guid g ? g.ToString("D") : Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture)!);

    /// <summary>200 with the first row, or 404 { message: "NOT_FOUND" } when RLS shows none.</summary>
    public static IResult Single(JsonElement rows) =>
        rows.ValueKind == JsonValueKind.Array && rows.GetArrayLength() > 0
            ? Results.Ok(rows[0])
            : Results.NotFound(new { message = "NOT_FOUND" });

    /// <summary>
    /// HTTP status for an RPC / PostgREST error. The body keeps the database contract
    /// { message: CODE, details: "<json>" } (supabase/README.md), so clients branch on message, not status.
    /// </summary>
    public static int StatusFor(RpcException e)
    {
        if (e.Status == HttpStatusCode.Unauthorized) return StatusCodes.Status401Unauthorized;
        if (!e.IsAppError) return e.Status == HttpStatusCode.BadRequest ? StatusCodes.Status400BadRequest : StatusCodes.Status502BadGateway;
        return e.Message switch
        {
            "UNAUTHENTICATED" => StatusCodes.Status401Unauthorized,
            "FORBIDDEN" or "MFA_REQUIRED" or "OTP_REQUIRED" or "DEVICE_REVOKED" => StatusCodes.Status403Forbidden,
            "NOT_FOUND" => StatusCodes.Status404NotFound,
            "INVALID_STATE" or "SESSION_NOT_ON_SALE" or "SEAT_CONFLICT" or "SOLD_OUT" or "LIMIT_EXCEEDED"
                or "BOOKING_EXPIRED" or "IMMUTABLE_ROW" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        };
    }
}
