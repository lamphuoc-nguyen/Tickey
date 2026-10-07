using System.Net;
using System.Text.Json;

namespace EventPlatform.Core.Supabase;

/// <summary>
/// An RPC error from PostgREST. For app_error() the message is the error code from
/// supabase/README.md (SEAT_CONFLICT, INVALID_STATE, ...) and Details is its JSON detail.
/// </summary>
public sealed class RpcException : Exception
{
    public RpcException(HttpStatusCode status, string message, string? details, string? pgCode)
        : base(message)
    {
        Status = status;
        Details = details;
        PgCode = pgCode;
    }

    public HttpStatusCode Status { get; }
    public string? Details { get; }
    public string? PgCode { get; }

    /// <summary>True for errors raised by app_error() (SQLSTATE P0001).</summary>
    public bool IsAppError => PgCode == "P0001";

    public static RpcException FromResponse(HttpStatusCode status, string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            return new RpcException(status,
                root.TryGetProperty("message", out var m) ? m.GetString() ?? "UNKNOWN" : "UNKNOWN",
                root.TryGetProperty("details", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : null,
                root.TryGetProperty("code", out var c) ? c.GetString() : null);
        }
        catch (JsonException)
        {
            return new RpcException(status, $"HTTP {(int)status}", body, null);
        }
    }
}
