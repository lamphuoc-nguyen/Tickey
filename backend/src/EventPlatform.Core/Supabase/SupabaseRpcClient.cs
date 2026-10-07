using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Supabase;

/// <summary>
/// Calls Postgres functions through PostgREST: POST {Url}/rest/v1/rpc/{name} (MT §20.9).
/// Server-only RPCs run as service_role; RPCs on behalf of a user forward that user's JWT,
/// so auth.uid() and RLS stay correct and PostgREST validates the token.
/// </summary>
public sealed class SupabaseRpcClient(HttpClient http, IOptions<SupabaseOptions> options)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    private readonly SupabaseOptions _options = options.Value;

    /// <summary>Server-only RPC with the service_role key.</summary>
    public Task<T> CallAsync<T>(string function, object? args, CancellationToken ct = default) =>
        SendAsync<T>(function, args, _options.ServiceRoleKey, _options.ServiceRoleKey, ct);

    /// <summary>Server-only RPC whose result is ignored (void / scalar functions).</summary>
    public Task CallAsync(string function, object? args, CancellationToken ct = default) =>
        SendAsync<JsonElement>(function, args, _options.ServiceRoleKey, _options.ServiceRoleKey, ct);

    /// <summary>RPC on behalf of a user (e.g. begin_payment): anon key + the user's own JWT.</summary>
    public Task<T> CallAsUserAsync<T>(string function, object? args, string userJwt, CancellationToken ct = default) =>
        SendAsync<T>(function, args, _options.AnonKey, userJwt, ct);

    private async Task<T> SendAsync<T>(string function, object? args, string apiKey, string bearer, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.Url.TrimEnd('/')}/rest/v1/rpc/{function}")
        {
            Content = JsonContent.Create(args ?? new { }, options: Json),
        };
        request.Headers.Add("apikey", apiKey);
        // Legacy anon / service_role keys are JWTs and also go in Authorization. New-style keys
        // (sb_publishable_..., sb_secret_...) are not JWTs and must only be sent as apikey.
        if (IsJwt(bearer))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        }

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw RpcException.FromResponse(response.StatusCode, body);
        }
        if (string.IsNullOrWhiteSpace(body))
        {
            return default!;
        }
        return JsonSerializer.Deserialize<T>(body, Json)!;
    }

    private static bool IsJwt(string token) => token.Count(c => c == '.') == 2;
}
