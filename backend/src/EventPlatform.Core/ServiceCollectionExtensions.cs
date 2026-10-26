using EventPlatform.Core.Payments;
using EventPlatform.Core.Media;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EventPlatform.Core;

public static class ServiceCollectionExtensions
{
    /// <summary>Supabase RPC client and the payment gateway adapter shared by Api and Workers.</summary>
    public static IServiceCollection AddEventPlatformCore(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<SupabaseOptions>()
            .Bind(config.GetSection(SupabaseOptions.Section))
            .Validate(o => !string.IsNullOrEmpty(o.Url), "Supabase:Url is required")
            .Validate(o => !string.IsNullOrEmpty(o.AnonKey), "Supabase:AnonKey is required")
            .Validate(o => !string.IsNullOrEmpty(o.ServiceRoleKey), "Supabase:ServiceRoleKey is required (user-secrets)")
            .ValidateOnStart();
        services.AddHttpClient<SupabaseRpcClient>();
        services.AddHttpClient<SupabaseRestClient>();
        services.AddHttpClient<SupabaseAuthClient>();
        services.AddHttpClient<SupabaseStorageClient>();
        services.AddOptions<MediaStorageOptions>()
            .Bind(config.GetSection(MediaStorageOptions.Section))
            .Validate(o => o.IsValid, "MediaStorage:ImageProvider must be Supabase or Cloudinary")
            .ValidateOnStart();
        services.AddOptions<CloudinaryOptions>()
            .Bind(config.GetSection(CloudinaryOptions.Section))
            .Validate(o => !string.Equals(config["MediaStorage:ImageProvider"], "Cloudinary", StringComparison.OrdinalIgnoreCase)
                || o.IsValid, "Cloudinary requires CloudName, ApiKey, ApiSecret and a valid PublicIdPrefix (API user-secrets)")
            .ValidateOnStart();
        services.AddSingleton(TimeProvider.System);
        services.AddTransient<MediaAuthorization>();
        services.AddHttpClient<CloudinaryImageClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
        var gateway = config["Payments:Gateway"];
        if (IsTestPayments(config))
        {
            services.AddOptions<TestPaymentOptions>()
                .Bind(config.GetSection("Payments:Test"))
                .Validate(o => !string.IsNullOrEmpty(o.HmacKey), "Payments:Test:HmacKey is required for TEST gateway")
                .ValidateOnStart();
            services.AddSingleton<TestPaymentGateway>(sp => 
                new TestPaymentGateway(sp.GetRequiredService<IOptions<TestPaymentOptions>>()));
            services.AddSingleton<IPaymentGateway>(sp => sp.GetRequiredService<TestPaymentGateway>());
        }
        else if (!string.IsNullOrEmpty(gateway))
        {
            // Gateway specified but not supported - fail fast at startup
            throw new InvalidOperationException($"Unsupported payment gateway: '{gateway}'. Supported: 'TEST' (OQ-02 not decided).");
        }
        else
        {
            // No gateway configured - register placeholder that throws at runtime with clear message
            services.AddSingleton<IPaymentGateway, UnconfiguredPaymentGateway>();
        }
        return services;
    }

    /// <summary>Payments:Gateway = TEST turns on the fake checkout (TestPaymentGateway).</summary>
    public static bool IsTestPayments(IConfiguration config) =>
        string.Equals(config["Payments:Gateway"], TestPaymentGateway.Code, StringComparison.OrdinalIgnoreCase);
}
