using System.Text.Json;
using EventPlatform.Core.Qr;

namespace EventPlatform.Api;

/// <summary>
/// The caller's Supabase JWT from "Authorization: Bearer". The API does not validate it: every call forwards
/// it to PostgREST / Supabase Auth, which do, and RLS + the RPCs decide what the caller may see or do.
/// Claims read here (sub, email) only narrow queries that RLS already restricts, so a forged token gains nothing.
/// </summary>
public static class Bearer
{
    public static string? Token(HttpContext http)
    {
        var header = http.Request.Headers.Authorization.ToString();
        return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header["Bearer ".Length..].Trim() : null;
    }

    /// <summary>Endpoint filter: 401 unless the request carries a JWT with a user id.</summary>
    public static TBuilder RequireBearer<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
            Token(context.HttpContext) is { } jwt && Claim(jwt, "sub") is { } sub && Guid.TryParse(sub, out _)
                ? await next(context)
                : Results.Unauthorized());

    /// <summary>The JWT of a request that passed <see cref="RequireBearer{TBuilder}"/>.</summary>
    public static string Jwt(this HttpContext http) =>
        Token(http) ?? throw new InvalidOperationException("Endpoint is missing RequireBearer()");

    public static Guid UserId(this HttpContext http) => Guid.Parse(Claim(http.Jwt(), "sub")!);

    public static string? Claim(string jwt, string name)
    {
        var parts = jwt.Split('.');
        if (parts.Length != 3) return null;
        try
        {
            using var doc = JsonDocument.Parse(Base64Url.Decode(parts[1]));
            return doc.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }
        catch (Exception e) when (e is FormatException or JsonException)
        {
            return null;
        }
    }
}
