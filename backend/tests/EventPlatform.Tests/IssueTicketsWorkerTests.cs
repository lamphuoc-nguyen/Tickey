using System.Net;
using System.Text.Json;
using EventPlatform.Core.Qr;
using EventPlatform.Core.Supabase;
using EventPlatform.Workers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class IssueTicketsWorkerTests
{
    private static readonly Guid BookingId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TicketId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static (IssueTicketsWorker Worker, FakeHttpHandler Handler, QrSigner Signer) Create(
        Func<string, (HttpStatusCode, string)> byFunction)
    {
        var handler = new FakeHttpHandler((req, _) => byFunction(req.RequestUri!.Segments[^1]));
        var rpc = new SupabaseRpcClient(new HttpClient(handler),
            Options.Create(new SupabaseOptions { Url = "http://db.test", AnonKey = "a.b.c", ServiceRoleKey = "s.r.k" }));
        var seed = Base64Url.Encode(new byte[32]);
        var signer = new QrSigner(Options.Create(new QrOptions { SigningKey = seed, Kid = "dev-1" }));
        return (new IssueTicketsWorker(rpc, signer, NullLogger<IssueTicketsWorker>.Instance), handler, signer);
    }

    private static string Job => $$"""
        [{"id":7,"topic":"ISSUE_TICKETS","aggregate_type":"booking","aggregate_id":"{{BookingId}}","payload":{},"attempts":0}]
        """;

    [Fact]
    public async Task Signs_every_ticket_attaches_credentials_and_completes_the_job()
    {
        var (worker, handler, signer) = Create(fn => fn switch
        {
            "claim_outbox" => (HttpStatusCode.OK, Job),
            "issue_tickets" => (HttpStatusCode.OK, $$"""[{"ticket_id":"{{TicketId}}","payload":"{\"v\":1}"}]"""),
            _ => (HttpStatusCode.OK, "null"),
        });

        Assert.Equal(1, await worker.RunOnceAsync(TestContext.Current.CancellationToken));

        var calls = handler.Calls.Select(c => c.Request.RequestUri!.Segments[^1]).ToArray();
        Assert.Equal(["claim_outbox", "issue_tickets", "attach_ticket_credentials", "complete_outbox"], calls);

        using var attach = JsonDocument.Parse(handler.Calls[2].Body);
        var item = attach.RootElement.GetProperty("p_items")[0];
        Assert.Equal("dev-1", item.GetProperty("kid").GetString());
        Assert.True(QrSigner.Verify(signer.PublicKey, """{"v":1}""", item.GetProperty("signature").GetString()!));

        using var complete = JsonDocument.Parse(handler.Calls[3].Body);
        Assert.Equal(JsonValueKind.Null, complete.RootElement.GetProperty("p_error").ValueKind);
    }

    [Fact]
    public async Task Rpc_error_is_reported_back_to_the_outbox_for_retry()
    {
        var (worker, handler, _) = Create(fn => fn switch
        {
            "claim_outbox" => (HttpStatusCode.OK, Job),
            "issue_tickets" => (HttpStatusCode.BadRequest, """{"code":"P0001","message":"INVALID_STATE","details":""}"""),
            _ => (HttpStatusCode.OK, "null"),
        });

        await worker.RunOnceAsync(TestContext.Current.CancellationToken);

        var last = handler.Calls[^1];
        Assert.EndsWith("complete_outbox", last.Request.RequestUri!.ToString());
        Assert.Contains("\"p_error\":\"INVALID_STATE\"", last.Body);
    }
}
