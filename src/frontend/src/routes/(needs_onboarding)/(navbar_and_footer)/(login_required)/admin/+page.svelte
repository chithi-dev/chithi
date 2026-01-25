<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Trash2, Settings } from 'lucide-svelte';

  const buckets = [
    { name: 'chithi', created_at: '2026-01-24 21:50:00', objects: 23, size: '492.0 MiB' }
  ];

  function goToSettings(name: string) {
    // placeholder
    alert(`Open settings for ${name}`);
  }

  function deleteBucket(name: string) {
    // placeholder
    if (confirm(`Delete bucket ${name}?`)) alert('Deleted ' + name);
  }
</script>

<div class="space-y-6">
  <Card.Root class="border shadow-sm">
    <Card.Header class="border-b bg-muted/20 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <Card.Title class="text-base font-medium">Buckets</Card.Title>
          <Card.Description>Manage your object storage buckets.</Card.Description>
        </div>
        <div class="flex items-center gap-2">
          <Input placeholder="Search" class="w-72" />
          <Button variant="outline" size="sm">Refresh</Button>
          <Button>Create Bucket</Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content class="p-0">
      <div class="p-6">
        {#if buckets.length === 0}
          <div class="text-muted-foreground">No buckets found.</div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full table-fixed border-collapse">
              <thead>
                <tr class="text-left text-sm text-muted-foreground">
                  <th class="pb-2">Bucket</th>
                  <th class="pb-2">Creation Date</th>
                  <th class="pb-2">Object Count</th>
                  <th class="pb-2">Size</th>
                  <th class="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each buckets as b}
                  <tr class="border-t">
                    <td class="py-3">{b.name}</td>
                    <td class="py-3">{b.created_at}</td>
                    <td class="py-3">{b.objects}</td>
                    <td class="py-3">{b.size}</td>
                    <td class="py-3">
                      <div class="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" on:click={() => goToSettings(b.name)}><Settings class="size-4" /> Settings</Button>
                        <Button variant="destructive" size="sm" on:click={() => deleteBucket(b.name)}><Trash2 class="size-4" /> Delete</Button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</div>

<style>
  .size-4 { width: 1rem; height: 1rem; }
</style>