<script module lang="ts">
	import { z } from 'zod';
	export const schema = z.object({
		username: z.string().min(2, 'Username must be at least 2 characters').max(50),
		email: z.email('Invalid email address').optional().or(z.literal('')),
		password: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.regex(/[0-9]/, 'Password must contain at least one number')
			.regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
	});
</script>

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Form from '$lib/components/ui/form/index';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { useUsersQuery } from '#queries/admin_users';
	import { toast } from 'svelte-sonner';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import { User, Mail, Lock, LoaderCircle, UserPlus, Eye, EyeOff } from '@lucide/svelte';

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

	let showPassword = $state(false);
	const isPasswordEmpty = $derived($formData.password.length === 0);

	$effect(() => {
		if (isPasswordEmpty) {
			showPassword = false;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-106.25">
		<Dialog.Header class="space-y-3 pb-4 text-center sm:text-left">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:mx-0"
			>
				<UserPlus class="size-6" />
			</div>
			<div class="space-y-1">
				<Dialog.Title class="text-xl font-semibold">Create User</Dialog.Title>
				<Dialog.Description>
					Add a new user to the system. Provide an email if you want.
				</Dialog.Description>
			</div>
		</Dialog.Header>

		<form use:enhance method="POST" class="grid gap-5">
			<Form.Field {form} name="username">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="ml-1 text-sm font-medium">Username</Form.Label>
						<div class="group relative">
							<div
								class="absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
							>
								<User class="size-4" />
							</div>
							<Input
								{...props}
								bind:value={$formData.username}
								placeholder="Pick a unique username"
								class="h-11 border-border bg-background/50 pl-10 transition-all focus-visible:ring-primary/40"
								required
							/>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="email">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="ml-1 text-sm font-medium">Email</Form.Label>
						<div class="group relative">
							<div
								class="absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
							>
								<Mail class="size-4" />
							</div>
							<Input
								{...props}
								type="email"
								bind:value={$formData.email}
								placeholder="name@example.com (optional)"
								class="h-11 border-border bg-background/50 pl-10 transition-all focus-visible:ring-primary/40"
							/>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="password">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="ml-1 text-sm font-medium">Password</Form.Label>
						<div class="group relative">
							<div
								class="absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
							>
								<Lock class="size-4" />
							</div>
							<Input
								{...props}
								type={showPassword ? 'text' : 'password'}
								bind:value={$formData.password}
								placeholder="Min. 8 chars, with number & symbol"
								class="h-11 border-border bg-background/50 px-10 transition-all focus-visible:ring-primary/40"
								required
							/>

							<Button
								variant="ghost"
								size="icon"
								type="button"
								onclick={() => (showPassword = !showPassword)}
								disabled={isPasswordEmpty}
								class={[
									'absolute top-0.5 right-0.5 h-10 w-10 text-muted-foreground transition-all duration-200',
									isPasswordEmpty && 'pointer-events-none scale-90 opacity-0',
									!isPasswordEmpty &&
										'scale-100 opacity-100 hover:bg-transparent hover:text-foreground'
								]}
							>
								{#if showPassword}
									<EyeOff class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</Button>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Dialog.Footer class="pt-2">
				<Button type="button" variant="ghost" onclick={() => (open = false)} class="h-11">
					Cancel
				</Button>
				<Form.Button
					disabled={$submitting}
					class="h-11 px-8 font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
				>
					{#if $submitting}
						<LoaderCircle class="mr-2 size-4 animate-spin" />
						Creating...
					{:else}
						Create User
					{/if}
				</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
