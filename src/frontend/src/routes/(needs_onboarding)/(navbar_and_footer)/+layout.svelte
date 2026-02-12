<script lang="ts">
	import {
		SunIcon,
		MoonIcon,
		LogOut,
		UserCog,
		SlidersVertical,
		Link,
		Earth,
		BookOpenText,
		Gauge
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
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import favicon from '$lib/assets/logo.svg';
	import { PUBLIC_INSTANCE_URL } from '#consts/urls';
    import { SiGithub } from "@icons-pack/svelte-simple-icons";
	const { isAuthenticated, user: userData } = useAuth();

	let { children } = $props();

	let initials = $derived(kebab_to_initials(userData.data?.username ?? ''));

	let flagForRestart = $state(false);
	
	let hashedAvatar = $derived(await make_libravatar_url(userData.data?.email ?? ''))

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
			href:'/speedtest',
			name:"Speedtest",
			icon:Gauge
		},
		{
			href: 'https://docs.chithi.dev',
			name: 'Documentation',
			icon: BookOpenText
		},
		{
			href: PUBLIC_INSTANCE_URL,
			name: 'Public Instances',
			icon: Earth
		},
		{
			href: 'https://github.com/chithi-dev/chithi',
			name: 'Source',
			icon: SiGithub
		}
	];
</script>

<div class="relative flex min-h-svh min-w-screen flex-col overflow-hidden bg-background text-foreground">
	<!-- Top Bar -->
	<header
		class="sticky top-0 z-50 flex items-center justify-between bg-transparent p-4 backdrop-blur-md transition-colors duration-500"
	>
		<a href="/" class="flex items-center gap-2" onclick={programmedNavigation}>
			<img src={favicon} alt='logo' class='h-6 w-6 ' />
			<h1 class="text-2xl font-bold md:text-xl">Chithi</h1>
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
