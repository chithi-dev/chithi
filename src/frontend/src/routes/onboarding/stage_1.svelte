<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Field from '$lib/components/ui/field/index.js';
  import { User, ArrowRight, Mail, Lock } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { toast } from 'svelte-sonner';
  import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
  import { OnboardingDocument, CompleteOnboardingDocument } from '$lib/graphql/generated/graphql.js';
  import type { OnboardingQuery, CompleteOnboardingMutation } from '$lib/graphql/generated/graphql.js';
  import { client } from '$lib/graphql/client.js';
  import { login as loginRemote } from '$lib/remote/auth.remote';
  import { user_store } from '$lib/store/user.svelte';
  import type { Props } from './types';

  let { onNext }: Props = $props();
  let isLoading = $state(false);
  let username = $state('');
  let email = $state('');
  let password = $state('');
  createQueryStore<OnboardingQuery>(OnboardingDocument);
  const valid = $derived(username && email && password);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    isLoading = true;
    try {
      const result = await client.mutate<CompleteOnboardingMutation>({
        mutation: CompleteOnboardingDocument,
        variables: { username, email, password, siteDescription: '' }
      });
      if (result.error) throw new Error(result.error.message);
      toast.success('Admin account created successfully');
      await loginRemote({ username, password });
      user_store.authenticate();
      toast.success('Logged in successfully');
      onNext();
    } catch (error: any) { toast.error(error.message || 'Something went wrong'); }
    finally { isLoading = false; }
  }
</script>

<Card.Root class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
  <div class="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"></div>
  <Card.Header class="space-y-3 pt-10 pb-8 text-center">
    <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"><User class="size-8" /></div>
    <div class="space-y-1"><Card.Title class="text-2xl font-semibold tracking-tight text-foreground">Welcome to Chithi</Card.Title><Card.Description class="text-sm text-muted-foreground">Create your admin account to get started</Card.Description></div>
  </Card.Header>
  <Card.Content>
    <form onsubmit={handleSubmit} class="grid gap-6">
      <div class="grid gap-4">
        <Field.Field>
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Username</Field.Label>
          <Field.Content>
            <div class="group relative"><div class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"><User class="size-4" /></div><Input bind:value={username} placeholder="Admin" class="h-12 border-border bg-background/50 pl-11 transition-all focus-visible:ring-primary/40" required /></div>
          </Field.Content>
        </Field.Field>
        <Field.Field>
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Email</Field.Label>
          <Field.Content>
            <div class="group relative"><div class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"><Mail class="size-4" /></div><Input type="email" bind:value={email} placeholder="name@example.com" class="h-12 border-border bg-background/50 pl-11 transition-all focus-visible:ring-primary/40" required /></div>
          </Field.Content>
        </Field.Field>
        <Field.Field>
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Password</Field.Label>
          <Field.Content>
            <div class="group relative"><div class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"><Lock class="size-4" /></div><Input type="password" bind:value={password} class="h-12 border-border bg-background/50 pl-11 transition-all focus-visible:ring-primary/40" required /></div>
          </Field.Content>
        </Field.Field>
      </div>
      <Button type="submit" disabled={isLoading || !valid} class="h-12 w-full font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70">
        {#if isLoading}<Spinner class="mr-2" />Setting up...{:else}Create Account<ArrowRight class="ml-2 size-5 transition-transform group-hover:translate-x-1" />{/if}
      </Button>
    </form>
  </Card.Content>
</Card.Root>
