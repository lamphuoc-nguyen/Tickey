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
                services.AddHttpClient<SupabaseStorageClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
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
    public async Task Device_platform_is_normalised_and_validated()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"device_id":"d1"}"""), UserJwt);
        var device = new { orgId = Guid.NewGuid(), fingerprint = "fp", name = "Gate phone" };

        var bad = await client.PostAsJsonAsync("/api/devices", new { device.orgId, device.fingerprint, device.name, platform = "web" }, Ct);
        var ok = await client.PostAsJsonAsync("/api/devices", new { device.orgId, device.fingerprint, device.name, platform = " android " }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        Assert.Equal("ANDROID", sent.RootElement.GetProperty("p_platform").GetString());
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

    private static MultipartFormDataContent Upload(string purpose, string contentType, Guid? orgId = null)
    {
        var file = new ByteArrayContent([1, 2, 3]);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { file, "file", "photo" }, { new StringContent(purpose), "purpose" } };
        if (orgId is { } id) form.Add(new StringContent(id.ToString()), "orgId");
        return form;
    }

    [Fact]
    public async Task Report_evidence_goes_to_the_callers_own_folder()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"Key":"x"}"""), UserJwt);

        var res = await client.PostAsync("/api/uploads", Upload("report_evidence", "image/png"), Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var result = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var path = result.GetProperty("path").GetString()!;
        Assert.StartsWith($"{UserId}/", path);
        Assert.EndsWith(".png", path);
        Assert.Equal(JsonValueKind.Null, result.GetProperty("public_url").ValueKind);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal($"http://db.test/storage/v1/object/report-evidence/{path}", request.RequestUri!.ToString());
        Assert.Equal($"Bearer {UserJwt}", request.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task Event_asset_needs_an_org_and_returns_a_public_url()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"), UserJwt);
        var orgId = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsync("/api/uploads", Upload("EVENT_ASSET", "image/jpeg"), Ct)).StatusCode);
        var res = await client.PostAsync("/api/uploads", Upload("EVENT_ASSET", "image/jpeg", orgId), Ct);

        var result = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.StartsWith($"http://db.test/storage/v1/object/public/event-assets/{orgId}/",
            result.GetProperty("public_url").GetString());
        Assert.Single(handler.Calls);
    }

    [Fact]
    public async Task Upload_rejects_other_file_types_before_calling_storage()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"), UserJwt);

        var res = await client.PostAsync("/api/uploads", Upload("REPORT_EVIDENCE", "text/html"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("VALIDATION_FAILED", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Storage_policy_refusal_is_403_forbidden()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest,
            """{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}"""), UserJwt);

        var res = await client.PostAsync("/api/uploads", Upload("KYC", "application/pdf", Guid.NewGuid()), Ct);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal("FORBIDDEN", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
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

    [Fact]
    public async Task Save_event_sends_snake_case_p_and_returns_201()
    {
        var eventId = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, $"\"{eventId}\""), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync("/api/events", new { tenantId = orgId, title = "Mùa thu", coverImageUrl = "x" }, Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.Equal($"/api/events/{eventId}", res.Headers.Location!.ToString());
        var (request, body) = Assert.Single(handler.Calls);
        Assert.EndsWith("/rpc/save_event", request.RequestUri!.ToString());
        using var sent = JsonDocument.Parse(body);
        var p = sent.RootElement.GetProperty("p");
        Assert.Equal(orgId, p.GetProperty("tenant_id").GetGuid());
        Assert.Equal("x", p.GetProperty("cover_image_url").GetString());
        Assert.False(p.TryGetProperty("id", out _));
    }

    [Fact]
    public async Task Update_session_takes_the_id_from_the_route()
    {
        var sessionId = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, $"\"{sessionId}\""), UserJwt);

        var res = await client.PutAsJsonAsync($"/api/sessions/{sessionId}", new { id = Guid.NewGuid(), maxTicketsPerAccount = 4 }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var p = sent.RootElement.GetProperty("p");
        Assert.Equal(sessionId, p.GetProperty("id").GetGuid());
        Assert.Equal(4, p.GetProperty("max_tickets_per_account").GetInt32());
    }

    [Fact]
    public async Task Layout_draft_definition_is_sent_unchanged()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.NoContent, ""), UserJwt);

        var res = await client.PutAsync($"/api/layout-versions/{Guid.NewGuid()}/draft",
            new StringContent("""{"definition":{"zones":[{"seatRows":[]}]}}""", Encoding.UTF8, "application/json"), Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        Assert.True(sent.RootElement.GetProperty("p_definition").GetProperty("zones")[0].TryGetProperty("seatRows", out _));
    }

    [Fact]
    public async Task Comp_tickets_need_an_idempotency_key()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"bookings":[],"remaining":1}"""), UserJwt);
        var body = new { ticketTypeId = Guid.NewGuid(), recipients = new[] { new { email = "a@b.c", quantity = 2 } } };

        var missing = await client.PostAsJsonAsync($"/api/sessions/{Guid.NewGuid()}/comp-tickets", body, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Empty(handler.Calls);

        client.DefaultRequestHeaders.Add("Idempotency-Key", "comp-12345678");
        var res = await client.PostAsJsonAsync($"/api/sessions/{Guid.NewGuid()}/comp-tickets", body, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        Assert.Equal("comp-12345678", sent.RootElement.GetProperty("p_idempotency_key").GetString());
        Assert.Equal(2, sent.RootElement.GetProperty("p_recipients")[0].GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task Create_gate_takes_the_venue_from_the_route()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"6f1d0c3a-0000-4000-8000-000000000001\""), UserJwt);
        var venueId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/venues/{venueId}/gates", new { code = "g1", name = "Cổng chính" }, Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.EndsWith("/rest/v1/rpc/save_gate", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        var p = sent.RootElement.GetProperty("p");
        Assert.Equal(venueId, p.GetProperty("venue_id").GetGuid());
        Assert.Equal("g1", p.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Gate_zones_config_is_snake_case()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.NoContent, ""), UserJwt);
        var gateId = Guid.NewGuid();

        var res = await client.PutAsJsonAsync($"/api/sessions/{Guid.NewGuid()}/gate-zones",
            new { config = new[] { new { gateId, zoneIds = new[] { Guid.NewGuid() } } } }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var config = sent.RootElement.GetProperty("p_config")[0];
        Assert.Equal(gateId, config.GetProperty("gate_id").GetGuid());
        Assert.Equal(1, config.GetProperty("zone_ids").GetArrayLength());
    }

    [Fact]
    public async Task Admin_kyc_queue_embeds_the_org_and_documents()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/admin/kyc-submissions?limit=100&offset=0", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/kyc_submissions", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("org:organizations(", query);
        Assert.Contains("documents:kyc_documents(", query);
        Assert.Contains("order=submitted_at.desc", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Admin_orgs_are_filtered_by_status_and_name()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/admin/organizations?status=approved&q=am%20sac", Ct);

        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("status=eq.APPROVED", query);
        Assert.Contains("name=ilike.*am sac*", query);
    }

    [Fact]
    public async Task Admin_org_status_change_opens_an_approval()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"44444444-4444-4444-4444-444444444444\""),
            UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/admin/organizations/{orgId}/status-change",
            new { action = " suspend ", reason = "Rà soát tỷ lệ hoàn vé" }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/request_org_status_change", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(orgId, root.GetProperty("p_org_id").GetGuid());
        Assert.Equal("SUSPEND", root.GetProperty("p_action").GetString());
        Assert.Equal("Rà soát tỷ lệ hoàn vé", root.GetProperty("p_reason").GetString());
    }

    [Fact]
    public async Task Admin_events_default_to_pending_review()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/admin/events", Ct);

        var url = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("status=eq.PENDING_REVIEW", url);
    }

    [Fact]
    public async Task Admin_events_queue_embeds_the_org_and_sessions()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/admin/events?status=changes_requested&limit=100&offset=0", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/events", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("org:organizations(id,name,slug)", query);
        Assert.Contains("sessions(id,title,starts_at,ends_at,status)", query);
        Assert.Contains("status=eq.CHANGES_REQUESTED", query);
        Assert.Contains("order=updated_at", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Admin_approvals_default_to_pending_and_embed_the_votes()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/admin/approvals", Ct);

        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/approvals", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("status=eq.PENDING", query);
        Assert.Contains("votes:approval_votes(voter_id,decision,note,created_at)", query);
        Assert.Contains("order=created_at.desc", query);
    }

    [Fact]
    public async Task Admin_approval_detail_fetches_one_by_id_with_the_votes()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK,
            """[{"id":"55555555-5555-5555-5555-555555555555","votes":[]}]"""), UserJwt);
        var approvalId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/admin/approvals/{approvalId}", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/approvals", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"id=eq.{approvalId}", query);
        Assert.Contains("votes:approval_votes(", query);
    }

    [Fact]
    public async Task Vote_approval_upper_cases_the_decision()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"status":"APPROVED"}"""), UserJwt);
        var approvalId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/admin/approvals/{approvalId}/votes", new { decision = "approve" }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.EndsWith("/rpc/vote_approval", request.RequestUri!.ToString());
        Assert.Equal($$"""{"p_approval_id":"{{approvalId}}","p_decision":"APPROVE","p_note":null}""", body);
    }

    [Theory]
    [InlineData("kyc-submissions", "review_kyc", " approve ", "APPROVED")]
    [InlineData("kyc-submissions", "review_kyc", "reject", "REJECTED")]
    [InlineData("kyc-submissions", "review_kyc", "needs_info", "NEEDS_INFO")]
    [InlineData("kyc-submissions", "review_kyc", "APPROVED", "APPROVED")]
    [InlineData("events", "review_event", "approve", "APPROVED")]
    [InlineData("events", "review_event", " reject ", "REJECTED")]
    [InlineData("events", "review_event", "changes_requested", "CHANGES_REQUESTED")]
    [InlineData("events", "review_event", "REJECTED", "REJECTED")]
    [InlineData("bank-accounts", "review_bank_account", "approve", "APPROVE")]
    [InlineData("bank-accounts", "review_bank_account", "reject", "REJECT")]
    public async Task Review_decisions_match_each_rpc_contract(string resource, string function, string decision,
        string expected)
    {
        var (client, handler) = Create((_, body) =>
        {
            using var sent = JsonDocument.Parse(body);
            return sent.RootElement.GetProperty("p_decision").GetString() == expected
                ? (HttpStatusCode.NoContent, "")
                : (HttpStatusCode.BadRequest, """{"code":"P0001","message":"VALIDATION_FAILED","details":"{}"}""");
        }, UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/{resource}/{Guid.NewGuid()}/review",
            new { decision, note = "Review note" }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.EndsWith($"/rpc/{function}", Assert.Single(handler.Calls).Request.RequestUri!.ToString());
    }

    [Fact]
    public async Task Venue_detail_disambiguates_layout_versions()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"layouts":[]}]"""), UserJwt);

        var res = await client.GetAsync($"/api/venues/{Guid.NewGuid()}", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("versions:layout_versions!layout_versions_layout_id_tenant_id_fkey(", query);
    }

    [Fact]
    public async Task Admin_audit_logs_forward_the_org_action_and_target_filters()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync(
            $"/api/admin/audit-logs?orgId={orgId}&action=KYC.APPROVE&targetType=organization&targetId=abc123", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/audit_logs", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"org_id=eq.{orgId}", query);
        Assert.Contains("action=eq.KYC.APPROVE", query);
        Assert.Contains("target_type=eq.organization", query);
        Assert.Contains("target_id=eq.abc123", query);
        Assert.Contains("order=created_at.desc", query);
    }

    [Fact]
    public async Task Admin_refund_bank_info_uses_the_callers_jwt_and_refund_id()
    {
        var id = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK,
            $$"""[{"refund_id":"{{id}}","bank_code":"VCB","account_number":"123456789","account_holder":"CUSTOMER"}]"""), UserJwt);

        var res = await client.GetAsync($"/api/admin/refunds/{id}/bank-info", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/refund_bank_infos", request.RequestUri!.AbsolutePath);
        Assert.Contains($"refund_id=eq.{id}", Uri.UnescapeDataString(request.RequestUri.Query));
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
        Assert.Equal("sb_publishable_test", Assert.Single(request.Headers.GetValues("apikey")));
        var bankInfo = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("123456789", bankInfo.GetProperty("account_number").GetString());
    }

    [Fact]
    public async Task Admin_refund_bank_info_is_not_found_when_rls_hides_the_row()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync($"/api/admin/refunds/{Guid.NewGuid()}/bank-info", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("NOT_FOUND", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Admin_settlements_read_embeds_org_session_and_event_without_a_tenant_filter()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/admin/settlements?status=ready&limit=100&offset=0", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/settlements", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query).Replace("+", " ");
        Assert.Contains("status=eq.READY", query);
        Assert.Contains("session:sessions(id,title,starts_at,event:events(id,title))", query);
        Assert.DoesNotContain("org:organizations(", query);
        Assert.Contains("order=created_at.desc", query);
        Assert.DoesNotContain("tenant_id=eq.", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Admin_gateway_statements_filter_by_gateway_and_statement_date()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/admin/gateway-statements?gateway=VNPAY&date=2026-10-21", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/gateway_statement_lines", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("gateway=eq.VNPAY", query);
        Assert.Contains("statement_date=eq.2026-10-21", query);
        Assert.Contains("order=statement_date.desc,gateway.asc,gateway_txn_id.asc", query);
    }

    [Fact]
    public async Task Admin_bank_accounts_default_to_pending_review()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/admin/bank-accounts", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query).Replace("+", " ");
        Assert.Contains("status=eq.PENDING", query);
        Assert.Contains("org:organizations(id,name,slug)", query);
    }

    [Fact]
    public async Task Admin_cancels_a_payout_with_a_reason()
    {
        var id = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"), UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/payouts/{id}/cancel",
            new { reason = "Chờ đối chiếu" }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("/rest/v1/rpc/cancel_payout", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        Assert.Equal(id, sent.RootElement.GetProperty("p_payout_id").GetGuid());
        Assert.Equal("Chờ đối chiếu", sent.RootElement.GetProperty("p_reason").GetString());
    }

    [Fact]
    public async Task Admin_resolves_a_chargeback_with_the_uppercased_outcome()
    {
        var id = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"), UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/chargebacks/{id}/resolve",
            new { outcome = "won", note = "3DS2 hợp lệ" }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("/rest/v1/rpc/resolve_chargeback", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        Assert.Equal(id, sent.RootElement.GetProperty("p_chargeback_id").GetGuid());
        Assert.Equal("WON", sent.RootElement.GetProperty("p_outcome").GetString());
        Assert.Equal("3DS2 hợp lệ", sent.RootElement.GetProperty("p_note").GetString());
    }

    [Fact]
    public async Task Admin_confirms_a_manual_refund_transfer_with_the_reference()
    {
        var id = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"), UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/refunds/{id}/manual-transfer",
            new { transferRef = "VCB-REF-1" }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("/rest/v1/rpc/confirm_manual_transfer", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        Assert.Equal(id, sent.RootElement.GetProperty("p_refund_id").GetGuid());
        Assert.Equal("VCB-REF-1", sent.RootElement.GetProperty("p_transfer_ref").GetString());
    }

    [Fact]
    public async Task Admin_imports_gateway_statement_lines_as_snake_case_rpc_args()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"matched":2,"mismatches":0}"""), UserJwt);

        var res = await client.PostAsJsonAsync("/api/admin/gateway-statements", new
        {
            gateway = "VNPAY",
            statementDate = "2026-10-21",
            lines = new[] { new { txnType = "PAYMENT", gatewayTxnId = "TXN-1", amount = 1800000 } },
        }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("/rest/v1/rpc/import_gateway_statement", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        var root = sent.RootElement;
        Assert.Equal("VNPAY", root.GetProperty("p_gateway").GetString());
        Assert.Equal("2026-10-21", root.GetProperty("p_statement_date").GetString());
        var lines = root.GetProperty("p_lines");
        Assert.Equal(1, lines.GetArrayLength());
        Assert.Equal("PAYMENT", lines[0].GetProperty("txn_type").GetString());
        Assert.Equal("TXN-1", lines[0].GetProperty("gateway_txn_id").GetString());
        Assert.Equal(1800000, lines[0].GetProperty("amount").GetInt64());
    }

    [Fact]
    public async Task Admin_recomputes_a_session_settlement()
    {
        var id = Guid.NewGuid();
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"status":"READY","net_amount":171000}"""), UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/sessions/{id}/settlement", new { }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("/rest/v1/rpc/recompute_settlement", call.Request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(call.Body);
        Assert.Equal(id, sent.RootElement.GetProperty("p_session_id").GetGuid());
        var body = await res.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(171000, body.GetProperty("net_amount").GetInt64());
    }

    [Fact]
    public async Task Mfa_required_is_403()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest,
            """{"code":"P0001","message":"MFA_REQUIRED","details":"{}"}"""), UserJwt);

        var res = await client.PostAsJsonAsync($"/api/admin/kyc-submissions/{Guid.NewGuid()}/review",
            new { decision = "APPROVE" }, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal("MFA_REQUIRED", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
    }

    [Theory]
    [InlineData("/api/admin/approvals")]
    [InlineData("/api/admin/kyc-submissions")]
    [InlineData("/api/admin/refunds/11111111-1111-1111-1111-111111111111/bank-info")]
    [InlineData("/api/disputes")]
    [InlineData("/api/organizations/11111111-1111-1111-1111-111111111111/orders")]
    [InlineData("/api/organizations/11111111-1111-1111-1111-111111111111/comp-tickets")]
    public async Task Org_and_admin_endpoints_need_a_jwt(string path)
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path, Ct)).StatusCode);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Support_requests_embed_the_messages_and_need_a_jwt()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/support-requests?limit=100&offset=0", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/support_requests", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("messages:support_messages(", query);
        Assert.Contains("order=created_at.desc", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Replying_to_a_support_request_posts_a_support_message()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"44444444-4444-4444-4444-444444444444\""),
            UserJwt);
        var id = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/support-requests/{id}/messages",
            new { body = "Da lam moi chung chi dong bo thiet bi." }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/add_support_message", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(id, root.GetProperty("p_request_id").GetGuid());
        Assert.Equal("Da lam moi chung chi dong bo thiet bi.", root.GetProperty("p_body").GetString());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Org_orders_are_filtered_to_the_tenant_and_forward_the_jwt()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/orders", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/bookings", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"tenant_id=eq.{orgId}", query);
        Assert.Contains("session:sessions(", query);
        Assert.Contains("items:booking_items(", query);
        Assert.Contains("payments(", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Org_orders_can_be_filtered_and_searched()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        await client.GetAsync($"/api/organizations/{orgId}/orders?status=paid&type=comp&q=Nguyen", Ct);

        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("status=eq.PAID", query);
        Assert.Contains("booking_type=eq.COMP", query);
        Assert.Contains("or=(code.ilike.*Nguyen*,", query);
        Assert.Contains("buyer_snapshot->>full_name.ilike.*Nguyen*", query);
    }

    [Fact]
    public async Task Order_detail_is_404_when_rls_hides_the_booking()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/orders/{Guid.NewGuid()}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("NOT_FOUND", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Order_detail_shows_the_issued_tickets()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """[{"id":"b1"}]"""), UserJwt);
        var orgId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/orders/{bookingId}", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        var query = Uri.UnescapeDataString(request.RequestUri!.Query);
        Assert.Contains("tickets:tickets(", query);
        Assert.Contains($"id=eq.{bookingId}", query);
    }

    [Fact]
    public async Task Comp_tickets_are_only_the_comp_bookings()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        await client.GetAsync($"/api/organizations/{orgId}/comp-tickets", Ct);

        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("booking_type=eq.COMP", query);
        Assert.Contains($"tenant_id=eq.{orgId}", query);
    }

    [Fact]
    public async Task Org_finance_calls_the_summary_rpc_with_the_org_and_the_callers_jwt()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK,
            """{"ledger_balance":109140000,"held":12840000,"ready":0,"paid_out":0,"in_progress":0,"active_holds":[]}"""),
            UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/finance", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/get_org_finance_summary", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        Assert.Equal(orgId, sent.RootElement.GetProperty("p_org_id").GetGuid());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
        Assert.Equal(109140000, (await res.Content.ReadFromJsonAsync<JsonElement>(Ct))
            .GetProperty("ledger_balance").GetInt64());
    }

    [Fact]
    public async Task Org_settlements_are_filtered_to_the_tenant_with_the_session_embed()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/settlements", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/settlements", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"tenant_id=eq.{orgId}", query);
        Assert.Contains("session:sessions(", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Org_payouts_are_filtered_to_the_tenant_and_the_status()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        await client.GetAsync($"/api/organizations/{orgId}/payouts?status=proposed", Ct);

        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains($"tenant_id=eq.{orgId}", query);
        Assert.Contains("status=eq.PROPOSED", query);
    }

    [Fact]
    public async Task Org_bank_accounts_are_filtered_to_the_org()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        await client.GetAsync($"/api/organizations/{orgId}/bank-accounts", Ct);

        var query = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains($"org_id=eq.{orgId}", query);
    }

    [Fact]
    public async Task Requesting_a_bank_account_change_forwards_the_org_and_the_fields()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"22222222-2222-2222-2222-222222222222\""),
            UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/organizations/{orgId}/bank-accounts",
            new { bankCode = "VCB", accountNumber = "0071001234567", accountHolder = "CONG TY AM SAC" }, Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/request_bank_account_change", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(orgId, root.GetProperty("p_org_id").GetGuid());
        Assert.Equal("VCB", root.GetProperty("p_bank_code").GetString());
        Assert.Equal("0071001234567", root.GetProperty("p_account_number").GetString());
        Assert.Equal("CONG TY AM SAC", root.GetProperty("p_account_holder").GetString());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Org_kyc_submissions_are_filtered_to_the_org_with_documents()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.GetAsync($"/api/organizations/{orgId}/kyc", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/kyc_submissions", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"org_id=eq.{orgId}", query);
        Assert.Contains("documents:kyc_documents(", query);
        Assert.Contains("order=submitted_at.desc", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Submitting_kyc_forwards_the_org_legal_info_identity_and_documents()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"33333333-3333-3333-3333-333333333333\""),
            UserJwt);
        var orgId = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/organizations/{orgId}/kyc", new
        {
            legalInfo = new { legal_name = "CONG TY AM SAC", representative = "Nguyen Van A" },
            identityNumber = "079200012345",
            documents = new[]
            {
                new { docType = "BUSINESS_REGISTRATION", storagePath = $"{orgId}/gpkd.pdf" },
                new { docType = "IDENTITY_CARD", storagePath = $"{orgId}/cccd.pdf" },
            },
        }, Ct);

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/submit_kyc", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(orgId, root.GetProperty("p_org_id").GetGuid());
        Assert.Equal("079200012345", root.GetProperty("p_identity_number").GetString());
        Assert.Equal("CONG TY AM SAC",
            root.GetProperty("p_legal_info").GetProperty("legal_name").GetString());
        var documents = root.GetProperty("p_documents");
        Assert.Equal(2, documents.GetArrayLength());
        Assert.Equal("BUSINESS_REGISTRATION", documents[0].GetProperty("doc_type").GetString());
        Assert.Equal($"{orgId}/gpkd.pdf", documents[0].GetProperty("storage_path").GetString());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
        Assert.Equal("33333333-3333-3333-3333-333333333333",
            (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetString());
    }

    [Fact]
    public async Task Org_finance_maps_a_foreign_org_forbidden_to_403()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest,
            """{"code":"P0001","message":"FORBIDDEN","details":"{}"}"""), UserJwt);

        var res = await client.GetAsync($"/api/organizations/{Guid.NewGuid()}/finance", Ct);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal("FORBIDDEN", (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Org_disputes_embed_the_session_and_filter_by_status()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        var res = await client.GetAsync("/api/disputes?status=awaiting_org&limit=50&offset=0", Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/dispute_cases", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("status=eq.AWAITING_ORG", query);
        Assert.Contains("session:sessions(", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Dispute_detail_loads_messages_and_reports()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);
        var id = Guid.NewGuid();

        var res = await client.GetAsync($"/api/disputes/{id}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/dispute_cases", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains($"id=eq.{id}", query);
        Assert.Contains("messages:dispute_messages(", query);
        Assert.Contains("reports(", query);
    }

    [Fact]
    public async Task Admin_resolves_a_dispute_case_with_the_resolution_payload()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"refunds_created":2}"""), UserJwt);
        var id = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/admin/disputes/{id}/resolve",
            new { resolution = "partial_refund", refundPercentBp = 5000, scope = "ALL_TICKETS", note = "Hoàn 50% toàn suất" },
            Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, (await res.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("refunds_created").GetInt32());
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/resolve_dispute_case", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(id, root.GetProperty("p_case_id").GetGuid());
        Assert.Equal("partial_refund", root.GetProperty("p_resolution").GetString());
        Assert.Equal(5000, root.GetProperty("p_refund_percent_bp").GetInt32());
        Assert.Equal("ALL_TICKETS", root.GetProperty("p_scope").GetString());
        Assert.Equal("Hoàn 50% toàn suất", root.GetProperty("p_note").GetString());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Admin_resolve_dispute_defaults_the_scope_to_reporters()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, """{"refunds_created":0}"""), UserJwt);
        var id = Guid.NewGuid();

        await client.PostAsJsonAsync($"/api/admin/disputes/{id}/resolve",
            new { resolution = "NO_ACTION", refundPercentBp = (int?)null, scope = (string?)null, note = (string?)null }, Ct);

        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal("REPORTERS", root.GetProperty("p_scope").GetString());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("p_refund_percent_bp").ValueKind);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("p_note").ValueKind);
    }

    [Fact]
    public async Task Responding_to_a_dispute_posts_an_org_side_message()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "\"33333333-3333-3333-3333-333333333333\""),
            UserJwt);
        var id = Guid.NewGuid();

        var res = await client.PostAsJsonAsync($"/api/disputes/{id}/messages",
            new { body = "Da kiem tra log soat ve cong G1.", attachments = (object?)null }, Ct);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/rpc/add_dispute_message", request.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(Assert.Single(handler.Calls).Body);
        var root = sent.RootElement;
        Assert.Equal(id, root.GetProperty("p_case_id").GetGuid());
        Assert.Equal("Da kiem tra log soat ve cong G1.", root.GetProperty("p_body").GetString());
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }

    [Fact]
    public async Task Org_refunds_filter_by_status_and_forward_the_jwt()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/refunds?status=requested&limit=50&offset=0", Ct);

        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("/rest/v1/refunds", request.RequestUri!.AbsolutePath);
        var query = Uri.UnescapeDataString(request.RequestUri.Query);
        Assert.Contains("status=eq.REQUESTED", query);
        Assert.Contains("booking_id", query);
        Assert.Equal(UserJwt, request.Headers.Authorization!.Parameter);
    }
}
