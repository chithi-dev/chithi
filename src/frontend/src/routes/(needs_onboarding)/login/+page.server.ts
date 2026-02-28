import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { schema } from './schema';

export const actions = {
	default: async ({ request }) => {
		const data = await request.clone().formData();
		console.log('Raw Form Data:', Object.fromEntries(data));

		const form = await superValidate(request, zod4(schema));
		console.log(request);
		console.log(form);

		if (!form.valid) {
			return fail(400, { form });
		}

		// TODO: Do something with the validated form.data

		// Return the form with a status message
		return message(form, 'Form posted successfully!');
	}
};
