using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using EventPlatform.Api;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace EventPlatform.Tests;

/// <summary>Tests for /api catalog endpoints (public, no auth required).</summary>
public class CatalogEndpointTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly string UserJwt = Jwt(new { sub = UserId, email = "customer-1@dev.local" });

    private static string Jwt(object claims) =>
        $"e30.{Base64Url.Encode(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(claims)))}.sig";

    private static (HttpClient Client, FakeHttpHandler Handler) Create(
        Func<HttpRequestMessage, string, (HttpStatusCode, string)> respond, string? jwt = null)
    {
        var handler = new FakeHttpHandler(respond);
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("MediaStorage:ImageProvider", "Supabase");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
                services.AddHttpClient<SupabaseRestClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
                services.AddHttpClient<SupabaseAuthClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
                services.AddHttpClient<SupabaseStorageClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
            });
        });
        var client = factory.CreateClient();
        if (jwt is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return (client, handler);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Categories_returns_ordered_list_as_anon()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"c1","slug":"music","name":"Âm nhạc","sort_order":1}]"""));

        var res = await client.GetAsync("/api/categories", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.StartsWith("http://db.test/rest/v1/categories?", request.RequestUri.ToString());
        Assert.Contains("order=sort_order", url);
        Assert.Equal("sb_publishable_test", request.Headers.GetValues("apikey").Single());
        Assert.Null(request.Headers.Authorization);
    }

    [Fact]
    public async Task Events_supports_search_category_featured_pagination()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"e1"}]"""));

        var res = await client.GetAsync("/api/events?q=tết&categoryId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&featured=true&limit=10&offset=20", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.StartsWith("http://db.test/rest/v1/events?", request.RequestUri.ToString());
        Assert.Contains("status=eq.PUBLISHED", url);
        Assert.Contains("title=ilike.*tết*", url);
        Assert.Contains("category_id=eq.aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", url);
        Assert.Contains("is_featured=is.true", url);
        Assert.Contains("order=is_featured.desc,published_at.desc", url);
        Assert.Contains("limit=10", url);
        Assert.Contains("offset=20", url);
    }

    [Fact]
    public async Task Event_detail_includes_category_relation()
    {
        var eventId = Guid.NewGuid();
        var expectedJson = "[{\"id\":\"" + eventId + "\",\"title\":\"Test\",\"category\":{\"id\":\"c1\",\"slug\":\"music\",\"name\":\"Âm nhạc\"}}]";
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, expectedJson));

        var res = await client.GetAsync($"/api/events/{eventId}", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.Contains("category:categories(id,slug,name)", url);
    }

    [Fact]
    public async Task Event_detail_returns_404_when_rls_hides_it()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));

        var res = await client.GetAsync($"/api/events/{Guid.NewGuid()}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        var error = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("NOT_FOUND", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Event_sessions_returns_ordered_list()
    {
        var eventId = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"s1"}]"""));

        var res = await client.GetAsync($"/api/events/{eventId}/sessions", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.Contains($"event_id=eq.{eventId}", url);
        Assert.Contains("order=starts_at", url);
    }

    [Fact]
    public async Task Session_ticket_types_returns_visible_types_ordered()
    {
        var sessionId = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"tt1","name":"VIP"}]"""));

        var res = await client.GetAsync($"/api/sessions/{sessionId}/ticket-types", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.Contains($"session_id=eq.{sessionId}", url);
        Assert.Contains("order=sort_order", url);
    }

    [Fact]
    public async Task Session_layout_calls_rpc_and_forwards_anon_key()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"zones":[]}"""));
        var sessionId = Guid.NewGuid();

        await client.GetAsync($"/api/sessions/{sessionId}/layout", Ct);

        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("http://db.test/rest/v1/rpc/get_session_layout", request.RequestUri!.ToString());
        Assert.Null(request.Headers.Authorization); // anon, no JWT forwarded
        var expectedBody = "{\"p_session_id\":\"" + sessionId + "\"}";
        Assert.Equal(expectedBody, body);
    }

    [Fact]
    public async Task Session_availability_calls_rpc_and_forwards_user_jwt_when_present()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"available":10}"""), UserJwt);
        var sessionId = Guid.NewGuid();

        await client.GetAsync($"/api/sessions/{sessionId}/availability", Ct);

        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("http://db.test/rest/v1/rpc/get_session_availability", request.RequestUri!.ToString());
        Assert.Equal($"Bearer {UserJwt}", request.Headers.Authorization!.ToString());
        var expectedBody = "{\"p_session_id\":\"" + sessionId + "\"}";
        Assert.Equal(expectedBody, body);
    }

    [Fact]
    public async Task Seat_pricing_calls_rpc_and_forwards_user_jwt_when_present()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"pricing":{}}"""), UserJwt);
        var sessionId = Guid.NewGuid();

        await client.GetAsync($"/api/sessions/{sessionId}/seat-pricing", Ct);

        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("http://db.test/rest/v1/rpc/get_session_seat_pricing", request.RequestUri!.ToString());
        Assert.Equal($"Bearer {UserJwt}", request.Headers.Authorization!.ToString());
        var expectedBody = "{\"p_session_id\":\"" + sessionId + "\"}";
        Assert.Equal(expectedBody, body);
    }

    [Fact]
    public async Task Catalog_endpoints_work_without_jwt_and_dont_forward_authorization()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));

        await client.GetAsync("/api/events", Ct);
        await client.GetAsync("/api/categories", Ct);
        await client.GetAsync($"/api/events/{Guid.NewGuid()}/sessions", Ct);
        await client.GetAsync($"/api/sessions/{Guid.NewGuid()}/ticket-types", Ct);

        foreach (var call in handler.Calls)
        {
            Assert.Null(call.Request.Headers.Authorization);
            Assert.Equal("sb_publishable_test", call.Request.Headers.GetValues("apikey").Single());
        }
    }
}