using System.Text.Json;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

public sealed record RegisterRequest(string Email, string Password, string? FullName, string? Phone,
    string? EmailRedirectTo = null);

public sealed record ResendSignupRequest(string Email, string? EmailRedirectTo = null);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record OtpRequest(string Email);

public sealed record VerifyOtpRequest(string Email, string Token);

public sealed record EnrollMfaRequest(string? FriendlyName);

public sealed record VerifyMfaRequest(Guid FactorId, string Code);

/// <summary>
/// Thin relay to Supabase Auth: status and JSON body (session tokens, errors) come back unchanged, so the app
/// stores access_token / refresh_token exactly as supabase-js would. full_name and phone go into user metadata,
/// which handle_new_user copies into profiles.
/// </summary>
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").RequireRateLimiting("auth");

        auth.MapPost("/register", async (RegisterRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
        {
            if (!TryRedirectPath("signup", body.EmailRedirectTo, out var path)) return InvalidRedirect();
            return Relay(await gotrue.SendAsync(HttpMethod.Post, path, new
            {
                email = body.Email,
                password = body.Password,
                data = new { full_name = body.FullName, phone = body.Phone },
            }, null, ct));
        });

        // Resend the signup confirmation, not a passwordless login or a new account.
        auth.MapPost("/resend-signup", async (ResendSignupRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(body.Email))
                return Results.BadRequest(new { message = "VALIDATION_FAILED", details = "{\"field\":\"email\"}" });
            if (!TryRedirectPath("resend", body.EmailRedirectTo, out var path)) return InvalidRedirect();
            return Relay(await gotrue.SendAsync(HttpMethod.Post, path,
                new { type = "signup", email = body.Email.Trim() }, null, ct));
        });

        auth.MapPost("/login", async (LoginRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "token?grant_type=password",
                new { email = body.Email, password = body.Password }, null, ct)));

        // Also used after PUT /api/workspaces/active, so the new token carries the active workspace.
        auth.MapPost("/refresh", async (RefreshRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "token?grant_type=refresh_token",
                new { refresh_token = body.RefreshToken }, null, ct)));

        auth.MapPost("/logout", async (HttpContext http, SupabaseAuthClient gotrue, CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "logout", null, http.Jwt(), ct))).RequireBearer();

        // Email OTP for an existing account. Verifying it returns a fresh session whose token records the OTP,
        // which submit_refund_bank_info requires (OTP_REQUIRED).
        auth.MapPost("/otp", async (OtpRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "otp",
                new { email = body.Email, create_user = false }, null, ct)));

        auth.MapPost("/otp/verify", async (VerifyOtpRequest body, SupabaseAuthClient gotrue, CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "verify",
                new { type = "email", email = body.Email, token = body.Token }, null, ct)));

        // TOTP: enroll returns factor id + QR code; verify (challenge + code) upgrades the session to aal2.
        auth.MapPost("/mfa/enroll", async (EnrollMfaRequest? body, HttpContext http, SupabaseAuthClient gotrue,
            CancellationToken ct) =>
            Relay(await gotrue.SendAsync(HttpMethod.Post, "factors",
                new { factor_type = "totp", friendly_name = body?.FriendlyName }, http.Jwt(), ct))).RequireBearer();

        auth.MapPost("/mfa/verify", async (VerifyMfaRequest body, HttpContext http, SupabaseAuthClient gotrue,
            CancellationToken ct) =>
        {
            var challenge = await gotrue.SendAsync(HttpMethod.Post, $"factors/{body.FactorId:D}/challenge", null, http.Jwt(), ct);
            if ((int)challenge.Status >= 300) return Relay(challenge);

            using var doc = JsonDocument.Parse(challenge.Body);
            var challengeId = doc.RootElement.GetProperty("id").GetString();
            return Relay(await gotrue.SendAsync(HttpMethod.Post, $"factors/{body.FactorId:D}/verify",
                new { challenge_id = challengeId, code = body.Code }, http.Jwt(), ct));
        }).RequireBearer();
    }

    private static bool TryRedirectPath(string endpoint, string? redirect, out string path)
    {
        path = endpoint;
        if (redirect is null) return true; // Preserve existing web callers' default Site URL behavior.
        redirect = redirect.Trim();
        if (redirect.Length == 0 || redirect.Length > 2048 || redirect.Any(char.IsControl) ||
            !Uri.TryCreate(redirect, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https" or "exp" or "exps" or "eventcustomer") ||
            string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment))
            return false;
        // Supabase's project redirect allowlist remains authoritative. Encode the whole callback as one value.
        path = $"{endpoint}?redirect_to={Uri.EscapeDataString(redirect)}";
        return true;
    }

    private static IResult InvalidRedirect() => Results.BadRequest(new
    {
        message = "VALIDATION_FAILED",
        details = "{\"field\":\"emailRedirectTo\"}",
    });

    private static IResult Relay(AuthResponse response) =>
        string.IsNullOrWhiteSpace(response.Body)
            ? Results.StatusCode((int)response.Status)
            : Results.Content(response.Body, "application/json", statusCode: (int)response.Status);
}
