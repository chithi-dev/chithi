<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import { BookOpen } from '@lucide/svelte';

  let { body, headerIcon, title, description, watermarkIcon, showFooter = false }: {
    body: Snippet;
    headerIcon: LucideIcon;
    title: string;
    description: string;
    watermarkIcon?: LucideIcon;
    showFooter?: boolean;
  } = $props();
</script>

<Card.Root class="relative overflow-hidden border border-border/60 bg-card/75 shadow-[0_12px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl">
  <div class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/50 to-transparent"></div>

  <Card.Header class="space-y-2 pb-2">
    <Card.Title class="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        <headerIcon class="h-4 w-4"></headerIcon>
      </div>
      {title}
    </Card.Title>
    <Card.Description>{description}</Card.Description>
  </Card.Header>

  <Card.Content class="grid gap-4 sm:grid-cols-2">
    {@render body()}
  </Card.Content>

  {#if watermarkIcon}
    <div class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04]">
      <watermarkIcon class="h-24 w-24"></watermarkIcon>
    </div>
  {/if}

  {#if showFooter}
    <Card.Footer class="grid gap-2 border-t border-border/50 bg-muted/40 py-4 sm:grid-cols-2">
      <Button variant="outline" class="h-11 w-full gap-2 border-border/70 bg-background/70 font-semibold hover:border-primary/50 hover:bg-primary/5 hover:text-primary" href="https://github.com/chithi-dev/chithi" target="_blank" rel="noopener noreferrer">
        <SiGithub size={16} />
        Repository
      </Button>

      <Button variant="outline" class="h-11 w-full gap-2 border-border/70 bg-background/70 font-semibold hover:border-primary/50 hover:bg-primary/5 hover:text-primary" href="https://docs.chithi.dev" target="_blank" rel="noopener noreferrer">
        <BookOpen class="h-4 w-4" />
        Documentation
      </Button>
    </Card.Footer>
  {/if}
</Card.Root>
