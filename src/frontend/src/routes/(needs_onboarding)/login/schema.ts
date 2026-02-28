import { z } from 'zod';

export const schema = z.object({
	email: z.string().min(1, 'Email or Username is required'),
	password: z.string().min(1, 'Password is required')
});
export type FormSchema = typeof schema;
