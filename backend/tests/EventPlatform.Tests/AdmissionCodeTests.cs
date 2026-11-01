using EventPlatform.Core.Qr;
using Microsoft.Extensions.Options;

namespace EventPlatform.Tests;

public class AdmissionCodeTests
{
    private static readonly Guid Booking = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Ticket = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Session = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void Booking_code_round_trips_and_verifies_with_the_public_key()
    {
        using var signer = new QrSigner(Options.Create(new QrOptions { SigningKey = Base64Url.Encode(new byte[32]), Kid = "dev-1" }));
        var payload = $$"""{"v":2,"bid":"{{Booking}}","sid":"{{Session}}","kid":"dev-1","iat":1}""";

        Assert.True(AdmissionCode.TryParse(AdmissionCode.Encode(payload, signer.Sign(payload)), out var code));

        Assert.Equal(2, code!.Version);
        Assert.Equal(Booking, code.BookingId);
        Assert.Null(code.TicketId);
        Assert.Equal(Session, code.SessionId);
        Assert.Equal(payload, code.Payload);
        Assert.True(QrSigner.Verify(signer.PublicKey, code.Payload, code.Signature));
    }

    [Fact]
    public void Ticket_code_is_v1_with_a_ticket_id()
    {
        var payload = $$"""{"v":1,"tid":"{{Ticket}}","sid":"{{Session}}","zid":null,"kid":"k","iat":1}""";

        Assert.True(AdmissionCode.TryParse(AdmissionCode.Encode(payload, "sig"), out var code));

        Assert.Equal(Ticket, code!.TicketId);
        Assert.Null(code.BookingId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no-dot")]
    [InlineData("!!!.sig")]
    [InlineData("e30.sig")] // {} : no version
    public void Garbage_is_rejected(string? text) => Assert.False(AdmissionCode.TryParse(text, out _));
}
