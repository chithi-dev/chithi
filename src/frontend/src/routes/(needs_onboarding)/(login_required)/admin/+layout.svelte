<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index';
	import { Separator } from '$lib/components/ui/separator/index';
	import AppSidebar from './app-sidebar.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	const breadcrumbMap: Record<string, string> = {
		'/admin/user': 'Profile',
		'/admin/config': 'Config',
		'/admin/urls': 'Outstanding Urls'
	};
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header
			class="flex h-16 shrink-0 items-center gap-2 transition-[width,height,ease] group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<div class="flex items-center gap-2 px-4">
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item class="hidden md:block">
							<Breadcrumb.Link href="/admin/user">Admin</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator class="hidden md:block" />
						<Breadcrumb.Item>
							<Breadcrumb.Page>{breadcrumbMap[page.url.pathname] || 'Dashboard'}</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
