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

		const res = await fetch('/api/login', {
			method: 'POST',
			credentials: 'include',
			body: form_data
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			return setError(form, '', data?.message || 'Invalid username or password');
		}

		return message(form, 'Logged in successfully');
	}
};
