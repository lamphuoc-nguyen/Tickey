import { getPaymentConfiguration } from '../payment-configuration';

export function usePaymentAvailability() {
  return getPaymentConfiguration().available;
}
