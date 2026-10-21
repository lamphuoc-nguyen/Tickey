using System.Net;
using System.Text.Json;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Api;

/// <summary>
/// Checkout page of TestPaymentGateway (Payments:Gateway = TEST). It stands in for the gateway and its IPN:
/// "Pay" records the payment with apply_payment_success, "Fail" with apply_payment_failure, then the browser
/// goes to /payments/return like a real gateway would. Only mapped in test mode.
/// </summary>
public static class TestPaymentEndpoints
{
    public static void MapTestPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/payments/test");

        group.MapGet("/{orderRef}", (string orderRef, long amount, string @return) =>
            Results.Content(Page(orderRef, amount, @return), "text/html; charset=utf-8"));

        group.MapPost("/{orderRef}", async (string orderRef, HttpRequest request, SupabaseRpcClient rpc,
            IConfiguration config, ILogger<TestPaymentLog> log, CancellationToken ct) =>
        {
            var form = await request.ReadFormAsync(ct);
            var returnUrl = form["return"].ToString();
            if (!long.TryParse(form["amount"], out var amount) || !IsOwnReturnUrl(returnUrl, config))
            {
                return Results.BadRequest();
            }

            var payload = JsonSerializer.SerializeToElement(new { method = "TEST", order_ref = orderRef });
            if (form["result"] == "success")
            {
                await rpc.CallAsync("apply_payment_success", new
                {
                    p_order_ref = orderRef, p_gateway_txn_id = $"TEST-{Guid.NewGuid():N}", p_amount = amount,
                    p_payload = payload,
                }, ct);
            }
            else
            {
                await rpc.CallAsync("apply_payment_failure", new
                {
                    p_order_ref = orderRef, p_reason = "TEST_DECLINED", p_payload = payload,
                }, ct);
            }
            log.LogInformation("Test payment {OrderRef}: {Result}", orderRef, form["result"].ToString());
            return Results.Redirect(returnUrl);
        });
    }

    /// <summary>Only redirect back to this API's own /payments/return, never to an arbitrary URL.</summary>
    private static bool IsOwnReturnUrl(string url, IConfiguration config) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && Uri.TryCreate(config["Api:PublicUrl"], UriKind.Absolute, out var api)
        && uri.AbsolutePath == "/payments/return"
        && Uri.Compare(uri, api, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) == 0;

    private static string Page(string orderRef, long amount, string returnUrl)
    {
        var order = WebUtility.HtmlEncode(orderRef);
        var back = WebUtility.HtmlEncode(returnUrl);
        var total = amount.ToString("N0", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"));
        return $$"""
            <!doctype html>
            <html lang="vi">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Cổng thanh toán thử</title>
              <style>
                body { margin: 0; font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
                main { max-width: 420px; margin: 48px auto; padding: 24px; background: #fff; border-radius: 16px; }
                .tag { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 13px; }
                .amount { font-size: 32px; font-weight: 700; margin: 8px 0 4px; }
                button { width: 100%; min-height: 52px; margin-top: 12px; border: 0; border-radius: 12px; font-size: 17px; font-weight: 600; }
                .pay { background: #16a34a; color: #fff; }
                .fail { background: #e4e4e7; color: #18181b; }
              </style>
            </head>
            <body>
              <main>
                <span class="tag">Chế độ thử nghiệm: không trừ tiền thật</span>
                <p>Đơn {{order}}</p>
                <p class="amount">{{total}} ₫</p>
                <form method="post">
                  <input type="hidden" name="amount" value="{{amount}}">
                  <input type="hidden" name="return" value="{{back}}">
                  <button class="pay" name="result" value="success">Thanh toán thành công</button>
                  <button class="fail" name="result" value="fail">Thanh toán thất bại</button>
                </form>
              </main>
            </body>
            </html>
            """;
    }

    /// <summary>Log category for test payments.</summary>
    public sealed class TestPaymentLog;
}
