using System.Net;
using EventPlatform.Core.Media;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class MediaStorageAccessTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static SupabaseStorageClient Client(FakeHttpHandler handler) => new(new HttpClient(handler),
        Options.Create(new SupabaseOptions { Url = "http://storage.test", AnonKey = "sb_publishable_test" }));

    [Fact]
    public async Task Storage_rls_error_returned_as_400_stays_forbidden()
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.BadRequest,
            """{"message":"new row violates row-level security policy"}"""));
        var error = await Assert.ThrowsAsync<RpcException>(() => Client(handler).SignedUrlAsync("report-evidence", "owner/image.png", 120, "e30.e30.sig", Ct));
        Assert.Equal("FORBIDDEN", error.Message);
        Assert.Equal(HttpStatusCode.Forbidden, error.Status);
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("{\"signedURL\":\"https://other.example/image.png?token=test\"}")]
    [InlineData("{\"signedURL\":\"/object/sign/report-evidence/owner/image.png?\"}")]
    public async Task Invalid_legacy_link_is_an_error_instead_of_a_successful_url(string body)
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, body));
        var error = await Assert.ThrowsAsync<RpcException>(() => Client(handler).SignedUrlAsync("report-evidence", "owner/image.png", 120, "e30.e30.sig", Ct));
        Assert.Equal("MEDIA_ACCESS_FAILED", error.Message);
        Assert.Equal(HttpStatusCode.BadGateway, error.Status);
    }

    [Theory]
    [InlineData("", "tickey")]
    [InlineData(null, "tickey")]
    [InlineData("cloud", "../tickey")]
    [InlineData("cloud", null)]
    [InlineData("https://cloud", "tickey")]
    public void Empty_or_unsafe_config_is_invalid_without_throwing_or_leaking_keys(string? cloudName, string? prefix)
    {
        var options = new CloudinaryOptions { CloudName = cloudName!, PublicIdPrefix = prefix!, ApiKey = "unit-key", ApiSecret = "unit-secret" };
        Assert.False(options.IsValid);
    }
}
