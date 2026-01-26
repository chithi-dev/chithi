<script lang="ts">
	import { resolve_partial_path } from '#functions/urls';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		CalendarIcon,
		HouseIcon,
		InboxIcon,
		SearchIcon,
		SettingsIcon,
		UserPen
	} from '@lucide/svelte';
	const items = [
		{
			title: 'Profile',
			url: '/admin/user',
			icon: UserPen
		},
		{
			title: 'Inbox',
			url: '#',
			icon: InboxIcon
		},
		{
			title: 'Calendar',
			url: '#',
			icon: CalendarIcon
		},
		{
			title: 'Search',
			url: '#',
			icon: SearchIcon
		},
		{
			title: 'Settings',
			url: '#',
			icon: SettingsIcon
		}
	];
</script>

<Sidebar.Root>
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
