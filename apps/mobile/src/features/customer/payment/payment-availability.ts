/** TEST is the backend's simulated checkout, never a real payment method for Customer. */
export function paidCheckoutAvailable(enabled: boolean, gateway?: string): boolean {
  const value = gateway?.trim();
  return enabled && !!value && value.toUpperCase() !== 'TEST';
}
