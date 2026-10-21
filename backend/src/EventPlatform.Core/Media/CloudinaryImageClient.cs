using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Media;

/// <summary>Server-to-server signed uploads. Never returns secrets/signatures or retries an uncertain upload.</summary>
public sealed class CloudinaryImageClient(HttpClient http, IOptions<CloudinaryOptions> options, TimeProvider time)
{
    private readonly CloudinaryOptions _options = options.Value;
    private static readonly Dictionary<string, string> ImageFormats = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
    };

    public async Task<string?> UploadAsync(string bucket, Guid ownerId, Guid assetId, Stream content, string contentType,
        CancellationToken ct = default)
    {
        if (!_options.IsValid) throw new InvalidOperationException("Cloudinary configuration is incomplete.");
        if (!ImageFormats.TryGetValue(contentType, out var format))
            throw RpcException.App(HttpStatusCode.BadRequest, "VALIDATION_FAILED", """{"field":"file"}""");

        var publicId = PublicId(bucket, ownerId, assetId);
        var deliveryType = bucket == "event-assets" ? "upload" : "authenticated";
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["allowed_formats"] = "jpg,png,webp",
            // In dynamic-folder environments, slashes in public_id do not organize the Media Library.
            // Set the actual asset folder explicitly while keeping stable public IDs and private access paths.
            ["asset_folder"] = $"{_options.PublicIdPrefix}/{bucket}/{ownerId:D}",
            ["overwrite"] = "false",
            ["public_id"] = publicId,
            ["timestamp"] = time.GetUtcNow().ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            ["type"] = deliveryType,
        };
        // Cloudinary signs sorted name=value pairs plus the API secret. file/api_key are excluded.
        var signature = Sign(fields);
        using var form = new MultipartFormDataContent();
        foreach (var field in fields) form.Add(new StringContent(field.Value), field.Key);
        form.Add(new StringContent(_options.ApiKey), "api_key");
        form.Add(new StringContent(signature), "signature");
        var file = new StreamContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", $"{assetId:N}.{format}");
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://api.cloudinary.com/v1_1/{_options.CloudName}/image/upload")
        { Content = form };
        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) throw Failed();
            await using var body = await response.Content.ReadAsStreamAsync(ct);
            using var document = await JsonDocument.ParseAsync(body, cancellationToken: ct);
            var result = document.RootElement;
            var url = String(result, "secure_url");
            if (String(result, "public_id") != publicId || String(result, "resource_type") != "image"
                || String(result, "type") != deliveryType || String(result, "format") != format
                || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https"
                || !string.Equals(uri.Host, "res.cloudinary.com", StringComparison.OrdinalIgnoreCase)
                || !string.IsNullOrEmpty(uri.UserInfo) || !uri.IsDefaultPort
                || !uri.AbsolutePath.StartsWith($"/{_options.CloudName}/image/{deliveryType}/", StringComparison.Ordinal))
                throw Failed();
            return deliveryType == "upload" ? url : null;
        }
        catch (Exception error) when (error is HttpRequestException or JsonException
            || error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            // Do not relay provider response bodies: they can contain account or credential details.
            throw Failed();
        }
    }

    /// <summary>Time-bound authenticated download, equivalent to Cloudinary private_download_url.</summary>
    public MediaAccess PrivateAccess(string bucket, Guid ownerId, Guid assetId, string format)
    {
        if (!_options.IsValid) throw new InvalidOperationException("Cloudinary configuration is incomplete.");
        if (bucket is not ("kyc-private" or "report-evidence") || !ImageFormats.ContainsValue(format))
            throw RpcException.App(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        var now = time.GetUtcNow();
        var expiresAt = now.AddSeconds(MediaAccess.LifetimeSeconds);
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["expires_at"] = expiresAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            ["format"] = format,
            ["public_id"] = PublicId(bucket, ownerId, assetId),
            ["timestamp"] = now.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            ["type"] = "authenticated",
        };
        var signature = Sign(fields);
        fields.Add("api_key", _options.ApiKey);
        fields.Add("signature", signature);
        var query = string.Join('&', fields.Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value)}"));
        return new MediaAccess($"https://api.cloudinary.com/v1_1/{_options.CloudName}/image/download?{query}", expiresAt);
    }

    private string PublicId(string bucket, Guid ownerId, Guid assetId)
    {
        if (bucket is not ("event-assets" or "kyc-private" or "report-evidence"))
            throw RpcException.App(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        return $"{_options.PublicIdPrefix}/{bucket}/{ownerId:D}/{assetId:N}";
    }

    private string Sign(SortedDictionary<string, string> fields)
    {
        // Signature v2 escapes ampersands in values to avoid parameter smuggling.
        var toSign = string.Join('&', fields.Select(pair => $"{pair.Key}={pair.Value.Replace("&", "%26")}")) + _options.ApiSecret;
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(toSign)));
    }

    private static string? String(JsonElement json, string key) => json.ValueKind == JsonValueKind.Object
        && json.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static RpcException Failed() => new(HttpStatusCode.BadGateway, "UPLOAD_FAILED",
        """{"provider":"cloudinary"}""", null);
}

public sealed record MediaAccess(string Url, DateTimeOffset ExpiresAt)
{
    public const int LifetimeSeconds = 120;
}
