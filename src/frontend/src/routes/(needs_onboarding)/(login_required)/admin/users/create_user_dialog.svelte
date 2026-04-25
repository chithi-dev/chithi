<script module lang="ts">
	export const schema = z.object({
		username: z.string().min(2, 'Username must be at least 2 characters').max(50),
		email: z.email('Invalid email address').optional().or(z.literal('')),
		password: z.string().min(8, 'Password must be at least 8 characters')
	});
</script>

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Form from '$lib/components/ui/form/index';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { useUsersQuery } from '#queries/admin_users';
	import { toast } from 'svelte-sonner';
	import { z } from 'zod';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';

	let { open = $bindable(false) } = $props<{ open: boolean }>();

	const { createUser } = useUsersQuery(() => 1, 20);

	const form = superForm(defaults(zod4(schema)), {
		SPA: true,
		validators: zod4Client(schema),
		onUpdate: async ({ form: f }) => {
			if (f.valid) {
				try {
					await createUser({
						username: f.data.username,
						email: f.data.email || null,
						password: f.data.password
					});
					toast.success('User created successfully.');
					open = false;
					form.reset();
				} catch (e: any) {
					toast.error(e.message || 'Failed to create user.');
				}
			} else {
				toast.error('Please fix the errors in the form.');
			}
		}
	});

	const { form: formData, enhance, submitting } = form;
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-106.25">
		<Dialog.Header>
			<Dialog.Title>Create User</Dialog.Title>
			<Dialog.Description>
				Add a new user to the system. Provide an email if you want.
			</Dialog.Description>
		</Dialog.Header>
		<form use:enhance method="POST" class="space-y-4">
			<Form.Field {form} name="username">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Username</Form.Label>
						<Input
							{...props}
							type="text"
							bind:value={$formData.username}
							placeholder="Enter your username here"
							required
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="email">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Email</Form.Label>
						<Input
							{...props}
							type="email"
							bind:value={$formData.email}
							placeholder="Enter your mail here"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="password">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Password</Form.Label>
						<Input
							{...props}
							type="password"
							placeholder="Enter your password here"
							bind:value={$formData.password}
							required
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Form.Button disabled={$submitting}>
					{$submitting ? 'Creating...' : 'Create User'}
				</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
