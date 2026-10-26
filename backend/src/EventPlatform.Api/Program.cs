using EventPlatform.Api;
using EventPlatform.Core;
using EventPlatform.Core.Outbox;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEventPlatformCore(builder.Configuration);
builder.Services.AddProblemDetails();
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

app.UseCors();
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
