using System;
using System.Linq;
using EventPlatform.Api;
using EventPlatform.Core;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class PaymentGatewayConfigTests
{
    [Fact]
    public void Unsupported_gateway_throws_at_startup()
    {
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("MediaStorage:ImageProvider", "Supabase");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("Payments:Gateway", "VNPAY");
        });

        var ex = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("Unsupported payment gateway: 'VNPAY'", ex.Message);
        Assert.Contains("TEST", ex.Message);
    }

    [Fact]
    public void No_gateway_registers_unconfigured_placeholder()
    {
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("MediaStorage:ImageProvider", "Supabase");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            // No Payments:Gateway setting
        });

        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var gateway = scope.ServiceProvider.GetRequiredService<IPaymentGateway>();
        
        Assert.IsType<UnconfiguredPaymentGateway>(gateway);
    }

    [Fact]
    public void Test_gateway_requires_hmac_key()
    {
        var factory = new WebApplicationFactory<IApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("MediaStorage:ImageProvider", "Supabase");
            builder.UseSetting("Supabase:Url", "http://db.test");
            builder.UseSetting("Supabase:AnonKey", "sb_publishable_test");
            builder.UseSetting("Supabase:ServiceRoleKey", "sb_secret_test");
            builder.UseSetting("Payments:Gateway", "TEST");
            // No Payments:Test:HmacKey
        });

        var ex = Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
        Assert.Contains("Payments:Test:HmacKey is required for TEST gateway", ex.Message);
    }
}