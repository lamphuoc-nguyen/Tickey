using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Supabase;

/// <summary>
/// Supabase Storage uploads at {Url}/storage/v1/object/{bucket}/{path}, as the user, so the bucket policies in
/// migration part 1300 decide who may write where (report-evidence: own user id folder; kyc-private: OWNER of the
/// org folder; event-assets: OWNER / EVENT_MANAGER of the org folder).
/// </summary>
public sealed class SupabaseStorageClient(HttpClient http, IOptions<SupabaseOptions> options)
{
    private readonly SupabaseOptions _options = options.Value;

    public async Task UploadAsync(string bucket, string path, Stream content, string contentType, string userJwt,
        CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, ObjectUrl(bucket, path))
        {
            Content = new StreamContent(content),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        SupabaseRpcClient.AddKeys(request, _options.AnonKey, userJwt);

        using var response = await http.SendAsync(request, ct);
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(ct);
        // Storage reports a policy violation as 400/403 "new row violates row-level security policy".
        if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized
            || body.Contains("row-level security", StringComparison.OrdinalIgnoreCase))
        {
            throw RpcException.App(HttpStatusCode.Forbidden, "FORBIDDEN");
        }
        throw new RpcException(response.StatusCode, "UPLOAD_FAILED", body, null);
    }

    /// <summary>Public URL of an object in a public bucket (event-assets).</summary>
    public string PublicUrl(string bucket, string path) =>
        $"{_options.Url.TrimEnd('/')}/storage/v1/object/public/{bucket}/{path}";

    /// <summary>Legacy private objects: sign as the caller, retaining Storage SELECT policies.</summary>
    public async Task<string> SignedUrlAsync(string bucket, string path, int expiresIn, string userJwt,
        CancellationToken ct = default)
    {
        var objectPath = string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_options.Url.TrimEnd('/')}/storage/v1/object/sign/{bucket}/{objectPath}")
        {
            Content = JsonContent.Create(new { expiresIn }),
        };
        SupabaseRpcClient.AddKeys(request, _options.AnonKey, userJwt);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized
                || errorBody.Contains("row-level security", StringComparison.OrdinalIgnoreCase))
                throw RpcException.App(HttpStatusCode.Forbidden, "FORBIDDEN");
            throw new RpcException(HttpStatusCode.BadGateway, "MEDIA_ACCESS_FAILED", null, null);
        }
        try
        {
            using var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var relative = data.RootElement.ValueKind == JsonValueKind.Object && data.RootElement.TryGetProperty("signedURL", out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString() : null;
            var prefix = $"/object/sign/{bucket}/{objectPath}?";
            if (relative is null || !relative.StartsWith(prefix, StringComparison.Ordinal)
                || relative.Any(char.IsControl)
                || !QueryHelpers.ParseQuery(relative[relative.IndexOf('?')..]).TryGetValue("token", out var token)
                || string.IsNullOrWhiteSpace(token.ToString()))
                throw new RpcException(HttpStatusCode.BadGateway, "MEDIA_ACCESS_FAILED", null, null);
            return $"{_options.Url.TrimEnd('/')}/storage/v1{relative}";
        }
        catch (JsonException)
        {
            throw new RpcException(HttpStatusCode.BadGateway, "MEDIA_ACCESS_FAILED", null, null);
        }
    }

    private string ObjectUrl(string bucket, string path) => $"{_options.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";
}
