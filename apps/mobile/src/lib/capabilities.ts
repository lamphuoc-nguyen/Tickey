/** Verified against this checkout; enabling requires the missing server contract/implementation. */
export const customerCapabilities = {
  // Still needs EXPO_PUBLIC_PAYMENT_GATEWAY; TEST is the API's fake checkout (Payments:Gateway = TEST).
  gatewayPayment: true,
  encodedTicketQr: false,
  voluntaryRefund: false,
  newBusinessBooking: false,
  audiencePricing: false,
  reportSupplement: false,
} as const;
