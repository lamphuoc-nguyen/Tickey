using EventPlatform.Api;
using EventPlatform.Core;
using EventPlatform.Core.Outbox;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEventPlatformCore(builder.Configuration);
builder.Services.AddProblemDetails();

// ForwardedHeaders for Render proxy - must run before rate limiting (B-14)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
    options.ForwardLimit = 1;
});

// Rate limiting for auth endpoints (B-14): per-client-IP, configurable
var permitLimit = builder.Configuration.GetValue<int>("RateLimit:Auth:PermitLimit", 10);
var windowSeconds = builder.Configuration.GetValue<int>("RateLimit:Auth:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0 // Reject immediately, no queue
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        // Use remaining time from lease metadata if available, otherwise full window
        int retryAfter = windowSeconds;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterMetadata))
        {
            retryAfter = (int)Math.Ceiling(retryAfterMetadata.TotalSeconds);
        }
        context.HttpContext.Response.Headers.RetryAfter = retryAfter.ToString();
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "RATE_LIMITED",
            details = $"{{\"retry_after_seconds\":{retryAfter}}}"
        }, cancellationToken);
    };
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

// With a QR signing key the API also issues tickets for PAID bookings, so a single free host
// (no separate Workers service) can take a booking all the way to signed tickets.
if (!string.IsNullOrEmpty(builder.Configuration["Qr:SigningKey"]))
{
    builder.Services.Configure<QrOptions>(builder.Configuration.GetSection(QrOptions.Section));
    builder.Services.AddSingleton<QrSigner>();
    builder.Services.AddHostedService<IssueTicketsWorker>();
}

// PaymentQueryJob must run in API as well (render.yaml only has tickey-api service)
// It queries gateway for PAYMENT_PENDING bookings and expires unpaid ones
// Only register when a payment gateway is actually configured (TEST or real gateway)
// and not in Testing environment (tests use fake HTTP handlers that don't support the RPC calls)
var isTesting = builder.Environment.IsEnvironment("Testing");
if (!isTesting && (ServiceCollectionExtensions.IsTestPayments(builder.Configuration) ||
    !string.IsNullOrEmpty(builder.Configuration["Payments:Gateway"])))
{
    builder.Services.AddHostedService<PaymentQueryJob>();
}

var app = builder.Build();

// ForwardedHeaders must run before UseRateLimiter
app.UseForwardedHeaders();

// CORS must run before UseRateLimiter so 429 responses include CORS headers
app.UseCors();

app.UseRateLimiter();

// RPC errors keep the database contract: { message: CODE, details: "<json>" } (supabase/README.md),
// which is exactly what @event/core's ApiError.fromPostgrest parses.
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (RpcException e)
    {
        context.Response.StatusCode = Postgrest.StatusFor(e);
        await context.Response.WriteAsJsonAsync(new { message = e.Message, details = e.Details });
    }
});
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPaymentEndpoints();
if (ServiceCollectionExtensions.IsTestPayments(app.Configuration))
{
    app.MapTestPaymentEndpoints();
}
app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapCatalogEndpoints();
app.MapBookingEndpoints();
app.MapSupportEndpoints();
app.MapCheckInEndpoints();
app.MapUploadEndpoints();
app.MapOrgEndpoints();
app.MapAdminEndpoints();

app.Run();
