<script lang="ts">
  import { ExternalLink, GitCommitHorizontal } from '@lucide/svelte';

  let { href, sha, label = 'Source Revision' }: { href: string; sha: string; label?: string } = $props();
</script>

<div class="space-y-1">
  <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
    <GitCommitHorizontal class="h-3 w-3" />
    {label}
  </div>
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    title={sha}
    class="group flex items-center gap-2 font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80"
  >
    <span class="truncate">{sha.slice(0, 12)}</span>
    <ExternalLink class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
  </a>
</div>
