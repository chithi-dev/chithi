<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Settings, UserPen, Link } from '@lucide/svelte';
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
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:p-1.5!">
					<a href="/">
						<p class=" font-semibold">Chithi</p>
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
</Sidebar.Root>
