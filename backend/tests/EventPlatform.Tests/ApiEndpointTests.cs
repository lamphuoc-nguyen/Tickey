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
    public async Task Admin_events_default_to_pending_review()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"), UserJwt);

        await client.GetAsync("/api/admin/events", Ct);

        var url = Uri.UnescapeDataString(Assert.Single(handler.Calls).Request.RequestUri!.Query);
        Assert.Contains("status=eq.PENDING_REVIEW", url);
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
    public async Task Org_and_admin_endpoints_need_a_jwt(string path)
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path, Ct)).StatusCode);
        Assert.Empty(handler.Calls);
    }
}
