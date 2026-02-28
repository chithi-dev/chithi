import { LOGIN_URL } from '#consts/backend';
import { fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { schema } from './schema';

export const actions = {
	default: async ({ request, cookies }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const form_data = new FormData();
		form_data.append('username', form.data.email);
		form_data.append('password', form.data.password);

		const res = await fetch(LOGIN_URL, {
			method: 'POST',
			body: form_data
		});

		if (!res.ok) {
			return setError(form, '', 'Invalid username or password');
		}

		const data = await res.json();
		const token = data.access_token;

		// Set HttpOnly cookie
		cookies.set('access_token', token, {
			httpOnly: true, // cannot be read by client
			secure: true, // only HTTPS in prod
			sameSite: 'lax',
			path: '/',
			maxAge: 60 * 60 * 24 // 1 day
		});

		// Return the form with a status message
		return message(form, 'Form posted successfully!');
	}
};
