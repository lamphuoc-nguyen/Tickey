using System.Text;
using System.Text.Json;

namespace EventPlatform.Core.Qr;

/// <summary>
/// The text inside a gate QR: base64url(payload) + "." + base64url(signature), where payload is the JSON the
/// database built and the Workers signed. v1 = one ticket (tid), v2 = a whole booking (bid). Ids only, no
/// personal data.
/// </summary>
public sealed record AdmissionCode(string Payload, string Signature, int Version, string Kid, Guid SessionId,
    Guid? TicketId, Guid? BookingId)
{
    public static string Encode(string payload, string signature) =>
        Base64Url.Encode(Encoding.UTF8.GetBytes(payload)) + "." + signature;

    /// <summary>Parses the QR text. Says nothing about the signature: verify it with <see cref="QrSigner.Verify"/>.</summary>
    public static bool TryParse(string? code, out AdmissionCode? result)
    {
        result = null;
        var parts = code?.Trim().Split('.');
        if (parts is not { Length: 2 } || parts[0].Length == 0 || parts[1].Length == 0) return false;
        try
        {
            var payload = Encoding.UTF8.GetString(Base64Url.Decode(parts[0]));
            using var json = JsonDocument.Parse(payload);
            var root = json.RootElement;
            var version = root.GetProperty("v").GetInt32();
            Guid? ticket = version == 1 ? root.GetProperty("tid").GetGuid() : null;
            Guid? booking = version == 2 ? root.GetProperty("bid").GetGuid() : null;
            if (ticket is null && booking is null) return false;
            result = new AdmissionCode(payload, parts[1], version, root.GetProperty("kid").GetString()!,
                root.GetProperty("sid").GetGuid(), ticket, booking);
            return true;
        }
        catch (Exception e) when (e is FormatException or JsonException or KeyNotFoundException
                                      or InvalidOperationException)
        {
            return false;
        }
    }
}
