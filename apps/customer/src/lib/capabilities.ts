/** Verified against this checkout; enabling requires the missing server contract/implementation. */
export const customerCapabilities = {
  gatewayPayment: false,
  encodedTicketQr: false,
  voluntaryRefund: false,
  newBusinessBooking: false,
  audiencePricing: false,
  reportSupplement: false,
} as const;
