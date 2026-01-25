<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Home, Key, Shield, Users, Layers, Settings, BookOpen, Archive } from 'lucide-svelte';

  type Item = { label: string; href: string; Icon: any };

  const items: Item[] = [
    { label: 'Browser', href: '/admin', Icon: Home },
    { label: 'Access Keys', href: '/admin/access-keys', Icon: Key },
    { label: 'Policies', href: '/admin/policies', Icon: Shield },
    { label: 'Users', href: '/admin/user', Icon: Users },
    { label: 'User Groups', href: '/admin/user-groups', Icon: Users },
    { label: 'Import/Export', href: '/admin/import-export', Icon: Archive },
    { label: 'Performance', href: '/admin/performance', Icon: Layers },
    { label: 'Bucket Setting', href: '/admin/config', Icon: Settings }
  ];
</script>

<aside style="min-height:100vh; width:18rem; background:var(--color-sidebar); color:var(--color-sidebar-foreground); display:flex; flex-direction:column;">
  <div style="padding:1rem; display:flex; align-items:center; gap:0.75rem;">
    <div style="height:2rem; width:2rem; border-radius:0.5rem; background:var(--sidebar-primary); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--sidebar-primary-foreground);">R</div>
    <div style="font-weight:700; font-size:0.95rem;">RUSTFS</div>
  </div>

  <nav style="flex:1; overflow:auto; padding:0.5rem 0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
    {#each items as item}
      <a href={item.href}
        on:click|preventDefault={() => goto(item.href)}
        style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem; border-radius:0.375rem; text-decoration:none; color:inherit;"
        class:active={page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
      >
        <svelte:component this={item.Icon} class="size-4" />
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{item.label}</span>
      </a>
    {/each}
  </nav>

  <div style="padding:0.75rem; border-top:1px solid var(--color-sidebar-border);">
    <a href="/admin/docs" on:click|preventDefault={() => goto('/admin/docs')} style="display:flex; gap:0.5rem; align-items:center; padding:0.5rem; border-radius:0.375rem; color:inherit; text-decoration:none;">
      <BookOpen class="size-4" />
      <span class="text-sm">Documentation</span>
    </a>
  </div>
</aside>

<style>
  a.active {
    background: var(--color-sidebar-accent, rgba(255,255,255,0.04));
    color: var(--color-sidebar-accent-foreground, inherit);
  }
  .size-4 { width: 1rem; height: 1rem; }
</style>