/** Verified against this checkout; enabling requires the missing server contract/implementation. */
export const customerCapabilities = {
  // Direct server confirmation; no mobile gateway env or external checkout screen.
  gatewayPayment: true,
  encodedTicketQr: false,
  voluntaryRefund: false,
  newBusinessBooking: false,
  audiencePricing: false,
  reportSupplement: false,
} as const;
