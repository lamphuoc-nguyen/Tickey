namespace EventPlatform.Core.Media;

/// <summary>Explicit routing for new images. Existing objects and PDFs remain readable on Supabase.</summary>
public sealed class MediaStorageOptions
{
    public const string Section = "MediaStorage";
    public string ImageProvider { get; set; } = "Supabase";
    public bool UsesCloudinary => string.Equals(ImageProvider, "Cloudinary", StringComparison.OrdinalIgnoreCase);
    public bool IsValid => UsesCloudinary || string.Equals(ImageProvider, "Supabase", StringComparison.OrdinalIgnoreCase);
}
