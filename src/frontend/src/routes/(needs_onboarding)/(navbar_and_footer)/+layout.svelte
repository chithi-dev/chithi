<script lang="ts">
	import { SunIcon, Send, MoonIcon, Settings, LogOut, User } from 'lucide-svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { toggleMode } from 'mode-watcher';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Dropdown from '$lib/components/ui/dropdown-menu';
	import { useAuth } from '$lib/queries/auth';
	import { mode } from 'mode-watcher';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { kebab_to_initials } from '$lib/functions/string-conversion';
	import { make_libravatar_url } from '$lib/functions/libravatar';

	const { isAuthenticated, user: userData } = useAuth();

	let { children } = $props();

	let initials = $derived(kebab_to_initials(userData.data?.username ?? ''));

	let hashedAvatar = $state<null | string>(null);
	$effect(() => {
		(async () => {
			hashedAvatar = await make_libravatar_url(userData.data?.email ?? '');
		})();
	});
</script>

<div class="flex min-h-screen min-w-screen flex-col bg-background text-foreground">
	<!-- Top Bar -->
	<header class="flex items-center justify-between border-b border-border p-4">
		<div class="flex items-center">
			<Send class="h-6 w-6 text-primary" />
			<h1 class="ml-2 text-2xl font-bold md:text-xl">Chithi</h1>
		</div>

		<div class="flex items-center gap-2">
			{#if isAuthenticated()}
				<Dropdown.Root>
					<Dropdown.Trigger>
						<Avatar.Root>
							{#if userData.data?.email}
								{#key hashedAvatar}
									<Avatar.Image src={hashedAvatar} alt="@{userData.data?.username ?? 'username'}" />
								{/key}
							{/if}
							<Avatar.Fallback>{initials}</Avatar.Fallback>
						</Avatar.Root>
					</Dropdown.Trigger>

					<Dropdown.Content align="end" sideOffset={4} class="w-48">
						<Dropdown.Item>
							<div class="flex w-full items-center justify-between gap-2">
								<div class="flex items-center gap-2">
									<Label for="theme-switch">Theme</Label>
								</div>
								<Switch
									id="theme-switch"
									checked={mode.current === 'dark'}
									onclick={() => toggleMode()}
								/>
							</div>
						</Dropdown.Item>

						<Dropdown.Separator />

						<Dropdown.Item class="flex items-center gap-2">
							<a href="/admin/config" class="flex w-full items-center gap-2">
								<Settings class="h-4 w-4" />
								Config
							</a>
						</Dropdown.Item>

						<Dropdown.Item class="flex items-center gap-2">
							<a href="/admin/user" class="flex w-full items-center gap-2">
								<User class="h-4 w-4" />
								Users
							</a>
						</Dropdown.Item>
						<Dropdown.Item class="mt-1 flex items-center gap-2" variant="destructive">
							<a href="/logout" class="flex w-full items-center gap-2">
								<LogOut class="h-4 w-4" />
								Logout
							</a>
						</Dropdown.Item>
					</Dropdown.Content>
				</Dropdown.Root>
			{:else}
				<Button variant="outline" size="sm" href="/login">Login</Button>
				<Button
					variant="outline"
					size="icon"
					onclick={(e) => {
						e.preventDefault();
						toggleMode();
					}}
				>
					<SunIcon
						class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
					/>
					<MoonIcon
						class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
					/>
					<span class="sr-only">Toggle theme</span>
				</Button>
			{/if}
		</div>
	</header>

	<!-- Main Content -->
	{@render children()}

	<!-- Footer -->
	<footer class="border-t border-border p-4">
		<div class="mx-auto w-full max-w-6xl">
			<nav
				class="flex flex-row flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground md:gap-6"
			>
				<!-- <a
					href="/donate"
					class="font-medium whitespace-nowrap transition-colors hover:text-foreground">Donate</a
				>
				<a href="/cli" class="font-medium whitespace-nowrap transition-colors hover:text-foreground"
					>CLI</a
				> 
				<a
					href="/dmca"
					class="font-medium whitespace-nowrap transition-colors hover:text-foreground">DMCA</a
				> -->
				<a
					href="https://github.com/chithi-dev/chithi"
					class="font-medium whitespace-nowrap transition-colors hover:text-foreground">Source</a
				>
			</nav>
		</div>
	</footer>
</div>
