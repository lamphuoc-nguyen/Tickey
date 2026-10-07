using System.Net;
using System.Text;

namespace EventPlatform.Tests;

/// <summary>Records requests and answers each with a canned PostgREST response.</summary>
public sealed class FakeHttpHandler(Func<HttpRequestMessage, string, (HttpStatusCode Status, string Body)> respond)
    : HttpMessageHandler
{
    public List<(HttpRequestMessage Request, string Body)> Calls { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        Calls.Add((request, body));
        var (status, responseBody) = respond(request, body);
        return new HttpResponseMessage(status) { Content = new StringContent(responseBody, Encoding.UTF8, "application/json") };
    }
}
