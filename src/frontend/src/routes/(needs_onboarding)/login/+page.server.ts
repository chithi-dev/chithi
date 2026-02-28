import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { schema } from './schema';

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Return the form with a status message
		return message(form, 'Form posted successfully!');
	}
};
