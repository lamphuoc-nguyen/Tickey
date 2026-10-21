using EventPlatform.Api;
using EventPlatform.Core;
using EventPlatform.Core.Supabase;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEventPlatformCore(builder.Configuration);
builder.Services.AddProblemDetails();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();
var security = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Security");

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
        // AC-15: a refused access to another tenant's resource is recorded as a security event. The database
        // can only `raise log` it, because the refusing transaction rolls back any row it would write.
        if (e.Message is "FORBIDDEN" or "DEVICE_REVOKED")
        {
            var token = Bearer.Token(context);
            security.LogWarning("SECURITY.{Code} user={UserId} {Method} {Path}", e.Message,
                token is null ? "anonymous" : Bearer.Claim(token, "sub") ?? "invalid-token",
                context.Request.Method, context.Request.Path.Value);
        }
        await context.Response.WriteAsJsonAsync(new { message = e.Message, details = e.Details });
    }
});

app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPaymentEndpoints();
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
