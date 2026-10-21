using EventPlatform.Core.Supabase;
using EventPlatform.Core.Media;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;

namespace EventPlatform.Api;

/// <summary>
/// POST /api/uploads (multipart: file, purpose, orgId). The API picks the bucket and builds the path the bucket
/// policies expect; the returned path is what submit_report (attachmentPaths), submit_kyc (storage_path) and
/// save_event (public_url for cover image) take. Cloudinary images keep equivalent live Supabase permissions.
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
            HttpContext http, SupabaseStorageClient storage, MediaAuthorization authorization,
            CloudinaryImageClient cloudinary, IOptions<MediaStorageOptions> media, CancellationToken ct) =>
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

            var assetId = Guid.NewGuid();
            var path = $"{folder.Value:D}/{assetId:N}.{extension}";
            await using var content = file.OpenReadStream();
            if (extension != "pdf" && media.Value.UsesCloudinary)
            {
                var userId = await authorization.VerifiedUserAsync(http.Jwt(), ct);
                var ownerId = bucket == "report-evidence" ? userId : folder.Value;
                await authorization.EnsureAsync(bucket, ownerId, userId, http.Jwt(), write: true, ct);
                path = $"{ownerId:D}/cloudinary/{assetId:N}.{extension}";
                var url = await cloudinary.UploadAsync(bucket, ownerId, assetId, content, file.ContentType, ct);
                return Results.Created((string?)null, new { bucket, path, public_url = url });
            }
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

        app.MapPost("/api/uploads/access", async (UploadAccessRequest body, HttpContext http,
            MediaAuthorization authorization, CloudinaryImageClient cloudinary, SupabaseStorageClient storage,
            IOptions<CloudinaryOptions> cloudinaryOptions, TimeProvider time, CancellationToken ct) =>
        {
            // Signed links are capabilities: never cache this response in shared clients/proxies.
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers.Pragma = "no-cache";
            var bucket = body.Purpose?.ToUpperInvariant() switch
            {
                "REPORT_EVIDENCE" => "report-evidence",
                "KYC" => "kyc-private",
                _ => null,
            };
            if (bucket is null) return Invalid("purpose", new { allowed = new[] { "REPORT_EVIDENCE", "KYC" } });
            if (!TryPath(body.Path, out var ownerId, out var parts)) return Invalid("path", null);
            var userId = await authorization.VerifiedUserAsync(http.Jwt(), ct);
            await authorization.EnsureAsync(bucket, ownerId, userId, http.Jwt(), write: false, ct);
            MediaAccess access;
            if (parts.Length > 1 && parts[1] == "cloudinary")
            {
                if (parts.Length != 3 || !Regex.IsMatch(parts[2], @"\A[a-f0-9]{32}\.(jpg|png|webp)\z"))
                    return Invalid("path", null);
                if (!cloudinaryOptions.Value.IsValid)
                    return Results.Json(new { message = "MEDIA_NOT_CONFIGURED" }, statusCode: 503);
                var extension = Path.GetExtension(parts[2])[1..];
                access = cloudinary.PrivateAccess(bucket, ownerId, Guid.ParseExact(Path.GetFileNameWithoutExtension(parts[2]), "N"), extension);
            }
            else
            {
                var url = await storage.SignedUrlAsync(bucket, body.Path!, MediaAccess.LifetimeSeconds, http.Jwt(), ct);
                access = new MediaAccess(url, time.GetUtcNow().AddSeconds(MediaAccess.LifetimeSeconds));
            }
            return Results.Ok(new { url = access.Url, expires_at = access.ExpiresAt });
        }).RequireBearer();
    }

    private static bool TryPath(string? path, out Guid ownerId, out string[] parts)
    {
        ownerId = default;
        parts = path?.Split('/') ?? [];
        return path is { Length: <= 512 } && parts.Length is >= 2 and <= 8
            && Guid.TryParseExact(parts[0], "D", out ownerId)
            && parts[0] == ownerId.ToString("D")
            && parts.All(part => part is not ("." or "..") && Regex.IsMatch(part, @"\A[A-Za-z0-9_.-]+\z"));
    }

    private static IResult Invalid(string field, object? detail) =>
        Results.BadRequest(new
        {
            message = "VALIDATION_FAILED",
            details = System.Text.Json.JsonSerializer.Serialize(new { field, detail }, SupabaseRpcClient.Json),
        });
}

public sealed record UploadAccessRequest(string? Purpose, string? Path);
