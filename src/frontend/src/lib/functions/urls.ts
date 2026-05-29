export function strip_trailing_slash(input: string) {
  if (!input || input === '/') return input;
  const [path, query = ''] = input.split('?');
  const [clean, hash = ''] = path.split('#');
  return clean.replace(/\/+$/, '') + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

export function validateRedirectUrl(url: string, origin: string) {
  const parsed = new URL(url, origin);
  if (parsed.origin !== origin) throw new Error('External redirects are not allowed.');
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Invalid protocol.');
  return parsed.pathname + parsed.search + parsed.hash;
}
