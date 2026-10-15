using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventPlatform.Api;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace EventPlatform.Tests;

public class AuthEmailTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class Factory(HttpStatusCode status = HttpStatusCode.OK, string response = "{}")
        : WebApplicationFactory<IApiMarker>
    {
        public FakeHttpHandler Handler { get; } = new((_, _) => (status, response));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Supabase:Url", "http://auth-email.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<SupabaseAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Handler));
        }
    }

    [Theory]
    [InlineData("eventcustomer://auth/callback?type=signup", "/api/auth/register", "signup")]
    [InlineData("exp://192.0.2.4:8081/--/auth/callback?type=signup&next=%2Forders", "/api/auth/register", "signup")]
    [InlineData("https://portal.example.test/auth/callback", "/api/auth/register", "signup")]
    [InlineData("eventcustomer://auth/callback?type=signup", "/api/auth/resend-signup", "resend")]
    [InlineData("exp://192.0.2.4:8081/--/auth/callback?type=signup&next=%2Forders", "/api/auth/resend-signup", "resend")]
    public async Task Signup_and_resend_forward_one_encoded_redirect_with_only_public_credentials(
        string callback, string endpoint, string upstream)
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync(endpoint,
            new { email = "user@example.test", password = "Password123!", emailRedirectTo = callback }, Ct);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var call = Assert.Single(factory.Handler.Calls);
        Assert.Equal($"http://auth-email.test/auth/v1/{upstream}?redirect_to={Uri.EscapeDataString(callback)}",
            call.Request.RequestUri!.AbsoluteUri);
        Assert.Equal("sb_publishable_test", call.Request.Headers.GetValues("apikey").Single());
        Assert.Null(call.Request.Headers.Authorization); // Publishable keys are not user JWTs.
        using var body = JsonDocument.Parse(call.Body);
        Assert.Equal("user@example.test", body.RootElement.GetProperty("email").GetString());
        if (upstream == "resend") Assert.Equal("signup", body.RootElement.GetProperty("type").GetString());
        Assert.False(body.RootElement.TryGetProperty("emailRedirectTo", out _));
        Assert.False(body.RootElement.TryGetProperty("email_confirm", out _));
    }

    [Theory]
    [InlineData("/api/auth/register", "signup")]
    [InlineData("/api/auth/resend-signup", "resend")]
    public async Task Existing_callers_can_omit_redirect(string endpoint, string upstream)
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync(endpoint,
            new { email = "user@example.test", password = "Password123!" }, Ct);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.Equal($"http://auth-email.test/auth/v1/{upstream}",
            Assert.Single(factory.Handler.Calls).Request.RequestUri!.AbsoluteUri);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("/auth/callback")]
    [InlineData("https://user:password@example.test/auth/callback")]
    [InlineData("https://example.test/auth/callback#access_token=untrusted")]
    [InlineData("https://example.test/auth/callback\r\nX-Injected: true")]
    [InlineData("")]
    public async Task Invalid_redirect_is_rejected_before_sending_any_email(string callback)
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();
        foreach (var endpoint in new[] { "/api/auth/register", "/api/auth/resend-signup" })
        {
            var result = await client.PostAsJsonAsync(endpoint,
                new { email = "user@example.test", password = "Password123!", emailRedirectTo = callback }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
            Assert.Equal("VALIDATION_FAILED",
                (await result.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
        }
        Assert.Empty(factory.Handler.Calls);
    }

    [Fact]
    public async Task Resend_keeps_the_real_rate_limit_error_instead_of_reporting_success()
    {
        const string error = """{"code":"over_email_send_rate_limit","message":"Try again later"}""";
        using var factory = new Factory(HttpStatusCode.TooManyRequests, error);
        using var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync("/api/auth/resend-signup", new { email = "user@example.test" }, Ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, result.StatusCode);
        Assert.Equal(error, await result.Content.ReadAsStringAsync(Ct));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Resend_rejects_missing_email_without_contacting_supabase(string? email)
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync("/api/auth/resend-signup", new { email }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Empty(factory.Handler.Calls);
    }

    [Fact]
    public async Task Email_otp_verification_is_relayed_to_supabase_and_preserves_expiration()
    {
        const string error = """{"code":"otp_expired","message":"Token has expired or is invalid"}""";
        using var factory = new Factory(HttpStatusCode.Forbidden, error);
        using var client = factory.CreateClient();
        var result = await client.PostAsJsonAsync("/api/auth/otp/verify",
            new { email = "user@example.test", token = "12345678" }, Ct);
        Assert.Equal(HttpStatusCode.Forbidden, result.StatusCode);
        Assert.Equal(error, await result.Content.ReadAsStringAsync(Ct));
        var call = Assert.Single(factory.Handler.Calls);
        Assert.Equal("http://auth-email.test/auth/v1/verify", call.Request.RequestUri!.AbsoluteUri);
        Assert.Equal("""{"type":"email","email":"user@example.test","token":"12345678"}""", call.Body);
    }
}
