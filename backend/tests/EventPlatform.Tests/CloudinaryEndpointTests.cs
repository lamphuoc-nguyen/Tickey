using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using EventPlatform.Api;
using EventPlatform.Core.Media;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace EventPlatform.Tests;

public class CloudinaryEndpointTests
{
    private static readonly Guid User = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Org = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly string Jwt = $"e30.{Base64Url.Encode(Encoding.UTF8.GetBytes($$"""{"sub":"{{User}}"}"""))}.sig";
    private static readonly string CloudPath = $"{User}/cloudinary/22222222222222222222222222222222.png";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class Factory(bool orgAllowed = false, bool platformAllowed = false,
        HttpStatusCode authStatus = HttpStatusCode.OK, HttpStatusCode cloudStatus = HttpStatusCode.OK)
        : WebApplicationFactory<IApiMarker>
    {
        public FakeHttpHandler Supabase { get; } = new((request, _) =>
        {
            var url = request.RequestUri!.AbsolutePath;
            if (url == "/auth/v1/user") return (authStatus, $$"""{"id":"{{User}}"}""");
            if (url.EndsWith("/rpc/has_org_role")) return (HttpStatusCode.OK, orgAllowed ? "true" : "false");
            if (url.EndsWith("/rpc/has_platform_role")) return (HttpStatusCode.OK, platformAllowed ? "true" : "false");
            if (url.StartsWith("/storage/v1/object/sign/"))
                return (HttpStatusCode.OK, $$"""{"signedURL":"{{url["/storage/v1".Length..]}}?token=test-only"}""");
            if (url.StartsWith("/storage/v1/object/")) return (HttpStatusCode.OK, "{}");
            throw new InvalidOperationException("Unexpected Supabase request");
        });
        public FakeHttpHandler Cloud { get; } = new((_, body) =>
        {
            string Field(string name) => Regex.Match(body, "name=\"?" + name + "\"?\\r\\n\\r\\n([^\\r]+)").Groups[1].Value;
            var id = Field("public_id");
            var type = Field("type");
            return (cloudStatus, $$"""{"public_id":"{{id}}","resource_type":"image","format":"png","type":"{{type}}","secure_url":"https://res.cloudinary.com/tickey-test/image/{{type}}/v1/{{id}}.png"}""");
        });
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Supabase:Url", "http://media.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("MediaStorage:ImageProvider", "Cloudinary");
            builder.UseSetting("Cloudinary:CloudName", "tickey-test");
            builder.UseSetting("Cloudinary:ApiKey", "123456789");
            builder.UseSetting("Cloudinary:ApiSecret", "unit-test-only-secret");
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient<SupabaseAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Supabase);
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => Supabase);
                services.AddHttpClient<SupabaseStorageClient>().ConfigurePrimaryHttpMessageHandler(() => Supabase);
                services.AddHttpClient<CloudinaryImageClient>().ConfigurePrimaryHttpMessageHandler(() => Cloud);
            });
        }
        public HttpClient SignedClient()
        {
            var client = CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Jwt);
            return client;
        }
    }
    private static MultipartFormDataContent Upload(string purpose, Guid? org = null, string contentType = "image/png")
    {
        var file = new ByteArrayContent(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII="));
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var result = new MultipartFormDataContent { { file, "file", "image.png" }, { new StringContent(purpose), "purpose" } };
        if (org.HasValue) result.Add(new StringContent(org.Value.ToString()), "orgId");
        return result;
    }

    [Theory]
    [InlineData("EVENT_ASSET", "event-assets")]
    [InlineData("KYC", "kyc-private")]
    [InlineData("REPORT_EVIDENCE", "report-evidence")]
    public async Task Uploads_keep_contract_and_server_owned_paths_without_publicizing_private_images(string purpose, string bucket)
    {
        using var factory = new Factory(orgAllowed: true);
        using var client = factory.SignedClient();
        var response = await client.PostAsync("/api/uploads", Upload(purpose, Org), Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(bucket, result.GetProperty("bucket").GetString());
        Assert.StartsWith($"{(purpose == "REPORT_EVIDENCE" ? User : Org)}/cloudinary/", result.GetProperty("path").GetString());
        if (purpose == "EVENT_ASSET") Assert.StartsWith("https://res.cloudinary.com/", result.GetProperty("public_url").GetString());
        else Assert.Equal(JsonValueKind.Null, result.GetProperty("public_url").ValueKind);
        Assert.Single(factory.Cloud.Calls);
        Assert.DoesNotContain(factory.Supabase.Calls, call => call.Request.RequestUri!.AbsolutePath.StartsWith("/storage/"));
    }

    [Theory]
    [InlineData("EVENT_ASSET")]
    [InlineData("KYC")]
    public async Task Missing_live_org_permission_blocks_upload_before_cloudinary(string purpose)
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var result = await client.PostAsync("/api/uploads", Upload(purpose, Org), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, result.StatusCode);
        Assert.Empty(factory.Cloud.Calls);
        var role = Assert.Single(factory.Supabase.Calls, call => call.Request.RequestUri!.AbsolutePath.EndsWith("/rpc/has_org_role"));
        using var body = JsonDocument.Parse(role.Body);
        Assert.Equal(Org, body.RootElement.GetProperty("p_org_id").GetGuid());
        Assert.Equal(purpose == "KYC" ? "[\"OWNER\"]" : "[\"OWNER\",\"EVENT_MANAGER\"]", body.RootElement.GetProperty("p_roles").GetRawText());
        Assert.Equal($"Bearer {Jwt}", role.Request.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task Jwt_with_unverified_sub_cannot_upload_or_get_private_access()
    {
        using var factory = new Factory(authStatus: HttpStatusCode.Unauthorized);
        using var client = factory.SignedClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/uploads", Upload("REPORT_EVIDENCE"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/uploads/access", new { purpose = "REPORT_EVIDENCE", path = CloudPath }, Ct)).StatusCode);
        Assert.Empty(factory.Cloud.Calls);
    }

    [Fact]
    public async Task Cloud_failure_is_not_retried_or_fallen_back_to_supabase()
    {
        using var factory = new Factory(cloudStatus: HttpStatusCode.InternalServerError);
        using var client = factory.SignedClient();
        var result = await client.PostAsync("/api/uploads", Upload("REPORT_EVIDENCE"), Ct);
        Assert.Equal(HttpStatusCode.BadGateway, result.StatusCode);
        Assert.Single(factory.Cloud.Calls);
        Assert.DoesNotContain(factory.Supabase.Calls, call => call.Request.RequestUri!.AbsolutePath.StartsWith("/storage/"));
    }

    [Fact]
    public async Task Own_evidence_access_is_time_bound_and_not_shared_cacheable()
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var response = await client.PostAsJsonAsync("/api/uploads/access", new { purpose = "REPORT_EVIDENCE", path = CloudPath }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl!.NoStore);
        var result = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.StartsWith("https://api.cloudinary.com/v1_1/tickey-test/image/download?", result.GetProperty("url").GetString());
        Assert.InRange(result.GetProperty("expires_at").GetDateTimeOffset(), DateTimeOffset.UtcNow.AddSeconds(100), DateTimeOffset.UtcNow.AddSeconds(125));
        Assert.Empty(factory.Cloud.Calls);
    }

    [Theory]
    [InlineData("REPORT_EVIDENCE")]
    [InlineData("KYC")]
    public async Task Private_access_denies_other_tenant_or_user_without_reviewer_role(string purpose)
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var result = await client.PostAsJsonAsync("/api/uploads/access", new { purpose, path = $"{Org}/cloudinary/22222222222222222222222222222222.png" }, Ct);
        Assert.Equal(HttpStatusCode.Forbidden, result.StatusCode);
        var role = Assert.Single(factory.Supabase.Calls, call => call.Request.RequestUri!.AbsolutePath.EndsWith("/rpc/has_platform_role"));
        Assert.Contains(purpose == "KYC" ? "KYC_REVIEWER" : "DISPUTE_ADMIN", role.Body);
    }

    [Theory]
    [InlineData("REPORT_EVIDENCE")]
    [InlineData("KYC")]
    public async Task Authorized_reviewer_can_request_private_link(string purpose)
    {
        using var factory = new Factory(platformAllowed: true);
        using var client = factory.SignedClient();
        var result = await client.PostAsJsonAsync("/api/uploads/access", new { purpose, path = $"{Org}/cloudinary/22222222222222222222222222222222.png" }, Ct);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
    }

    [Theory]
    [InlineData("../secret.png")]
    [InlineData("11111111-1111-1111-1111-111111111111/../secret.png")]
    [InlineData("11111111-1111-1111-1111-111111111111/a.png?token=x")]
    [InlineData("11111111-1111-1111-1111-111111111111/%2e%2e/a.png")]
    public async Task Malformed_paths_are_rejected_before_authorization_or_signing(string path)
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var result = await client.PostAsJsonAsync("/api/uploads/access", new { purpose = "REPORT_EVIDENCE", path }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Empty(factory.Supabase.Calls);
    }

    [Fact]
    public async Task Legacy_private_object_is_signed_through_supabase_as_the_user()
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var response = await client.PostAsJsonAsync("/api/uploads/access", new { purpose = "REPORT_EVIDENCE", path = $"{User}/existing.png" }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var call = Assert.Single(factory.Supabase.Calls, call => call.Request.RequestUri!.AbsolutePath.StartsWith("/storage/"));
        Assert.Equal($"Bearer {Jwt}", call.Request.Headers.Authorization!.ToString());
        Assert.Equal("{\"expiresIn\":120}", call.Body);
        Assert.Empty(factory.Cloud.Calls);
    }

    [Fact]
    public async Task Pdf_upload_keeps_existing_supabase_route()
    {
        using var factory = new Factory();
        using var client = factory.SignedClient();
        var response = await client.PostAsync("/api/uploads", Upload("KYC", Org, "application/pdf"), Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(factory.Supabase.Calls);
        Assert.Empty(factory.Cloud.Calls);
    }
}
