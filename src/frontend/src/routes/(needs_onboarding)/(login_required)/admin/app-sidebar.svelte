<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index';
	import { Settings, UserPen, Link } from '@lucide/svelte';
	import favicon from '$lib/assets/logo.svg';
	const items = [
		{
			title: 'Profile',
			url: '/admin/user',
			icon: UserPen
		},
		{
			title: 'Config',
			url: '/admin/config',
			icon: Settings
		},
		{
			title: 'Outstanding Urls',
			url: '/admin/urls',
			icon: Link
		}
	];
</script>

<Sidebar.Root>
	<Sidebar.Inset>
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:p-1.5!">
						<a href="/" class="flex items-center gap-2">
							<img src={favicon} alt="logo" class="h-6 w-6" />
							<p class="text-xl font-bold tracking-tight">Chithi</p>
						</a>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Chithi Admin Panel</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each items as item (item.title)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton>
									{#snippet child({ props })}
										<a href={item.url} {...props}>
											<item.icon />
											<span>{item.title}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
	</Sidebar.Inset>
</Sidebar.Root>
