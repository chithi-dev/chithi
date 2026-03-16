<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { schema, type FormSchema } from './schema';
	import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { cn } from '$lib/utils';
	import * as Form from '$lib/components/ui/form/index';
	import { ArrowRight, Mail, Lock, LoaderCircle, Eye, EyeOff } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { QueryClient } from '@tanstack/svelte-query';
	import { queryKey as authQueryKey } from '#queries/auth';

	let showPassword = $state(false);

	let { data, next_url }: { data: { form: SuperValidated<Infer<FormSchema>> }; next_url: string } =
		$props();

	const queryClient = new QueryClient();
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(schema),
			onUpdated: async ({ form }) => {
				if (form.valid) {
					queryClient.invalidateQueries({
						queryKey: [authQueryKey],
						exact: true,
						refetchType: 'all'
					});
					// Hard refresh
					window.location.href = next_url;
				} else {
					const globalErrors = form.errors._errors;

					if (globalErrors && globalErrors.length > 0) {
						toast.error(globalErrors[0]);
					} else {
						toast.error('Please check your credentials.');
					}
				}
			}
		}
	);

	const { form: formData, enhance, submitting } = form;

	const isPasswordEmpty = $derived($formData.password.length === 0);

	// Auto-hide password text if the input is cleared
	$effect(() => {
		if (isPasswordEmpty) {
			showPassword = false;
		}
	});
</script>

<form use:enhance method="POST" class="grid gap-6">
	<Form.Field {form} name="email">
		<Form.Control>
			<Form.Label class="ml-1 text-sm font-medium text-foreground">Email or Username</Form.Label>
			<div class="group relative">
				<div
					class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
				>
					<Mail class="size-4" />
				</div>
				<Input
					name="email"
					bind:value={$formData.email}
					placeholder="name@example.com"
					class="h-12 border-border bg-background/50 pl-11 transition-all focus-visible:ring-primary/40"
				/>
			</div>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<Form.Field {form} name="password">
		<Form.Control>
			<Form.Label class="text-sm font-medium text-foreground">Password</Form.Label>
			<div class="group relative">
				<div
					class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
				>
					<Lock class="size-4" />
				</div>
				<Input
					name="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={$formData.password}
					placeholder="••••••••"
					class="h-12 border-border bg-background/50 px-11 transition-all focus-visible:ring-primary/40"
				/>

				<Button
					variant="ghost"
					size="icon"
					type="button"
					onclick={() => (showPassword = !showPassword)}
					disabled={isPasswordEmpty}
					class={cn(
						'absolute top-1 right-1 h-10 w-10 text-muted-foreground transition-all duration-200',
						isPasswordEmpty && 'pointer-events-none scale-90 opacity-0',
						!isPasswordEmpty && 'scale-100 opacity-100 hover:bg-transparent hover:text-foreground'
					)}
				>
					{#if showPassword}
						<EyeOff class="size-4" />
					{:else}
						<Eye class="size-4" />
					{/if}
				</Button>
			</div>
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>

	<Form.Button
		disabled={$submitting}
		class="h-12 w-full font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
	>
		{#if $submitting}
			<LoaderCircle class="mr-2 size-5 animate-spin" />
			Authenticating
		{:else}
			Sign In
			<ArrowRight class="ml-2 size-5 transition-transform group-hover:translate-x-1" />
		{/if}
	</Form.Button>
</form>
