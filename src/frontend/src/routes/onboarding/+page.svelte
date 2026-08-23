<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Check } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import FancyGrid from '$lib/components/FancyGrid.svelte';
  import { OnboardingStep } from './enums';
  import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
  import { OnboardingDocument } from '$lib/graphql/generated/graphql.js';
  import type { OnboardingQuery } from '$lib/graphql/generated/graphql.js';
  const { default: Step1 } = await import('./stage_1.svelte');
  const { default: Step2 } = await import('./stage_2.svelte');
  const onboardingQuery = createQueryStore<OnboardingQuery>(OnboardingDocument);
  let step = $state<OnboardingStep | null>(null);
  $effect(() => { if (!onboardingQuery.fetching && step === null && !onboardingQuery.data?.onboarding.isConfigured) step = OnboardingStep.Stage_1; });
  function nextStep() { if (step === OnboardingStep.Stage_1) step = OnboardingStep.Stage_2; else goto('/'); }
</script>

<div class="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4 transition-colors duration-500">
  <FancyGrid />
  <div class:max-w-xl={step === OnboardingStep.Stage_2} class="z-10 w-full max-w-100 transition-all duration-500">
    {#if onboardingQuery.fetching && step === null}
      <div class="mx-auto w-full max-w-md">
        <Card.Root class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
          <div class="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"></div>
          <Card.Header class="space-y-3 pt-10 pb-6 text-center">
            <Skeleton class="mx-auto mb-2 h-14 w-14 rounded-2xl" />
            <div class="space-y-1"><Skeleton class="mx-auto mb-2 h-6 w-48" /><Skeleton class="mx-auto h-4 w-64" /></div>
          </Card.Header>
          <Card.Content><div class="grid gap-4"><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-3/4" /><Skeleton class="h-12 w-full rounded-md" /></div></Card.Content>
        </Card.Root>
      </div>
    {:else if onboardingQuery.data?.onboarding.isConfigured && step === null}
      <div in:fade class="mx-auto w-full max-w-md">
        <Card.Root class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
          <div class="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"></div>
          <Card.Header class="space-y-3 pt-10 pb-6 text-center">
            <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-green-100 bg-green-50 text-green-600 shadow-sm ring-1 ring-green-200 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"><Check class="size-8" /></div>
            <div class="space-y-1"><Card.Title class="text-2xl font-semibold tracking-tight text-foreground">Already Onboarded</Card.Title><Card.Description class="text-sm text-muted-foreground">This instance has already been set up.</Card.Description></div>
          </Card.Header>
          <Card.Content><div class="grid gap-4"><p class="text-center text-sm text-muted-foreground">If you need to reconfigure, sign in and adjust settings from the dashboard.</p><Button class="mt-2 h-12 w-full" onclick={() => goto('/')}>Go to dashboard</Button></div></Card.Content>
        </Card.Root>
      </div>
    {:else if step === OnboardingStep.Stage_1}
      <div in:fly={{ x: -20, duration: 400, delay: 200 }} out:fade={{ duration: 200 }} class="absolute inset-0 m-auto h-fit w-full max-w-100 p-4"><Step1 onNext={nextStep} /></div>
    {:else if step === OnboardingStep.Stage_2}
      <div in:fly={{ x: 20, duration: 400, delay: 200 }} class="relative w-full"><Step2 onNext={nextStep} /></div>
    {/if}
  </div>
</div>
