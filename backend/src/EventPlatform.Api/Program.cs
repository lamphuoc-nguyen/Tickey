using System.Net;
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
        context.Response.StatusCode = e.Status switch
        {
            HttpStatusCode.Unauthorized => StatusCodes.Status401Unauthorized,
            _ when e.IsAppError => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status502BadGateway,
        };
        await context.Response.WriteAsJsonAsync(new { message = e.Message, details = e.Details });
    }
});

app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPaymentEndpoints();

app.Run();
