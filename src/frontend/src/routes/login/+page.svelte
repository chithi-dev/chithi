<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { ShieldCheck, ArrowRight, Mail, Lock, Loader2, ChevronLeft } from 'lucide-svelte';

	let isLoading = false;

	async function handleSubmit() {
		isLoading = true;
		// Simulate a delay
		setTimeout(() => (isLoading = false), 2000);
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4"
>
	<div class="absolute inset-0 z-0">
		<div
			class="absolute top-[-10%] left-[-10%] size-[500px] rounded-full bg-primary/5 blur-[120px]"
		/>
		<div
			class="absolute right-[-10%] bottom-[-10%] size-[500px] rounded-full bg-primary/5 blur-[120px]"
		/>
	</div>

	<a
		href="/"
		class="transition-hover absolute top-8 left-8 flex items-center text-sm font-medium text-muted-foreground hover:text-primary"
	>
		<ChevronLeft class="mr-1 size-4" />
		Back to site
	</a>

	<Card.Root
		class="relative z-10 w-full max-w-[450px] border-zinc-200/50 shadow-2xl dark:border-zinc-800/50"
	>
		<Card.Header class="space-y-3 pb-8 text-center">
			<div
				class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
			>
				<ShieldCheck class="size-7" />
			</div>
			<div class="space-y-1">
				<Card.Title class="text-3xl font-bold tracking-tight">Security Portal</Card.Title>
				<Card.Description class="text-base">
					Enter your details to access your workspace
				</Card.Description>
			</div>
		</Card.Header>

		<Card.Content>
			<form on:submit|preventDefault={handleSubmit} class="grid gap-6">
				<div class="grid gap-4">
					<div class="grid gap-2">
						<Label for="email" class="ml-1 text-sm font-semibold">Work Email</Label>
						<div class="group relative">
							<div
								class="absolute top-3 left-3 text-muted-foreground transition-colors group-focus-within:text-primary"
							>
								<Mail class="size-4" />
							</div>
							<Input
								id="email"
								type="email"
								placeholder="name@company.com"
								class="h-11 bg-muted/30 pl-10 focus-visible:ring-1"
								required
							/>
						</div>
					</div>

					<div class="grid gap-2">
						<div class="ml-1 flex items-center justify-between">
							<Label for="password" class="text-sm font-semibold">Password</Label>
							<a
								href="/forgot-password"
								class="text-xs font-medium text-primary underline-offset-4 hover:underline"
							>
								Forgot password?
							</a>
						</div>
						<div class="group relative">
							<div
								class="absolute top-3 left-3 text-muted-foreground transition-colors group-focus-within:text-primary"
							>
								<Lock class="size-4" />
							</div>
							<Input
								id="password"
								type="password"
								class="h-11 bg-muted/30 pl-10 focus-visible:ring-1"
								required
							/>
						</div>
					</div>
				</div>

				<Button
					type="submit"
					class="h-11 w-full text-base font-bold transition-all active:scale-[0.98]"
					disabled={isLoading}
				>
					{#if isLoading}
						<Loader2 class="mr-2 size-4 animate-spin" />
						Authenticating...
					{:else}
						Sign In
						<ArrowRight class="ml-2 size-4 transition-transform group-hover:translate-x-1" />
					{/if}
				</Button>
			</form>
		</Card.Content>

		<Card.Footer class="flex flex-wrap items-center justify-center gap-1 border-t bg-muted/20 py-6">
			<span class="text-sm text-muted-foreground">Don't have an account?</span>
			<a href="/signup" class="text-sm font-bold text-primary underline-offset-4 hover:underline">
				Request Access
			</a>
		</Card.Footer>
	</Card.Root>
</div>
