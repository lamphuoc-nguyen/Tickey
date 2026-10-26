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
    private const string TestHmacKey = "test-hmac-key-for-tests-only";

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
            if (gateway is not null) 
            {
                builder.UseSetting("Payments:Gateway", gateway);
                builder.UseSetting("Payments:Test:HmacKey", TestHmacKey);
            }
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => handler));
        });
        return (factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }), handler);
    }

    private static FormUrlEncodedContent Form(string result, string returnUrl = ReturnUrl) => new(new Dictionary<string, string>
    {
        ["result"] = result, ["amount"] = "180000", ["return"] = returnUrl, ["sig"] = ComputeTestSig("X-1", 180000, returnUrl)
    });

    private static string ComputeTestSig(string orderRef, long amount, string returnUrl)
    {
        var data = $"{orderRef}|{amount}|{returnUrl}";
        using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(TestHmacKey));
        var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash);
    }

    [Fact]
    public void Payment_url_is_the_apis_own_checkout_page()
    {
        var gateway = new TestPaymentGateway(Microsoft.Extensions.Options.Options.Create(new TestPaymentOptions { HmacKey = TestHmacKey }));
        var url = gateway.BuildPaymentUrl(
            new PaymentOrder("9E9C876293-1", 180000, "TEST", DateTimeOffset.UtcNow), new Uri(ReturnUrl));

        Assert.Equal("https://api.test/payments/test/9E9C876293-1", url.GetLeftPart(UriPartial.Path));
        Assert.Contains("amount=180000", url.Query);
        Assert.Contains(Uri.EscapeDataString(ReturnUrl), url.Query);
        Assert.Contains("sig=", url.Query);
    }

    [Fact]
    public async Task Checkout_page_does_not_exist_without_test_mode()
    {
        var (client, _) = Create(gateway: null);

        var res = await client.GetAsync($"/payments/test/X-1?amount=1&return={Uri.EscapeDataString(ReturnUrl)}&sig=invalid", Ct);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Pay_records_success_with_the_amount_then_returns_to_the_app()
    {
        var (client, handler) = Create("TEST");
        var sig = ComputeTestSig("X-1", 180000, ReturnUrl);

        var page = await client.GetStringAsync($"/payments/test/X-1?amount=180000&return={Uri.EscapeDataString(ReturnUrl)}&sig={Uri.EscapeDataString(sig)}", Ct);
        var res = await client.PostAsync("/payments/test/X-1", Form("success"), Ct);

        Assert.Contains("180.000", page);
        Assert.Equal(HttpStatusCode.Redirect, res.StatusCode);
        Assert.Equal(ReturnUrl, res.Headers.Location!.ToString());
        
        // Two calls: get_payment_by_order_ref (idempotency check) + apply_payment_success
        Assert.Equal(2, handler.Calls.Count);
        var (request, body) = handler.Calls[1];
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
        var sig = ComputeTestSig("X-1", 180000, ReturnUrl);

        var res = await client.PostAsync("/payments/test/X-1", Form("fail"), Ct);

        Assert.Equal(HttpStatusCode.Redirect, res.StatusCode);
        
        // Two calls: get_payment_by_order_ref (idempotency check) + apply_payment_failure
        Assert.Equal(2, handler.Calls.Count);
        var (request, body) = handler.Calls[1];
        Assert.EndsWith("/rpc/apply_payment_failure", request.RequestUri!.AbsolutePath);
        Assert.Equal("TEST_DECLINED", JsonDocument.Parse(body).RootElement.GetProperty("p_reason").GetString());
    }

    [Fact]
    public async Task Never_redirects_outside_the_api()
    {
        var (client, handler) = Create("TEST");
        var evilReturn = "https://evil.test/payments/return";
        var evilSig = ComputeTestSig("X-1", 180000, evilReturn);

        var res = await client.PostAsync("/payments/test/X-1", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["result"] = "success", ["amount"] = "180000", ["return"] = evilReturn, ["sig"] = evilSig
        }), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Post_missing_sig_returns_400()
    {
        var (client, _) = Create("TEST");

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["result"] = "success", ["amount"] = "180000", ["return"] = ReturnUrl
            // no sig
        });

        var res = await client.PostAsync("/payments/test/X-1", form, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Post_wrong_sig_returns_400()
    {
        var (client, _) = Create("TEST");

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["result"] = "success", ["amount"] = "180000", ["return"] = ReturnUrl, ["sig"] = "wrong-signature"
        });

        var res = await client.PostAsync("/payments/test/X-1", form, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Get_wrong_sig_returns_400()
    {
        var (client, _) = Create("TEST");

        var res = await client.GetAsync($"/payments/test/X-1?amount=180000&return={Uri.EscapeDataString(ReturnUrl)}&sig=wrong-signature", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Post_twice_same_order_ref_only_one_apply_payment_success()
    {
        var paymentProcessed = false;
        var handler = new FakeHttpHandler((req, _) => 
        {
            var segments = req.RequestUri!.Segments;
            var segment = segments[^1];
            
            if (segment == "get_payment_by_order_ref")
            {
                // First call: payment not yet processed, return INITIATED (no status property in mock)
                // Second call: payment already processed, return SUCCEEDED
                if (paymentProcessed)
                {
                    return (HttpStatusCode.OK, """{"status":"SUCCEEDED"}""");
                }
                return (HttpStatusCode.OK, """{"result":"PAID"}""");
            }
            if (segment == "apply_payment_success")
            {
                paymentProcessed = true;
                return (HttpStatusCode.OK, """{"result":"PAID"}""");
            }
            if (segment == "apply_payment_failure")
            {
                return (HttpStatusCode.OK, """{"result":"FAILED"}""");
            }
            return (HttpStatusCode.OK, "null");
        });
        
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("Api:PublicUrl", "https://api.test");
            builder.UseSetting("Payments:Gateway", "TEST");
            builder.UseSetting("Payments:Test:HmacKey", TestHmacKey);
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<SupabaseRpcClient>().ConfigurePrimaryHttpMessageHandler(() => handler));
        });
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var sig = ComputeTestSig("X-1", 180000, ReturnUrl);

        // First, load the checkout page (exactly like the working test)
        await client.GetStringAsync($"/payments/test/X-1?amount=180000&return={Uri.EscapeDataString(ReturnUrl)}&sig={Uri.EscapeDataString(sig)}", Ct);

        // First POST - use exact same Form helper as working test
        var res1 = await client.PostAsync("/payments/test/X-1", Form("success"), Ct);
        Assert.Equal(HttpStatusCode.Redirect, res1.StatusCode);

        // Check handler calls after first POST - should be 2: get_payment_by_order_ref + apply_payment_success
        Assert.Equal(2, handler.Calls.Count);
        var applyCall1 = handler.Calls[1];
        Assert.EndsWith("/rpc/apply_payment_success", applyCall1.Request.RequestUri!.AbsolutePath);

        // Second POST (same order_ref) - create new form exactly like first
        var res2 = await client.PostAsync("/payments/test/X-1", Form("success"), Ct);
        Assert.Equal(HttpStatusCode.Redirect, res2.StatusCode);

        // Should only have 3 calls total: get_payment_by_order_ref (first) + apply_payment_success (first) + get_payment_by_order_ref (second)
        // Second POST should NOT call apply_payment_success again
        Assert.Equal(3, handler.Calls.Count);
        
        var applyCalls = handler.Calls.Where(c => c.Request.RequestUri!.AbsolutePath.EndsWith("/rpc/apply_payment_success")).ToArray();
        Assert.Single(applyCalls);
        
        var getPaymentCalls = handler.Calls.Where(c => c.Request.RequestUri!.AbsolutePath.EndsWith("/rpc/get_payment_by_order_ref")).ToArray();
        Assert.Equal(2, getPaymentCalls.Length);
    }
}
