using EventPlatform.Core;
using EventPlatform.Core.Outbox;
using EventPlatform.Core.Payments;
using EventPlatform.Core.Qr;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddEventPlatformCore(builder.Configuration);
builder.Services.Configure<QrOptions>(builder.Configuration.GetSection(QrOptions.Section));
builder.Services.AddSingleton<QrSigner>();

builder.Services.AddHostedService<IssueTicketsWorker>();
builder.Services.AddHostedService<PaymentQueryJob>();
builder.Services.AddHostedService<RefundWorker>();
// Still to build (DB_INSTRUCTIONS §8): PayoutWorker, ReconciliationJob, NotificationsWorker (Khôi).

builder.Build().Run();
