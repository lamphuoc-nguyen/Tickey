import { isRunningInExpoGo } from 'expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/** Expo Go cannot receive the installed app's eventcustomer scheme. Never rewrite a signed URL. */
export async function openPaymentBrowser(paymentUrl: string) {
  if (isRunningInExpoGo()) {
    await WebBrowser.openBrowserAsync(paymentUrl);
  } else {
    await WebBrowser.openAuthSessionAsync(
      paymentUrl,
      Linking.createURL('/payment-result', { scheme: 'eventcustomer' }),
    );
  }
}
