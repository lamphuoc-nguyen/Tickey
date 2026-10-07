using System.Text;
using Microsoft.Extensions.Options;
using NSec.Cryptography;

namespace EventPlatform.Core.Qr;

/// <summary>Section "Qr". SigningKey: base64url 32-byte Ed25519 seed (DB_INSTRUCTIONS §4.1).</summary>
public sealed class QrOptions
{
    public const string Section = "Qr";

    public string SigningKey { get; set; } = "";
    public string Kid { get; set; } = "";
}

/// <summary>
/// Signs ticket payloads with Ed25519 (MT §8, S2-BE1-4). The private key exists only here;
/// the matching public key is the row (kid, public_key) in public.signing_keys.
/// </summary>
public sealed class QrSigner : IDisposable
{
    private static readonly SignatureAlgorithm Algorithm = SignatureAlgorithm.Ed25519;
    private readonly Key _key;

    public QrSigner(IOptions<QrOptions> options)
    {
        var o = options.Value;
        if (string.IsNullOrEmpty(o.SigningKey) || string.IsNullOrEmpty(o.Kid))
        {
            throw new InvalidOperationException("Qr:SigningKey and Qr:Kid must be configured (DB_INSTRUCTIONS §4.1).");
        }
        Kid = o.Kid;
        _key = Key.Import(Algorithm, Base64Url.Decode(o.SigningKey), KeyBlobFormat.RawPrivateKey);
    }

    public string Kid { get; }

    /// <summary>Signature over the UTF-8 payload, base64url without padding.</summary>
    public string Sign(string payload) => Base64Url.Encode(Algorithm.Sign(_key, Encoding.UTF8.GetBytes(payload)));

    /// <summary>Raw public key, base64url: the value stored in signing_keys.public_key.</summary>
    public string PublicKey => Base64Url.Encode(_key.PublicKey.Export(KeyBlobFormat.RawPublicKey));

    public static bool Verify(string publicKey, string payload, string signature)
    {
        var key = NSec.Cryptography.PublicKey.Import(Algorithm, Base64Url.Decode(publicKey), KeyBlobFormat.RawPublicKey);
        return Algorithm.Verify(key, Encoding.UTF8.GetBytes(payload), Base64Url.Decode(signature));
    }

    public void Dispose() => _key.Dispose();
}

public static class Base64Url
{
    public static string Encode(ReadOnlySpan<byte> data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[] Decode(string value)
    {
        var s = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
