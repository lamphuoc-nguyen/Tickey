using System.Text.Json;
using System.Text.Json.Nodes;
using EventPlatform.Core.Supabase;
using static EventPlatform.Api.Postgrest;

namespace EventPlatform.Api;

public sealed record UpdateProfileRequest(string? FullName, string? Phone, string? AvatarUrl, string? Locale);

public sealed record SetWorkspaceRequest(string Kind, Guid? OrgId);

public sealed record MarkNotificationsReadRequest(Guid[] Ids);

/// <summary>Profile, workspace switching, notifications and the Staff's own assignments. All need a JWT.</summary>
public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireBearer();

        api.MapGet("/me", async (HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
        {
            var rows = await db.SelectAsync("profiles", Query(
                Select("id, full_name, phone, avatar_url, locale, created_at"), Eq("id", http.UserId())), http.Jwt(), ct);
            return WithEmail(rows, http);
        });

        // RLS lets a user update only these four columns of their own profile (grant update on profiles).
        api.MapPut("/me", async (UpdateProfileRequest body, HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
        {
            var values = new Dictionary<string, string>();
            if (body.FullName is not null) values["full_name"] = body.FullName.Trim();
            if (body.Phone is not null) values["phone"] = body.Phone.Trim();
            if (body.AvatarUrl is not null) values["avatar_url"] = body.AvatarUrl.Trim();
            if (body.Locale is not null) values["locale"] = body.Locale.Trim();
            if (values.Count == 0) return Results.BadRequest(new { message = "VALIDATION_FAILED" });

            var rows = await db.UpdateAsync("profiles",
                Query(Eq("id", http.UserId()), Select("id, full_name, phone, avatar_url, locale, created_at")),
                values, http.Jwt(), ct);
            return WithEmail(rows, http);
        });

        api.MapGet("/workspaces", async (HttpContext http, SupabaseRpcClient rpc, CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("list_my_workspaces", null, http.Jwt(), ct)));

        // The new workspace is a JWT claim (custom_access_token_hook): the app must call
        // POST /api/auth/refresh afterwards to get a token that carries it.
        api.MapPut("/workspaces/active", async (SetWorkspaceRequest body, HttpContext http, SupabaseRpcClient rpc,
            CancellationToken ct) =>
            Results.Ok(await rpc.CallAsUserAsync<JsonElement>("set_active_workspace",
                new { p_kind = body.Kind, p_org_id = body.OrgId }, http.Jwt(), ct)));

        api.MapGet("/notifications", async (bool? unread, int? limit, int? offset, HttpContext http,
            SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("notifications", Query(
                Select("id, channel, template, title, body, data, status, created_at, read_at"),
                Eq("user_id", http.UserId()),
                unread is true ? "read_at=is.null" : null,
                "order=created_at.desc",
                Page(limit, offset)), http.Jwt(), ct)));

        api.MapPut("/notifications/read", async (MarkNotificationsReadRequest body, HttpContext http,
            SupabaseRpcClient rpc, CancellationToken ct) =>
        {
            var updated = await rpc.CallAsUserAsync<int>("mark_notifications_read", new { p_ids = body.Ids }, http.Jwt(), ct);
            return Results.Ok(new { updated });
        });

        // Not in the API list: the Staff app needs the caller's active assignments to pick a Session.
        api.MapGet("/me/staff-assignments", async (HttpContext http, SupabaseRestClient db, CancellationToken ct) =>
            Results.Ok(await db.SelectAsync("staff_assignments", Query(
                Select("""
                    id, tenant_id, session_id, gate_id, permissions, valid_from, valid_until, status,
                    gate:gates(id, code, name),
                    session:sessions(id, title, starts_at, ends_at, doors_open_at, status, event:events(id, title, cover_image_url),
                        venue:venues(id, name, timezone))
                    """),
                Eq("user_id", http.UserId()),
                "status=eq.ACTIVE",
                "order=valid_from"), http.Jwt(), ct)));
    }

    private static IResult WithEmail(JsonElement rows, HttpContext http)
    {
        if (rows.ValueKind != JsonValueKind.Array || rows.GetArrayLength() == 0)
        {
            return Results.NotFound(new { message = "NOT_FOUND" });
        }
        var profile = JsonNode.Parse(rows[0].GetRawText())!.AsObject();
        profile["email"] = Bearer.Claim(http.Jwt(), "email");
        return Results.Ok(profile);
    }
}
