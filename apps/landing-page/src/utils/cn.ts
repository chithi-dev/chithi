import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge/es5";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
