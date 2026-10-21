using System.Net;
using System.Security.Cryptography;
using System.Text;
using EventPlatform.Core;
using EventPlatform.Core.Media;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class CloudinaryImageTests
{
    private static readonly Guid Owner = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Asset = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private const string Secret = "unit-test-only-secret";
    private const long Timestamp = 1792576800;
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private sealed class Clock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => DateTimeOffset.FromUnixTimeSeconds(Timestamp);
    }
    private static CloudinaryOptions Settings() => new()
    {
        CloudName = "tickey-test",
        ApiKey = "123456789",
        ApiSecret = Secret,
        PublicIdPrefix = "tickey",
    };
    private static string Id(string bucket) => $"tickey/{bucket}/{Owner:D}/{Asset:N}";
    private static string Response(string bucket, string type) => $$"""
        {"public_id":"{{Id(bucket)}}","resource_type":"image","type":"{{type}}","format":"png","secure_url":"https://res.cloudinary.com/tickey-test/image/{{type}}/v1/{{Id(bucket)}}.png"}
        """;
    private static CloudinaryImageClient Client(FakeHttpHandler handler) =>
        new(new HttpClient(handler), Options.Create(Settings()), new Clock());

    [Fact]
    public async Task Public_upload_signs_exact_fields_and_never_sends_secret_or_supabase_auth()
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, Response("event-assets", "upload")));
        var result = await Client(handler).UploadAsync("event-assets", Owner, Asset, new MemoryStream([1]), "image/png", Ct);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("https://api.cloudinary.com/v1_1/tickey-test/image/upload", request.RequestUri!.ToString());
        var canonical = $"allowed_formats=jpg,png,webp&asset_folder=tickey/event-assets/{Owner:D}&overwrite=false&public_id={Id("event-assets")}&timestamp={Timestamp}&type=upload{Secret}";
        Assert.Contains(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))), body);
        Assert.Contains("jpg,png,webp", body);
        Assert.Contains("name=asset_folder", body);
        Assert.Contains($"tickey/event-assets/{Owner:D}", body);
        Assert.Contains("123456789", body);
        Assert.DoesNotContain(Secret, body);
        Assert.DoesNotContain("upload_preset", body);
        Assert.Null(request.Headers.Authorization);
        Assert.Contains("/image/upload/", result);
    }

    [Theory]
    [InlineData("kyc-private")]
    [InlineData("report-evidence")]
    public async Task Private_upload_is_authenticated_and_returns_no_public_url(string bucket)
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, Response(bucket, "authenticated")));
        var result = await Client(handler).UploadAsync(bucket, Owner, Asset, new MemoryStream([1]), "image/png", Ct);
        Assert.Null(result);
        var canonical = $"allowed_formats=jpg,png,webp&asset_folder=tickey/{bucket}/{Owner:D}&overwrite=false&public_id={Id(bucket)}&timestamp={Timestamp}&type=authenticated{Secret}";
        Assert.Contains("name=asset_folder", Assert.Single(handler.Calls).Body);
        Assert.Contains($"tickey/{bucket}/{Owner:D}", Assert.Single(handler.Calls).Body);
        Assert.Contains(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))), Assert.Single(handler.Calls).Body);
    }

    [Theory]
    [InlineData(401)]
    [InlineData(429)]
    [InlineData(500)]
    public async Task Provider_error_never_relays_credential_bearing_response_or_becomes_success(int status)
    {
        var handler = new FakeHttpHandler((_, _) => ((HttpStatusCode)status, $"error: {Secret}"));
        var error = await Assert.ThrowsAsync<RpcException>(() => Client(handler).UploadAsync("event-assets", Owner, Asset, new MemoryStream([1]), "image/png", Ct));
        Assert.Equal(HttpStatusCode.BadGateway, error.Status);
        Assert.Equal("UPLOAD_FAILED", error.Message);
        Assert.DoesNotContain(Secret, error.ToString());
        Assert.DoesNotContain(Secret, error.Details ?? "");
        Assert.Single(handler.Calls); // no automatic replay of an uncertain write
    }

    [Theory]
    [InlineData("not-json")]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("null")]
    public async Task Malformed_success_is_an_error(string body)
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, body));
        await Assert.ThrowsAsync<RpcException>(() => Client(handler).UploadAsync("event-assets", Owner, Asset, new MemoryStream([1]), "image/png", Ct));
    }

    [Theory]
    [InlineData("/image/upload/", "/image/authenticated/")]
    [InlineData("res.cloudinary.com", "untrusted.example")]
    [InlineData("https://", "http://")]
    [InlineData("\"type\":\"upload\"", "\"type\":\"authenticated\"")]
    [InlineData("\"format\":\"png\"", "\"format\":\"pdf\"")]
    public async Task Unexpected_delivery_or_file_metadata_is_not_accepted(string before, string after)
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, Response("event-assets", "upload").Replace(before, after)));
        await Assert.ThrowsAsync<RpcException>(() => Client(handler).UploadAsync("event-assets", Owner, Asset, new MemoryStream([1]), "image/png", Ct));
    }

    [Fact]
    public async Task Private_upload_cannot_accept_a_public_delivery_type()
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, Response("kyc-private", "upload")));
        await Assert.ThrowsAsync<RpcException>(() => Client(handler).UploadAsync("kyc-private", Owner, Asset, new MemoryStream([1]), "image/png", Ct));
    }

    [Fact]
    public void Private_access_has_short_expiry_and_signature_covers_resource_and_delivery_type()
    {
        var client = Client(new FakeHttpHandler((_, _) => throw new InvalidOperationException("No network needed for signing")));
        var result = client.PrivateAccess("kyc-private", Owner, Asset, "png");
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(Timestamp + 120), result.ExpiresAt);
        var uri = new Uri(result.Url);
        Assert.Equal("https://api.cloudinary.com/v1_1/tickey-test/image/download", uri.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(uri.Query);
        Assert.Equal("authenticated", query["type"].ToString());
        Assert.Equal(Id("kyc-private"), query["public_id"].ToString());
        Assert.Equal((Timestamp + 120).ToString(), query["expires_at"].ToString());
        var canonical = $"expires_at={Timestamp + 120}&format=png&public_id={Id("kyc-private")}&timestamp={Timestamp}&type=authenticated{Secret}";
        Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))), query["signature"].ToString());
        Assert.DoesNotContain(Secret, result.Url);
    }

    [Theory]
    [InlineData("Supabase", false)]
    [InlineData("Cloudinary", true)]
    public void Config_validation_requires_cloud_keys_only_when_provider_is_selected(string provider, bool invalid)
    {
        var values = new Dictionary<string, string?> { ["MediaStorage:ImageProvider"] = provider };
        var services = new ServiceCollection();
        services.AddEventPlatformCore(new ConfigurationBuilder().AddInMemoryCollection(values).Build());
        using var container = services.BuildServiceProvider();
        var options = container.GetRequiredService<IOptions<CloudinaryOptions>>();
        if (invalid) Assert.Throws<OptionsValidationException>(() => options.Value);
        else Assert.NotNull(options.Value);
    }

    [Fact]
    public void Unknown_provider_is_not_silently_treated_as_supabase()
    {
        var services = new ServiceCollection();
        services.AddEventPlatformCore(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["MediaStorage:ImageProvider"] = "Cloudinray" }).Build());
        using var container = services.BuildServiceProvider();
        Assert.Throws<OptionsValidationException>(() => container.GetRequiredService<IOptions<MediaStorageOptions>>().Value);
    }
}
