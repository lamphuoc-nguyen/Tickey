/** Layout stays stable during animation; only the overlaid footer translates on the UI thread. */
export function actionFooterLayout(navigationClearance: number, measuredHeight: number, bottomInset: number) {
  // Keep the action comfortably above the system navigation area when the capsule is hidden.
  const bottomPadding = Math.max(0, bottomInset, 16) + 12;
  const lift = Math.max(0, navigationClearance - bottomPadding);
  const height = measuredHeight > 0 ? measuredHeight : 72 + bottomPadding;
  return { bottomPadding, lift, contentClearance: height + lift };
}
