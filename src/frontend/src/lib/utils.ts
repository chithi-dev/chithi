import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function validateRedirectUrl(url: string, origin: string): string {
	try {
		const parsed = new URL(url, origin);

		if (parsed.origin !== origin) {
			throw new Error('External redirects are not allowed.');
		}

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('Invalid protocol.');
		}
		return parsed.pathname + parsed.search + parsed.hash;
	} catch (e) {
		if (e instanceof Error) throw e;
		throw new Error('Malformed redirect URL.');
	}
}
