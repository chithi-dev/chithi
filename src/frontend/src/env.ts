import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

export const variables = defineEnvVars({
	/**
	 * Base URL of the chithi backend (Django + GraphQL + ninja).
	 */
	PUBLIC_BACKEND_API: {
		public: true,
		schema: z
			.string()
			.trim()
			.refine((val) => {
				if (!val) return true; // allow empty string (means unset)
				try {
					new URL(val);
					return true;
				} catch {
					return false;
				}
			}, 'PUBLIC_BACKEND_API must be a valid URL')
			.optional(),
		description: 'Base URL of the chithi backend (e.g. http://localhost:8000)'
	},

	/**
	 * Public instance listing URL (footer link).
	 */
	PUBLIC_INSTANCE_URL: {
		public: true,
		schema: z.string().url().optional(),
		description: 'URL of the public instance listing page'
	},

	/**
	 * Optional donation platform URLs (footer links).
	 * Only rendered when set and non-empty.
	 */
	PUBLIC_BUY_ME_A_COFFEE: {
		public: true,
		schema: z.string().url().optional(),
		description: 'Buy Me A Coffee donation URL'
	},
	PUBLIC_LIBERAPAY: {
		public: true,
		schema: z.string().url().optional(),
		description: 'Liberapay donation URL'
	},
	PUBLIC_KO_FI: {
		public: true,
		schema: z.string().url().optional(),
		description: 'Ko-fi donation URL'
	},
	PUBLIC_PATREON: {
		public: true,
		schema: z.string().url().optional(),
		description: 'Patreon donation URL'
	}
});
