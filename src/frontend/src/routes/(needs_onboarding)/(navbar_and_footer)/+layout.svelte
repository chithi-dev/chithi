<script lang="ts">
	import {
		SunIcon,
		Send,
		MoonIcon,
		LogOut,
		UserCog,
		SlidersVertical,
		Link,
		Globe2,
		BookOpenText
	} from 'lucide-svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { toggleMode } from 'mode-watcher';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Dropdown from '$lib/components/ui/dropdown-menu';
	import { useAuth } from '#queries/auth';
	import { mode } from 'mode-watcher';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { kebab_to_initials } from '#functions/string-conversion';
	import { make_libravatar_url } from '#functions/libravatar';
	import { page } from '$app/state';
	import GithubIcon from '#logos/github.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	const { isAuthenticated, user: userData } = useAuth();

	let { children } = $props();

	let initials = $derived(kebab_to_initials(userData.data?.username ?? ''));

	let flagForRestart = $state(false);
	let hashedAvatar = $state<null | string>(null);
	$effect(() => {
		(async () => {
			hashedAvatar = await make_libravatar_url(userData.data?.email ?? '');
		})();
	});

	function programmedNavigation(event: Event) {
		const anchorElement = event.currentTarget as HTMLAnchorElement;
		const href = anchorElement.getAttribute('href');
		if (href === page.url.pathname) {
			// Switch between true and false
			flagForRestart = !flagForRestart;
		}
	}

	const adminLinks = [
		{
			href: '/admin/user',
			name: 'Customize User',
			icon: UserCog
		},
		{
			href: '/admin/config',
			name: 'Config',
			icon: SlidersVertical
		},
		{
			href: '/admin/urls',
			name: 'Outstanding URLs',
			icon: Link
		}
	];
	const footerLinks = [
		{
			href: 'https://docs.chithi.dev',
			name: 'Documentation',
			icon: BookOpenText
		},
		{
			href: 'https://public.chithi.dev',
			name: 'Public Instances',
			icon: Globe2
		},
		{
			href: 'https://github.com/chithi-dev/chithi',
			name: 'Source',
			icon: GithubIcon
		}
	];
</script>

<div class="relative flex min-h-svh min-w-screen flex-col overflow-hidden bg-background text-foreground">
	<div class="pointer-events-none absolute inset-0 z-0 bg-slate-50 dark:bg-zinc-950">
		<!-- Rotating Beams -->
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_50s_linear_infinite_reverse] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_180deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>

		<!-- Blobs -->
		<div
			class="absolute -top-[20%] -left-[20%] h-160 w-160 animate-blob rounded-full bg-purple-300/40 mix-blend-multiply blur-[100px] filter dark:bg-purple-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute top-[10%] -right-[20%] h-140 w-140 animate-blob rounded-full bg-yellow-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:2s] dark:bg-indigo-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute -bottom-[20%] left-[20%] h-180 w-180 animate-blob rounded-full bg-pink-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:4s] dark:bg-blue-900/40 dark:mix-blend-hard-light"
		></div>

		<!-- Grid with Pulse -->
		<div
			class="absolute inset-0 animate-pulse-slow bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"
		></div>

		<!-- Floating Particles & Stars -->
		<div class="absolute inset-0 overflow-hidden">
			<div
				class="absolute top-[20%] left-[10%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="absolute top-[60%] right-[15%] h-3 w-3 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[10%] left-[30%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[30%] right-[40%] h-1.5 w-1.5 animate-float rounded-full bg-primary/30 blur-[1px] [animation-delay:5s]"
			></div>

			<!-- Twinkling Stars -->
			<div
				class="absolute top-[15%] left-[25%] h-1 w-1 animate-twinkle rounded-full bg-yellow-200/60 blur-[0.5px]"
			></div>
			<div
				class="absolute top-[35%] right-[25%] h-1.5 w-1.5 animate-twinkle rounded-full bg-blue-200/60 blur-[0.5px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[25%] left-[45%] h-1 w-1 animate-twinkle rounded-full bg-purple-200/60 blur-[0.5px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[10%] right-[10%] h-0.5 w-0.5 animate-twinkle rounded-full bg-white/60 blur-[0.5px] [animation-delay:5s]"
			></div>
		</div>

		<!-- Noise Overlay -->
		<div class="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay">
			<svg class="h-full w-full">
				<filter id="noise">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.8"
						numOctaves="3"
						stitchTiles="stitch"
					/>
				</filter>
				<rect width="100%" height="100%" filter="url(#noise)" />
			</svg>
		</div>

		<!-- Vignette -->
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-slate-50)_100%)] opacity-60 dark:bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-zinc-950)_100%)]"
		></div>
	</div>

	<!-- Top Bar -->
	<header
		class="sticky top-0 z-50 flex items-center justify-between bg-transparent p-4 backdrop-blur-md transition-colors duration-500"
	>
		<a href="/" class="flex items-center" onclick={programmedNavigation}>
			<Send class="h-6 w-6 text-primary" />
			<h1 class="ml-2 text-2xl font-bold md:text-xl">Chithi</h1>
		</a>

		<div class="flex items-center gap-2">
			{#if isAuthenticated()}
				<Dropdown.Root>
					<Dropdown.Trigger>
						<div class="my-0.5">
							<Avatar.Root>
								{#if userData.data?.email}
									{#key hashedAvatar}
										<Avatar.Image
											src={hashedAvatar}
											alt="@{userData.data?.username ?? 'username'}"
										/>
									{/key}
								{/if}
								<Avatar.Fallback>{initials}</Avatar.Fallback>
							</Avatar.Root>
						</div>
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
						<Dropdown.DropdownMenuSub>
							<Dropdown.DropdownMenuSubTrigger>Admin</Dropdown.DropdownMenuSubTrigger>
							<Dropdown.DropdownMenuPortal>
								<Dropdown.DropdownMenuSubContent>
									{#each adminLinks as item}
										<Dropdown.DropdownMenuItem>
											<a href={item.href} class="flex w-full items-center gap-2">
												<item.icon />
												{item.name}
											</a>
										</Dropdown.DropdownMenuItem>
									{/each}
									<!-- <Dropdown.DropdownMenuSeparator /> -->
								</Dropdown.DropdownMenuSubContent>
							</Dropdown.DropdownMenuPortal>
						</Dropdown.DropdownMenuSub>
						<Dropdown.Item class="mt-1 flex items-center gap-2" variant="destructive">
							<a href="/logout?next={page.url.pathname}" class="flex w-full items-center gap-2">
								<LogOut class="h-4 w-4" />
								Logout
							</a>
						</Dropdown.Item>
					</Dropdown.Content>
				</Dropdown.Root>
			{:else}
				<Button variant="outline" size="sm" href="/login?next={page.url.pathname}">Login</Button>
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
	{#key flagForRestart}
		<main class="relative flex flex-1 items-center justify-center overflow-hidden p-4">
			<div class="relative z-10 w-full max-w-5xl shadow-[0_0_15px_-12px_var(--primary)]">
				{@render children()}
			</div>
		</main>
	{/key}

	<!-- Footer -->
	<footer class="bg-transparent p-4 backdrop-blur-md transition-colors duration-500">
		<div class="mx-auto w-full">
			<nav
				class="flex flex-row flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground md:gap-6"
			>
				{#each footerLinks as footer_item}
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger
								><Button
									variant="ghost"
									size="icon"
									aria-label={footer_item.name}
									class="transition-colors hover:text-foreground"
									href={footer_item.href}
								>
									<footer_item.icon />
								</Button></Tooltip.Trigger
							>
							<Tooltip.Content>{footer_item.name}</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/each}
			</nav>
		</div>
	</footer>
</div>
