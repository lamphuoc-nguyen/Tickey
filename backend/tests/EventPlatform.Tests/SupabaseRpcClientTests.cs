using System.Net;
using EventPlatform.Core.Supabase;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class SupabaseRpcClientTests
{
    private const string ServiceJwt = "h.service.s";
    private const string AnonJwt = "h.anon.s";

    private static (SupabaseRpcClient Client, FakeHttpHandler Handler) Create(
        Func<HttpRequestMessage, string, (HttpStatusCode, string)> respond, string serviceKey = ServiceJwt)
    {
        var handler = new FakeHttpHandler(respond);
        var options = Options.Create(new SupabaseOptions { Url = "http://db.test/", AnonKey = AnonJwt, ServiceRoleKey = serviceKey });
        return (new SupabaseRpcClient(new HttpClient(handler), options), handler);
    }

    [Fact]
    public async Task Server_call_posts_snake_case_args_with_the_service_role_key()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "[]"));

        await client.CallAsync<List<object>>("claim_outbox", new { p_topic = "ISSUE_TICKETS", p_limit = 20 },
            TestContext.Current.CancellationToken);

        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("http://db.test/rest/v1/rpc/claim_outbox", request.RequestUri!.ToString());
        Assert.Equal(ServiceJwt, request.Headers.GetValues("apikey").Single());
        Assert.Equal($"Bearer {ServiceJwt}", request.Headers.Authorization!.ToString());
        Assert.Equal("""{"p_topic":"ISSUE_TICKETS","p_limit":20}""", body);
    }

    [Fact]
    public async Task User_call_forwards_the_user_jwt_with_the_anon_key()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "{}"));

        await client.CallAsUserAsync<object>("begin_payment", new { p_booking_id = Guid.Empty }, "h.user.s",
            TestContext.Current.CancellationToken);

        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal(AnonJwt, request.Headers.GetValues("apikey").Single());
        Assert.Equal("Bearer h.user.s", request.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task New_style_secret_key_is_sent_only_as_apikey()
    {
        var (client, handler) = Create((_, _) => (HttpStatusCode.OK, "null"), serviceKey: "sb_secret_abc");

        await client.CallAsync("complete_outbox", new { p_id = 1 }, TestContext.Current.CancellationToken);

        var request = Assert.Single(handler.Calls).Request;
        Assert.Equal("sb_secret_abc", request.Headers.GetValues("apikey").Single());
        Assert.Null(request.Headers.Authorization);
    }

    [Fact]
    public async Task App_error_becomes_RpcException_with_code_and_details()
    {
        var (client, _) = Create((_, _) => (HttpStatusCode.BadRequest,
            """{"code":"P0001","message":"SEAT_CONFLICT","details":"{\"seat_ids\":[\"s1\"]}","hint":null}"""));

        var e = await Assert.ThrowsAsync<RpcException>(() =>
            client.CallAsync<object>("create_booking", null, TestContext.Current.CancellationToken));

        Assert.True(e.IsAppError);
        Assert.Equal("SEAT_CONFLICT", e.Message);
        Assert.Equal("""{"seat_ids":["s1"]}""", e.Details);
    }
}
