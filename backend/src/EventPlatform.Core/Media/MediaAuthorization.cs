using System.Net;
using System.Text.Json;
using EventPlatform.Core.Supabase;

namespace EventPlatform.Core.Media;

/// <summary>Matches storage policies in migration 1300; authorization stays in Supabase, never local JWT claims.</summary>
public sealed class MediaAuthorization(SupabaseAuthClient auth, SupabaseRpcClient rpc)
{
    public async Task<Guid> VerifiedUserAsync(string jwt, CancellationToken ct)
    {
        var result = await auth.SendAsync(HttpMethod.Get, "user", null, jwt, ct);
        if (result.Status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw RpcException.App(HttpStatusCode.Unauthorized, "UNAUTHENTICATED");
        if (result.Status != HttpStatusCode.OK)
            throw new RpcException(HttpStatusCode.BadGateway, "AUTH_UNAVAILABLE", null, null);
        try
        {
            using var data = JsonDocument.Parse(result.Body);
            if (data.RootElement.ValueKind == JsonValueKind.Object
                && data.RootElement.TryGetProperty("id", out var value)
                && value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var id)) return id;
        }
        catch (JsonException) { }
        throw new RpcException(HttpStatusCode.BadGateway, "AUTH_UNAVAILABLE", null, null);
    }

    public async Task EnsureAsync(string bucket, Guid ownerId, Guid userId, string jwt, bool write, CancellationToken ct)
    {
        var allowed = bucket switch
        {
            "event-assets" => write && await OrgRole(ownerId, ["OWNER", "EVENT_MANAGER"], jwt, ct),
            "kyc-private" => await OrgRole(ownerId, ["OWNER"], jwt, ct)
                || !write && await PlatformRole(["KYC_REVIEWER"], jwt, ct),
            "report-evidence" => userId == ownerId
                || !write && await PlatformRole(["DISPUTE_ADMIN"], jwt, ct),
            _ => false,
        };
        if (!allowed) throw RpcException.App(HttpStatusCode.Forbidden, "FORBIDDEN");
    }

    private Task<bool> OrgRole(Guid orgId, string[] roles, string jwt, CancellationToken ct) =>
        rpc.CallAsUserAsync<bool>("has_org_role", new { p_org_id = orgId, p_roles = roles }, jwt, ct);
    private Task<bool> PlatformRole(string[] roles, string jwt, CancellationToken ct) =>
        rpc.CallAsUserAsync<bool>("has_platform_role", new { p_roles = roles }, jwt, ct);
}
