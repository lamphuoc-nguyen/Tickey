using EventPlatform.Core.Payments;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
        services.AddSingleton<IPaymentGateway, UnconfiguredPaymentGateway>();
        return services;
    }
}
