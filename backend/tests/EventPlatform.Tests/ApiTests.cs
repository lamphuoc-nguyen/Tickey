using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EventPlatform.Tests;

public class ApiTests(ApiTests.Factory factory) : IClassFixture<ApiTests.Factory>
{
    public sealed class Factory : WebApplicationFactory<EventPlatform.Api.IApiMarker>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "a.b.c");
            builder.UseSetting("Supabase:ServiceRoleKey", "s.r.k");
        }
    }

    [Fact]
    public async Task Health_is_ok()
    {
        var res = await factory.CreateClient().GetAsync("/health", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Payment_session_requires_a_bearer_token()
    {
        var res = await factory.CreateClient().PostAsJsonAsync("/payments/sessions",
            new { bookingId = Guid.NewGuid(), gateway = "VNPAY" }, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
