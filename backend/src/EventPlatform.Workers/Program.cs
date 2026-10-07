using EventPlatform.Core;
using EventPlatform.Core.Qr;
using EventPlatform.Workers;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddEventPlatformCore(builder.Configuration);
builder.Services.Configure<QrOptions>(builder.Configuration.GetSection(QrOptions.Section));
builder.Services.AddSingleton<QrSigner>();

builder.Services.AddHostedService<IssueTicketsWorker>();
// Still to build (DB_INSTRUCTIONS §8): PaymentQueryJob, RefundWorker (Phước);
// PayoutWorker, ReconciliationJob, NotificationsWorker (Khôi).

builder.Build().Run();
