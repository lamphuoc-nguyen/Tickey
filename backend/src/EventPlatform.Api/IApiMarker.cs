namespace EventPlatform.Api;

/// <summary>
/// Entry-point marker for WebApplicationFactory in tests. Under .NET 10 the generated Program class
/// is public in every host project, so tests that reference Api and Workers cannot use Program.
/// </summary>
public interface IApiMarker;
