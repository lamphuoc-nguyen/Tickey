using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Mvc;

namespace EventPlatform.Api;

/// <summary>
/// POST /api/uploads (multipart: file, purpose, orgId). The API picks the bucket and builds the path the bucket
/// policies expect; the returned path is what submit_report (attachmentPaths), submit_kyc (storage_path) and
/// save_event (cover image) take.
/// </summary>
public static class UploadEndpoints
{
    public const long MaxBytes = 10 * 1024 * 1024;

    private static readonly Dictionary<string, string> Extensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
        ["application/pdf"] = "pdf",
    };

    public static void MapUploadEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/uploads", async (IFormFile file, [FromForm] string purpose, [FromForm] Guid? orgId,
            HttpContext http, SupabaseStorageClient storage, CancellationToken ct) =>
        {
            if (file.Length is 0 or > MaxBytes)
            {
                return Invalid("file", new { max_bytes = MaxBytes });
            }
            if (!Extensions.TryGetValue(file.ContentType, out var extension))
            {
                return Invalid("file", new { allowed = Extensions.Keys });
            }

            // REPORT_EVIDENCE: <user_id>/...; KYC and EVENT_ASSET: <org_id>/... (migration part 1300).
            (string? bucket, Guid? folder) = purpose.ToUpperInvariant() switch
            {
                "REPORT_EVIDENCE" => ("report-evidence", http.UserId()),
                "KYC" => ("kyc-private", orgId),
                "EVENT_ASSET" => ("event-assets", orgId),
                _ => (null, null),
            };
            if (bucket is null) return Invalid("purpose", new { allowed = new[] { "REPORT_EVIDENCE", "KYC", "EVENT_ASSET" } });
            if (folder is null) return Invalid("orgId", null);

            var path = $"{folder.Value:D}/{Guid.NewGuid():N}.{extension}";
            await using var content = file.OpenReadStream();
            await storage.UploadAsync(bucket, path, content, file.ContentType, http.Jwt(), ct);

            return Results.Created((string?)null, new
            {
                bucket,
                path,
                public_url = bucket == "event-assets" ? storage.PublicUrl(bucket, path) : null,
            });
        })
        .RequireBearer()
        .DisableAntiforgery()
        .WithMetadata(new RequestSizeLimitAttribute(MaxBytes + 64 * 1024));
    }

    private static IResult Invalid(string field, object? detail) =>
        Results.BadRequest(new
        {
            message = "VALIDATION_FAILED",
            details = System.Text.Json.JsonSerializer.Serialize(new { field, detail }, SupabaseRpcClient.Json),
        });
}
