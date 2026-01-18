<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { User, ArrowRight, Mail, Lock, LoaderCircle } from 'lucide-svelte';
	import { useOnboarding } from '$lib/queries/onboarding';
	import { useAuth } from '$lib/queries/auth';
	import { toast } from 'svelte-sonner';
	import type { Props } from './types';

	// Props
	let { onNext }: Props = $props();

	// Svelte 5 Runes
	let isLoading = $state(false);
	let username = $state('');
	let email = $state('');
	let password = $state('');

	const { completeOnboarding } = useOnboarding();
	const { login } = useAuth();

	const isFormValid = $derived(username.length > 0 && email.length > 0 && password.length > 0);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!isFormValid) return;

		isLoading = true;
		try {
			// 1. Complete Onboarding
			await completeOnboarding({ username, email, password });
			toast.success('Admin account created successfully');

			// 2. Auto Login
			await login(username, password);
			toast.success('Logged in successfully');

			// 3. Move to next step
			onNext();
		} catch (error: any) {
			toast.error(error.message || 'Something went wrong');
		} finally {
			isLoading = false;
		}
	}
</script>

<Card.Root
	class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
>
	<div
		class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
	></div>

	<Card.Header class="space-y-3 pt-10 pb-8 text-center">
		<div
			class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-primary shadow-sm ring-1 ring-blue-200 dark:border-primary/20 dark:bg-primary/10 dark:ring-primary/20"
		>
			<User class="size-8" />
		</div>
		<div class="space-y-1">
			<Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
				>Welcome to Chithi</Card.Title
			>
			<Card.Description class="text-sm text-slate-500 dark:text-zinc-400">
				Create your admin account to get started
			</Card.Description>
		</div>
	</Card.Header>

	<Card.Content>
		<form onsubmit={handleSubmit} class="grid gap-6">
			<div class="grid gap-4">
				<div class="grid gap-2">
					<Label for="username" class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
						>Username</Label
					>
					<div class="group relative">
						<div
							class="absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-primary dark:text-zinc-500"
						>
							<User class="size-4" />
						</div>
						<Input
							id="username"
							bind:value={username}
							placeholder="Admin"
							class="h-12 border-slate-200 bg-white/50 pl-11 transition-all focus-visible:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950/50"
							required
						/>
					</div>
				</div>

				<div class="grid gap-2">
					<Label for="email" class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
						>Email</Label
					>
					<div class="group relative">
						<div
							class="absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-primary dark:text-zinc-500"
						>
							<Mail class="size-4" />
						</div>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="name@example.com"
							class="h-12 border-slate-200 bg-white/50 pl-11 transition-all focus-visible:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950/50"
							required
						/>
					</div>
				</div>

				<div class="grid gap-2">
					<div class="flex items-center px-1">
						<Label for="password" class="text-sm font-medium text-slate-700 dark:text-zinc-400"
							>Password</Label
						>
					</div>
					<div class="group relative">
						<div
							class="absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-primary dark:text-zinc-500"
						>
							<Lock class="size-4" />
						</div>
						<Input
							id="password"
							type="password"
							bind:value={password}
							class="h-12 border-slate-200 bg-white/50 pl-11 transition-all focus-visible:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950/50"
							required
						/>
					</div>
				</div>
			</div>

			<Button
				type="submit"
				disabled={isLoading || !isFormValid}
				class="h-12 w-full font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
			>
				{#if isLoading}
					<LoaderCircle class="mr-2 size-5 animate-spin" />
					Setting up...
				{:else}
					Create Account
					<ArrowRight class="ml-2 size-5 transition-transform group-hover:translate-x-1" />
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
