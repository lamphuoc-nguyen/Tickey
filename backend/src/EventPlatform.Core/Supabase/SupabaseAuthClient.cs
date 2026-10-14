using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core.Supabase;

/// <summary>Status and raw JSON body from Supabase Auth, passed back to the app unchanged.</summary>
public sealed record AuthResponse(HttpStatusCode Status, string Body);

/// <summary>
/// Supabase Auth (GoTrue) at {Url}/auth/v1/{path}, called with the anon key and, for signed-in calls,
/// the user's JWT. Supabase Auth owns passwords, OTP and TOTP; the API only relays requests.
/// </summary>
public sealed class SupabaseAuthClient(HttpClient http, IOptions<SupabaseOptions> options)
{
    private readonly SupabaseOptions _options = options.Value;

    public async Task<AuthResponse> SendAsync(HttpMethod method, string path, object? body, string? userJwt,
        CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(method, $"{_options.Url.TrimEnd('/')}/auth/v1/{path}");
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: SupabaseRpcClient.Json);
        }
        SupabaseRpcClient.AddKeys(request, _options.AnonKey, userJwt ?? _options.AnonKey);

        using var response = await http.SendAsync(request, ct);
        return new AuthResponse(response.StatusCode, await response.Content.ReadAsStringAsync(ct));
    }
}
