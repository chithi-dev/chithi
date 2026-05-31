export function kebab_to_initials(s: string) {
	const initials = s.split('-').map((w) => w[0]).join('');
	return initials.slice(0, 2).toUpperCase();
}
