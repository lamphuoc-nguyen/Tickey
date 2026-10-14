using System.Net;
using System.Net.Http.Headers;
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

    private string ObjectUrl(string bucket, string path) => $"{_options.Url.TrimEnd('/')}/storage/v1/object/{bucket}/{path}";
}
