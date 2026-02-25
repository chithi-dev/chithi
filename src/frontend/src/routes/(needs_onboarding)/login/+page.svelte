<script lang="ts" module>
  import { z } from "zod/v4";
 
  const formSchema = z.object({
    email: z.string().min(1, "Email or Username is required"),
    password: z.string().min(1, "Password is required")
  });
  
  export type FormSchema = typeof formSchema;
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { page } from '$app/state';
	import {
		ShieldCheck,
		ArrowRight,
		Mail,
		Lock,
		LoaderCircle,
		ChevronLeft,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils';
	import { useAuth } from '#queries/auth';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { zod4 } from "sveltekit-superforms/adapters";
	import * as Form from "$lib/components/ui/form/index";
	import { defaults, superForm } from "sveltekit-superforms";

	// States
	let showPassword = $state(false);
	
	// Next url
	const nextUrl = $derived.by(()=>{
		const url =page.url.searchParams.get('next') ?? '/'; 
		if (url.startsWith('/admin')){
			return "/"
		}
		return url
	});

	const { login } = useAuth();
	
	const form = superForm(defaults(zod4(formSchema)), {
		validators: zod4(formSchema),
		SPA: true,
		onUpdate: async ({ form: f }) => {
			if (f.valid) {
				try {
					const token = await login(f.data.email, f.data.password);
					if (token) {
						goto(nextUrl);
					}
				} catch (e) {
					if (e instanceof Error) {
						toast.error(e.message);
					}
				}
			} else {
				toast.error("Please fix the errors in the form.");
			}
		}
	});

	const { form: formData, enhance, submitting } = form;

	const isPasswordEmpty = $derived($formData.password.length === 0);


	// Auto-hide password text if the input is cleared
	$effect(() => {
		if (isPasswordEmpty) {
			showPassword = false;
		}
	});
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-card p-4 transition-colors duration-500"
>
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-24 -left-24 h-125 w-125 rounded-full bg-primary/10 blur-[120px]"
		></div>
		<div
			class="absolute -right-24 -bottom-24 h-125 w-125 rounded-full bg-primary/10 blur-[120px]"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_90%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<a
		href={nextUrl}
		class="group absolute top-8 left-8 z-20 flex items-center gap-2 rounded-full border border-border bg-background/50 px-5 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-background hover:text-foreground"
	>
		<ChevronLeft class="size-4 transition-transform group-hover:-translate-x-1" />
		Back to {nextUrl}
	</a>

	<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-100">
		<Card
			class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
			></div>

			<CardHeader class="space-y-3 pt-10 pb-8 text-center">
				<div
					class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
				>
					<ShieldCheck class="size-8" />
				</div>
				<div class="space-y-1">
					<CardTitle class="text-2xl font-semibold tracking-tight text-foreground"
						>Admin Portal</CardTitle
					>
					<CardDescription class="text-sm text-muted-foreground">
						Enter your credentials to continue
					</CardDescription>
				</div>
			</CardHeader>

			<CardContent>
				<form use:enhance class="grid gap-6">
					<Form.Field {form} name="email">
						<Form.Control >
							<Form.Label class="ml-1 text-sm font-medium text-foreground">Email or Username</Form.Label>
							<div class="group relative">
								<div
									class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
								>
									<Mail class="size-4" />
								</div>
								<Input
									bind:value={$formData.email}
									placeholder="name@example.com"
									class="h-12 border-border bg-background/50 pl-11 transition-all focus-visible:ring-primary/40"
								/>
							</div>
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Field {form} name="password">
						<Form.Control>
							<Form.Label class="text-sm font-medium text-foreground">Password</Form.Label>
							<div class="group relative">
								<div
									class="absolute inset-y-0 left-3.5 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary"
								>
									<Lock class="size-4" />
								</div>
								<Input
									type={showPassword ? 'text' : 'password'}
									bind:value={$formData.password}
									placeholder="••••••••"
									class="h-12 border-border bg-background/50 px-11 transition-all focus-visible:ring-primary/40"
								/>

								<Button
									variant="ghost"
									size="icon"
									type="button"
									onclick={() => (showPassword = !showPassword)}
									disabled={isPasswordEmpty}
									class={cn(
										'absolute top-1 right-1 h-10 w-10 text-muted-foreground transition-all duration-200',
										isPasswordEmpty && 'pointer-events-none scale-90 opacity-0',
										!isPasswordEmpty &&
											'scale-100 opacity-100 hover:bg-transparent hover:text-foreground'
									)}
								>
									{#if showPassword}
										<EyeOff class="size-4" />
									{:else}
										<Eye class="size-4" />
									{/if}
								</Button>
							</div>
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Button
						type="submit"
						disabled={$submitting}
						class="h-12 w-full font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
					>
						{#if $submitting}
							<LoaderCircle class="mr-2 size-5 animate-spin" />
							Authenticating
						{:else}
							Sign In
							<ArrowRight class="ml-2 size-5 transition-transform group-hover:translate-x-1" />
						{/if}
					</Button>
				</form>
			</CardContent>

			<CardFooter
				class="flex items-center justify-center border-t border-border/50 bg-muted/50 py-6"
			>
				<p class="text-sm text-muted-foreground">
					Don't have an account?
					<a
						href="/signup"
						class="ml-1 font-semibold text-foreground transition-colors hover:text-primary"
					>
						Create an account
					</a>
				</p>
			</CardFooter>
		</Card>
	</div>
</div>
