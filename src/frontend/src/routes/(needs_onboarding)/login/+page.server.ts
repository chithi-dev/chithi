import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { schema } from './schema';

export const actions = {
	default: async ({ request, cookies }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return fail(400, { form });
		}
		const token = 'your_jwt_here';

		// Set HttpOnly cookie
		cookies.set('access_token', token, {
			httpOnly: true, // cannot be read by client
			secure: true, // only HTTPS in prod
			sameSite: 'strict',
			path: '/',
			maxAge: 60 * 60 * 24 // 1 day
		});

		// Return the form with a status message
		return message(form, 'Form posted successfully!');
	}
};
