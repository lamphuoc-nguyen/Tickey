using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Supabase;

/// <summary>
/// Table reads through PostgREST: {Url}/rest/v1/{table}?{query}. Always runs as the caller (their JWT,
/// or anon when there is none), so RLS decides which rows come back (MT §7.1: read through RLS).
/// Writes go through RPCs; the only table write here is the caller's own profile, which RLS allows.
/// </summary>
public sealed class SupabaseRestClient(HttpClient http, IOptions<SupabaseOptions> options)
{
    private readonly SupabaseOptions _options = options.Value;

    /// <summary>GET rows as a JSON array. <paramref name="query"/> is a PostgREST query string, already escaped.</summary>
    public Task<JsonElement> SelectAsync(string table, string query, string? userJwt, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Get, table, query, null, userJwt, ct);

    /// <summary>PATCH the rows matching <paramref name="filter"/> and return them (Prefer: return=representation).</summary>
    public Task<JsonElement> UpdateAsync(string table, string filter, object values, string userJwt,
        CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, table, filter, values, userJwt, ct);

    private async Task<JsonElement> SendAsync(HttpMethod method, string table, string query, object? body,
        string? userJwt, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, $"{_options.Url.TrimEnd('/')}/rest/v1/{table}?{query}");
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: SupabaseRpcClient.Json);
            request.Headers.Add("Prefer", "return=representation");
        }
        SupabaseRpcClient.AddKeys(request, _options.AnonKey, userJwt ?? _options.AnonKey);

        using var response = await http.SendAsync(request, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw RpcException.FromResponse(response.StatusCode, text);
        }
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "[]" : text);
        return doc.RootElement.Clone();
    }
}
