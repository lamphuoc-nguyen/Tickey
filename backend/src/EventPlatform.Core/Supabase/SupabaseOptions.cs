namespace EventPlatform.Core.Supabase;

/// <summary>
/// Section "Supabase". ServiceRoleKey bypasses RLS: keep it in user-secrets locally and in the
/// secret store on staging/production, never in appsettings or the repo (MT §14).
/// </summary>
public sealed class SupabaseOptions
{
    public const string Section = "Supabase";

    public string Url { get; set; } = "";
    public string AnonKey { get; set; } = "";
    public string ServiceRoleKey { get; set; } = "";
}
