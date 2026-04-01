import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge/es5';

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
		const parsedUrl = new URL(url, origin);
		if (parsedUrl.origin !== origin) {
			const allowedDomains = ['chithi.dev', 'localhost'];
			if (!allowedDomains.includes(parsedUrl.hostname) && !parsedUrl.hostname.endsWith('.chithi.dev')) {
				url = '/';
			}
		}
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			url = '/';
		}
	} catch {
		url = '/';
	}

	if (url.startsWith('/admin')) {
		return '/';
	}
	return url;
}
