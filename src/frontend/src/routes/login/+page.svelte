<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import {
		ShieldCheck,
		ArrowRight,
		Mail,
		Lock,
		LoaderCircle,
		ChevronLeft,
		Fingerprint
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';

	let isLoading = false;

	async function handleSubmit() {
		isLoading = true;
		setTimeout(() => (isLoading = false), 2000);
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030303] p-4"
>
	<div class="absolute inset-0 z-0 overflow-hidden">
		<div
			class="absolute -top-[10%] -left-[10%] h-[500px] w-[500px] animate-pulse rounded-full bg-primary/20 blur-[120px] duration-[10s]"
		></div>
		<div
			class="absolute -right-[10%] -bottom-[10%] h-[500px] w-[500px] animate-pulse rounded-full bg-blue-600/10 blur-[120px] duration-[8s]"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:40px_40px]"
		></div>
	</div>

	<a
		href="/"
		class="group absolute top-8 left-8 z-20 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary"
	>
		<div
			class="flex size-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 transition-colors group-hover:border-primary/50"
		>
			<ChevronLeft class="size-4" />
		</div>
		Back to terminal
	</a>

	{#if !isLoading}
		<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-[420px]">
			<Card.Root
				class="relative overflow-hidden border-zinc-800/50 bg-zinc-900/40 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl"
			>
				<div
					class="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"
				></div>

				<Card.Header class="space-y-4 pb-8 text-center">
					<div class="relative mx-auto flex h-16 w-16 items-center justify-center">
						<div
							class="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-2xl border border-primary/20"
						></div>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
						>
							<ShieldCheck class="size-7" />
						</div>
					</div>
					<div class="space-y-1">
						<Card.Title class="text-3xl font-black tracking-tight text-white">
							Access <span class="text-primary">Vault</span>
						</Card.Title>
						<Card.Description class="text-zinc-400">
							Secure biometric encrypted login required
						</Card.Description>
					</div>
				</Card.Header>

				<Card.Content>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
						class="grid gap-5"
					>
						<div class="space-y-4">
							<div class="grid gap-2">
								<Label
									for="email"
									class="ml-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
									>Identity ID</Label
								>
								<div class="group relative">
									<Mail
										class="absolute top-3.5 left-3.5 size-4 text-zinc-500 transition-colors group-focus-within:text-primary"
									/>
									<Input
										id="email"
										type="email"
										placeholder="agent@agency.com"
										class="h-12 border-zinc-800 bg-zinc-950/50 pl-11 transition-all focus-visible:ring-primary/50"
										required
									/>
								</div>
							</div>

							<div class="grid gap-2">
								<div class="flex items-center justify-between px-1">
									<Label
										for="password"
										class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
										>Encryption Key</Label
									>
									<a
										href="/forgot"
										class="text-[10px] font-bold tracking-widest text-primary/60 uppercase transition-colors hover:text-primary"
										>Recover</a
									>
								</div>
								<div class="group relative">
									<Lock
										class="absolute top-3.5 left-3.5 size-4 text-zinc-500 transition-colors group-focus-within:text-primary"
									/>
									<Input
										id="password"
										type="password"
										class="h-12 border-zinc-800 bg-zinc-950/50 pl-11 transition-all focus-visible:ring-primary/50"
										required
									/>
								</div>
							</div>
						</div>

						<Button
							type="submit"
							disabled={isLoading}
							class="relative h-12 w-full overflow-hidden bg-primary text-base font-bold transition-all hover:brightness-110 active:scale-[0.98]"
						>
							<span class="relative z-10 flex items-center gap-2">
								{#if isLoading}
									<LoaderCircle class="size-5 animate-spin" />
									Authenticating...
								{:else}
									Authorize Access
									<Fingerprint class="size-5" />
								{/if}
							</span>
						</Button>
					</form>
				</Card.Content>

				<Card.Footer
					class="mt-4 flex justify-center border-t border-zinc-800/50 bg-zinc-950/40 py-4"
				>
					<p class="text-xs text-zinc-500">
						New operative? <a
							href="/signup"
							class="font-bold text-zinc-300 transition-colors hover:text-primary"
							>Request Credentials</a
						>
					</p>
				</Card.Footer>
			</Card.Root>

			<div
				class="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase"
			>
				<span class="flex items-center gap-1.5"
					><span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span> System
					Online</span
				>
				<span class="h-1 w-1 rounded-full bg-zinc-800"></span>
				<span>Encrypted Node: 0x4F2</span>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom glow for the primary button */
	:global(.bg-primary) {
		box-shadow: 0 0 20px -5px hsl(var(--primary) / 0.4);
	}
</style>
