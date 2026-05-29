export function kebab_to_initials(s: string) {
  return s.replaceAll('-', '').slice(0, 2).toUpperCase();
}
