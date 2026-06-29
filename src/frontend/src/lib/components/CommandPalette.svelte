<script lang="ts">
  import { goto } from '$app/navigation';
  import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '$lib/components/ui/command/index.js';
  import { setMode } from 'mode-watcher';

  let open = $state(false);

  $effect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open = !open;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  });

  function navigate(to: string) {
    open = false;
    goto(to);
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    setMode(isDark ? 'light' : 'dark');
  }
</script>

<CommandDialog bind:open>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Pages">
      <CommandItem onclick={() => navigate('/')}>Home</CommandItem>
      <CommandItem onclick={() => navigate('/upload/')}>Upload</CommandItem>
      <CommandItem onclick={() => navigate('/speedtest/')}>Speed Test</CommandItem>
      <CommandItem onclick={() => navigate('/reverse/')}>Reverse Transfer</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Admin">
      <CommandItem onclick={() => navigate('/admin/config')}>Settings</CommandItem>
      <CommandItem onclick={() => navigate('/admin/users')}>Users</CommandItem>
      <CommandItem onclick={() => navigate('/admin/urls')}>URLs</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Appearance">
      <CommandItem onclick={toggleTheme}>
        Toggle Theme
        <CommandShortcut>Ctrl+K</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
