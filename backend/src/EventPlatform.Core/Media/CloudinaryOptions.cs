using System.Text.RegularExpressions;

namespace EventPlatform.Core.Media;

/// <summary>API credentials belong in API user-secrets/environment variables, never mobile/web env files.</summary>
public sealed class CloudinaryOptions
{
    public const string Section = "Cloudinary";
    public string CloudName { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string ApiSecret { get; set; } = "";
    public string PublicIdPrefix { get; set; } = "tickey";

    public bool IsValid => !string.IsNullOrWhiteSpace(CloudName) && Regex.IsMatch(CloudName, @"\A[A-Za-z0-9_-]{1,100}\z")
        && !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(ApiSecret)
        && !string.IsNullOrWhiteSpace(PublicIdPrefix) && PublicIdPrefix.Length <= 100
        && Regex.IsMatch(PublicIdPrefix, @"\A[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*\z");
}
