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

/// <summary>/api endpoints against a fake PostgREST / Supabase Auth: checks what is sent and how errors map.</summary>
public class ApiEndpointTests
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
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
                services.AddHttpClient<SupabaseRestClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
                services.AddHttpClient<SupabaseAuthClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
            });
        });
        var client = factory.CreateClient();
        if (jwt is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return (client, handler);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("/api/bookings")]
    [InlineData("/api/tickets")]
    [InlineData("/api/me")]
    [InlineData("/api/notifications")]
    public async Task Signed_in_endpoints_need_a_jwt_with_a_user_id(string path)
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path, Ct)).StatusCode);

        // The anon key is a JWT without sub: still not a user.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Jwt(new { role = "anon" }));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path, Ct)).StatusCode);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Events_are_read_as_anon_with_published_filter_and_search()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"e1"}]"""));

        var res = await client.GetAsync("/api/events?q=mùa thu&limit=500", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var url = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.StartsWith("http://db.test/rest/v1/events?", request.RequestUri.ToString());
        Assert.Contains("status=eq.PUBLISHED", url);
        Assert.Contains("title=ilike.*mùa thu*", url);
        Assert.Contains("limit=100", url);
        Assert.DoesNotContain(" ", url.Split("title=")[0]);
        Assert.Equal("sb_publishable_test", request.Headers.GetValues("apikey").Single());
        Assert.Null(request.Headers.Authorization);
    }

    [Fact]
    public async Task Event_detail_is_404_when_rls_hides_it()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.OK, "[]"));

        var res = await client.GetAsync($"/api/events/{Guid.NewGuid()}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("NOT_FOUND", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Seat_map_forwards_the_user_jwt_when_present()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"zones":[]}"""), UserJwt);
        var sessionId = Guid.NewGuid();

        await client.GetAsync($"/api/sessions/{sessionId}/availability", Ct);

        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("http://db.test/rest/v1/rpc/get_session_availability", request.RequestUri!.ToString());
        Assert.Equal($"Bearer {UserJwt}", request.Headers.Authorization!.ToString());
        Assert.Equal($$"""{"p_session_id":"{{sessionId}}"}""", body);
    }

    [Fact]
    public async Task Create_booking_sends_snake_case_items_and_header_idempotency_key()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"id":"b1","status":"PENDING"}"""), UserJwt);
        var sessionId = Guid.NewGuid();
        var ticketTypeId = Guid.NewGuid();
        var seatId = Guid.NewGuid();
        client.DefaultRequestHeaders.Add("Idempotency-Key", "key-12345678");

        var res = await client.PostAsJsonAsync("/api/bookings", new
        {
            sessionId,
            items = new[] { new { ticketTypeId, seatId } },
        }, Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.Equal("/api/bookings/b1", res.Headers.Location!.ToString());
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var args = sent.RootElement;
        Assert.Equal("key-12345678", args.GetProperty("p_idempotency_key").GetString());
        var item = args.GetProperty("p_items")[0];
        Assert.Equal(ticketTypeId, item.GetProperty("ticket_type_id").GetGuid());
        Assert.Equal(seatId, item.GetProperty("seat_id").GetGuid());
        Assert.Equal(JsonValueKind.Null, args.GetProperty("p_options").GetProperty("booking_type").ValueKind);
    }

    [Fact]
    public async Task Seat_conflict_is_409_and_keeps_the_error_contract()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest,
            """{"code":"P0001","message":"SEAT_CONFLICT","details":"{\"seat_ids\":[\"s1\"]}"}"""), UserJwt);

        var res = await client.PostAsJsonAsync("/api/bookings", new
        {
            sessionId = Guid.NewGuid(),
            idempotencyKey = "key-12345678",
            items = new[] { new { ticketTypeId = Guid.NewGuid(), seatId = Guid.NewGuid() } },
        }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        var error = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("SEAT_CONFLICT", error.GetProperty("message").GetString());
        Assert.Equal("""{"seat_ids":["s1"]}""", error.GetProperty("details").GetString());
    }

    [Fact]
    public async Task My_bookings_are_filtered_to_the_caller()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/bookings?status=paid", Ct);

        var url = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains($"or=(user_id.eq.{UserId},created_by.eq.{UserId})", url);
        Assert.Contains("status=eq.PAID", url);
    }

    [Fact]
    public async Task Me_returns_the_profile_with_the_email_claim()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, $$"""[{"id":"{{UserId}}","full_name":"A"}]"""), UserJwt);

        var me = await client.GetFromJsonAsync<JsonElement>("/api/me", Ct);

        Assert.Equal("A", me.GetProperty("full_name").GetString());
        Assert.Equal("customer-1@dev.local", me.GetProperty("email").GetString());
        Assert.Contains($"id=eq.{UserId}", Assert.Single(handler.Calls).Request.RequestUri!.Query);
    }

    [Fact]
    public async Task Update_me_patches_only_the_given_columns()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, $$"""[{"id":"{{UserId}}"}]"""), UserJwt);

        var res = await client.PutAsJsonAsync("/api/me", new { fullName = " Alice " }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal(HttpMethod.Patch, request.Method);
        Assert.Equal("""{"full_name":"Alice"}""", body);
        Assert.Contains("return=representation", request.Headers.GetValues("Prefer"));
    }

    [Fact]
    public async Task Ticket_holder_returns_204()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.NoContent, ""), UserJwt);

        var res = await client.PutAsJsonAsync($"/api/tickets/{Guid.NewGuid()}/holder", new { name = "B" }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.EndsWith("/rpc/assign_ticket_holder", Assert.Single(handler.Calls).Request.RequestUri!.ToString());
    }

    [Fact]
    public async Task Offline_sync_sends_scans_in_rpc_shape()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"processed":1}"""), UserJwt);
        var ticketId = Guid.NewGuid();

        await client.PostAsJsonAsync("/api/check-in/sync", new
        {
            sessionId = Guid.NewGuid(),
            deviceId = Guid.NewGuid(),
            scans = new[] { new { clientScanId = "c1", ticketId, gateId = Guid.NewGuid(), scannedAt = DateTimeOffset.UtcNow, localResult = "OK" } },
        }, Ct);

        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var scan = sent.RootElement.GetProperty("p_scans")[0];
        Assert.Equal("c1", scan.GetProperty("client_scan_id").GetString());
        Assert.Equal(ticketId, scan.GetProperty("ticket_id").GetGuid());
        Assert.True(scan.TryGetProperty("scanned_at", out _));
    }

    [Fact]
    public async Task Revoked_device_is_403()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest, """{"code":"P0001","message":"DEVICE_REVOKED"}"""), UserJwt);

        var res = await client.GetAsync($"/api/sessions/{Guid.NewGuid()}/manifest?deviceId={Guid.NewGuid()}", Ct);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Login_relays_supabase_auth_unchanged()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.BadRequest, """{"error_code":"invalid_credentials"}"""));

        var res = await client.PostAsJsonAsync("/api/auth/login", new { email = "a@b.c", password = "x" }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("""{"error_code":"invalid_credentials"}""", await res.Content.ReadAsStringAsync(Ct));
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("http://db.test/auth/v1/token?grant_type=password", request.RequestUri!.ToString());
    }

    [Fact]
    public async Task Register_puts_name_and_phone_in_user_metadata()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"));

        await client.PostAsJsonAsync("/api/auth/register",
            new { email = "a@b.c", password = "Dev@123456", fullName = "A", phone = "0900000000" }, Ct);

        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        Assert.Equal("A", sent.RootElement.GetProperty("data").GetProperty("full_name").GetString());
        Assert.Equal("0900000000", sent.RootElement.GetProperty("data").GetProperty("phone").GetString());
    }

    [Theory]
    [InlineData("NOT_FOUND", 404)]
    [InlineData("FORBIDDEN", 403)]
    [InlineData("OTP_REQUIRED", 403)]
    [InlineData("SOLD_OUT", 409)]
    [InlineData("VALIDATION_FAILED", 400)]
    public void App_errors_map_to_http_status(string code, int status) =>
        Assert.Equal(status, Postgrest.StatusFor(new RpcException(HttpStatusCode.BadRequest, code, null, "P0001")));

    [Fact]
    public void Database_failures_are_bad_gateway() =>
        Assert.Equal(502, Postgrest.StatusFor(new RpcException(HttpStatusCode.InternalServerError, "boom", null, "XX000")));
}
