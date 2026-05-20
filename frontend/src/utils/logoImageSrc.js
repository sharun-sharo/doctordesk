/** Build a cache-busted logo URL (handles API paths that already include ?v=). */
export function logoImageSrc(logoUrl, origin = '', buster = Date.now()) {
  if (!logoUrl) return null;
  const base = logoUrl.startsWith('http') ? logoUrl : `${origin}${logoUrl}`;
  const [path, qs] = base.split('?');
  const params = new URLSearchParams(qs || '');
  params.set('t', String(buster));
  return `${path}?${params.toString()}`;
}
