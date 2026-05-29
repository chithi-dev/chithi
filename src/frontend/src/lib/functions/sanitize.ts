export function sanitizeExt(ext: string) {
  return ext.replace(/^\./, '').trim().toLowerCase();
}
