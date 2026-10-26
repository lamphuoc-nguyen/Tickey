using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventPlatform.Api;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class RateLimitingTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class RateLimitFactory : WebApplicationFactory<IApiMarker>
    {
        public FakeHttpHandler Handler { get; } = new((_, _) => (HttpStatusCode.OK, """{"result":"OK"}"""));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("MediaStorage:ImageProvider", "Supabase");
            builder.UseSetting("Supabase:Url", "http://ratelimit.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("Api:PublicUrl", "https://api.test");
            // Set low rate limit for testing: 2 requests per 60 seconds
            builder.UseSetting("RateLimit:Auth:PermitLimit", "2");
            builder.UseSetting("RateLimit:Auth:WindowSeconds", "60");
            // CORS origin for testing 429 CORS headers
            builder.UseSetting("Cors:Origins:0", "http://portal.test");
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<SupabaseAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Handler));
        }
    }

    [Fact]
    public async Task Auth_endpoints_rate_limited_to_2_requests_per_minute()
    {
        using var factory = new RateLimitFactory();
        using var client = factory.CreateClient();

        // First request - should succeed
        var res1 = await client.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        // Second request - should succeed
        var res2 = await client.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);

        // Third request - should be rate limited (429)
        var req3 = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "user@test.com", password = "pass" })
        };
        req3.Headers.Add("Origin", "http://portal.test");
        var res3 = await client.SendAsync(req3, Ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, res3.StatusCode);

        // Verify response body
        var body = await res3.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("RATE_LIMITED", body.GetProperty("message").GetString());
        Assert.Contains("retry_after_seconds", body.GetProperty("details").GetString());

        // Verify Retry-After header
        Assert.True(res3.Headers.Contains("Retry-After"));
        var retryAfter = res3.Headers.GetValues("Retry-After").Single();
        Assert.True(int.TryParse(retryAfter, out _));

        // Verify CORS header on 429 response
        Assert.True(res3.Headers.Contains("Access-Control-Allow-Origin"));
        var corsOrigin = res3.Headers.GetValues("Access-Control-Allow-Origin").Single();
        Assert.Equal("http://portal.test", corsOrigin);
    }

    [Fact]
    public async Task Non_auth_endpoints_not_rate_limited()
    {
        using var factory = new RateLimitFactory();
        using var client = factory.CreateClient();

        // Health endpoint is not under /api/auth, should not be rate limited
        for (int i = 0; i < 5; i++)
        {
            var res = await client.GetAsync("/health", Ct);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        }
    }

    [Fact]
    public async Task Different_ips_have_separate_rate_limits()
    {
        using var factory = new RateLimitFactory();
        using var client1 = factory.CreateClient();
        using var client2 = factory.CreateClient();

        // Simulate different IPs using X-Forwarded-For header
        client1.DefaultRequestHeaders.Add("X-Forwarded-For", "1.2.3.4");
        client2.DefaultRequestHeaders.Add("X-Forwarded-For", "5.6.7.8");

        // Client 1 makes 2 requests
        await client1.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);
        await client1.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);

        // Client 1 third request should be rate limited
        var res1 = await client1.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, res1.StatusCode);

        // Client 2 should still be able to make requests
        var res2 = await client2.PostAsJsonAsync("/api/auth/login", new { email = "user@test.com", password = "pass" }, Ct);
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
    }

}