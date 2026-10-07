using EventPlatform.Core.Qr;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class QrSignerTests
{
    // Any 32-byte seed works; real keys come from DB_INSTRUCTIONS §4.1.
    private static readonly string Seed = Base64Url.Encode(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());

    private static QrSigner Create() => new(Options.Create(new QrOptions { SigningKey = Seed, Kid = "dev-1" }));

    [Fact]
    public void Signature_verifies_with_the_public_key_and_fails_on_tampering()
    {
        using var signer = Create();
        const string payload = """{"v":1,"tid":"t1","sid":"s1","zid":"z1","kid":"dev-1","iat":1790000000}""";

        var signature = signer.Sign(payload);

        Assert.True(QrSigner.Verify(signer.PublicKey, payload, signature));
        Assert.False(QrSigner.Verify(signer.PublicKey, payload.Replace("t1", "t2"), signature));
        Assert.DoesNotContain('=', signature);
    }

    [Fact]
    public void Missing_key_fails_at_startup()
    {
        Assert.Throws<InvalidOperationException>(() => new QrSigner(Options.Create(new QrOptions())));
    }
}
