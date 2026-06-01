export const kebab_to_initials = (s: string) => s.split('-').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
