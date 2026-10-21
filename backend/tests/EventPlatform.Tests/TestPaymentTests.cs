using System.Net;
using System.Text.Json;
using EventPlatform.Api;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace EventPlatform.Tests;

/// <summary>Payments:Gateway = TEST: the fake checkout page records the result through the payment RPCs.</summary>
public class TestPaymentTests
{
    private const string ReturnUrl = "https://api.test/payments/return?booking_id=11111111-1111-1111-1111-111111111111";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static (HttpClient Client, FakeHttpHandler Handler) Create(string? gateway)
    {
        var handler = new FakeHttpHandler((_, _) => (HttpStatusCode.OK, """{"result":"PAID"}"""));
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("Api:PublicUrl", "https://api.test");
            if (gateway is not null) builder.UseSetting("Payments:Gateway", gateway);
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => handler));
        });
        return (factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }), handler);
    }

    private static FormUrlEncodedContent Form(string result, string returnUrl = ReturnUrl) => new(new Dictionary<string, string>
    {
        ["result"] = result, ["amount"] = "180000", ["return"] = returnUrl,
    });

    [Fact]
    public void Payment_url_is_the_apis_own_checkout_page()
    {
        var url = new TestPaymentGateway().BuildPaymentUrl(
            new PaymentOrder("9E9C876293-1", 180000, "TEST", DateTimeOffset.UtcNow), new Uri(ReturnUrl));

        Assert.Equal("https://api.test/payments/test/9E9C876293-1", url.GetLeftPart(UriPartial.Path));
        Assert.Contains("amount=180000", url.Query);
        Assert.Contains(Uri.EscapeDataString(ReturnUrl), url.Query);
    }

    [Fact]
    public async Task Checkout_page_does_not_exist_without_test_mode()
    {
        var (client, _) = Create(gateway: null);

        var res = await client.GetAsync($"/payments/test/X-1?amount=1&return={Uri.EscapeDataString(ReturnUrl)}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Pay_records_success_with_the_amount_then_returns_to_the_app()
    {
        var (client, handler) = Create("TEST");

        var page = await client.GetStringAsync($"/payments/test/X-1?amount=180000&return={Uri.EscapeDataString(ReturnUrl)}", Ct);
        var res = await client.PostAsync("/payments/test/X-1", Form("success"), Ct);

        Assert.Contains("180.000", page);
        Assert.Equal(HttpStatusCode.Redirect, res.StatusCode);
        Assert.Equal(ReturnUrl, res.Headers.Location!.ToString());
        var (request, body) = Assert.Single(handler.Calls);
        Assert.EndsWith("/rpc/apply_payment_success", request.RequestUri!.AbsolutePath);
        var args = JsonDocument.Parse(body).RootElement;
        Assert.Equal("X-1", args.GetProperty("p_order_ref").GetString());
        Assert.Equal(180000, args.GetProperty("p_amount").GetInt64());
        Assert.StartsWith("TEST-", args.GetProperty("p_gateway_txn_id").GetString());
    }

    [Fact]
    public async Task Fail_records_a_declined_payment()
    {
        var (client, handler) = Create("TEST");

        var res = await client.PostAsync("/payments/test/X-1", Form("fail"), Ct);

        Assert.Equal(HttpStatusCode.Redirect, res.StatusCode);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.EndsWith("/rpc/apply_payment_failure", request.RequestUri!.AbsolutePath);
        Assert.Equal("TEST_DECLINED", JsonDocument.Parse(body).RootElement.GetProperty("p_reason").GetString());
    }

    [Fact]
    public async Task Never_redirects_outside_the_api()
    {
        var (client, handler) = Create("TEST");

        var res = await client.PostAsync("/payments/test/X-1", Form("success", "https://evil.test/payments/return"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Empty(handler.Calls);
    }
}
