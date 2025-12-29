export function kebab_to_initials(s: string) {
	return s
		.split('-')
		.map((w: String) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}
