/** User-facing message from an API upload failure. */
export function uploadErrorMessage(err, fallback = 'Upload failed') {
  const msg = err?.response?.data?.message;
  if (msg) return msg;
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Network error. Check your connection and try again.';
  }
  return fallback;
}
