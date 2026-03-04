import { login as loginRemote } from '$lib/remote/auth.remote';
import { fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { schema } from './schema';

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await loginRemote({ username: form.data.email, password: form.data.password });
			return message(form, 'Logged in successfully');
		} catch (error: any) {
			return setError(form, '', error?.message || 'Invalid username or password');
		}
	}
};
