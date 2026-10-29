/** Render's sleeping instances can need over a minute to serve the first request. */
export function apiRequestTimeout(apiUrl: string | undefined): number {
  try {
    const url = new URL(apiUrl ?? '');
    if (url.protocol === 'https:' && url.hostname.endsWith('.onrender.com')) return 90_000;
  } catch {
    // Configuration validation reports invalid URLs; do not mask them here.
  }
  return 20_000;
}
