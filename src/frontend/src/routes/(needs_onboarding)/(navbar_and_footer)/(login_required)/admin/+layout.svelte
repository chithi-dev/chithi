<script lang="ts">
  import { page } from '$app/state';
  import AdminSidebar from '$lib/components/ui/admin-sidebar.svelte';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';

  let { children } = $props();

  const titles: Record<string,string> = {
    '/admin': 'Buckets',
    '/admin/config': 'Project Settings',
    '/admin/urls': 'Outstanding URLs',
    '/admin/user': 'Profile'
  };

  $: title = titles[page.url.pathname] ?? (page.url.pathname.split('/').pop() ?? 'Admin');
</script>

<div class="min-h-screen flex" style="background:var(--background)">
  <AdminSidebar />

  <div class="flex-1 flex flex-col">
    <header class="flex items-center justify-between border-b px-6 py-4 bg-card">
      <div>
        <h1 class="text-xl font-semibold">{title}</h1>
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden md:flex items-center gap-2">
          <Input placeholder="Search" class="w-72" />
          <Button variant="outline" size="sm">Refresh</Button>
          <Button>Create Bucket</Button>
        </div>
      </div>
    </header>

    <main class="p-6 md:p-10 max-w-7xl w-full mx-auto flex-1">
      <div class="space-y-6">
        {@render children()}
      </div>
    </main>
  </div>
</div>
