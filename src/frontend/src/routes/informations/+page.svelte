<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { SiGithub } from '@icons-pack/svelte-simple-icons';
	import {
		Server,
		PanelsTopLeft,
		Activity,
		Code,
		BookOpen,
		ArrowRight,
		ExternalLink
	} from '@lucide/svelte';
	import { Api } from '$lib/consts/backend';

	const sections = [
		{
			title: 'Backend',
			subtitle: 'INFRASTRUCTURE',
			description: 'Runtime environment, service versions, and architectural metadata.',
			icon: Server,
			href: '/informations/backend',
			color: 'text-blue-500',
			bg: 'bg-blue-500/10',
			border: 'border-blue-500/20'
		},
		{
			title: 'Frontend',
			subtitle: 'INTERFACE',
			description: 'Client-side versioning, build information, and UI framework details.',
			icon: PanelsTopLeft,
			href: '/informations/frontend',
			color: 'text-purple-500',
			bg: 'bg-purple-500/10',
			border: 'border-purple-500/20'
		},
		{
			title: 'Statistics',
			subtitle: 'PERFORMANCE',
			description: 'Real-time instance metrics, storage usage, and system health.',
			icon: Activity,
			href: '/informations/statistics',
			color: 'text-emerald-500',
			bg: 'bg-emerald-500/10',
			border: 'border-emerald-500/20'
		},
		{
			title: 'API Reference',
			subtitle: 'DEVELOPER',
			description: 'Interactive OpenAPI/Swagger documentation for the backend services.',
			icon: Code,
			href: `${Api.BASE}/docs`,
			external: true,
			color: 'text-amber-500',
			bg: 'bg-amber-500/10',
			border: 'border-amber-500/20'
		}
	];
</script>

<div class="grid gap-4 sm:grid-cols-2">
	{#each sections as section}
		<a
			href={section.href}
			target={section.external ? '_blank' : undefined}
			rel={section.external ? 'noopener noreferrer' : undefined}
			class="group block no-underline"
		>
			<Card.Root
				class="relative h-full overflow-hidden border border-border/60 bg-card/75 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]"
			>
				<Card.Header class="space-y-4">
					<div class="flex items-center justify-between">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-2xl border {section.border} {section.bg} {section.color} transition-transform duration-500 group-hover:scale-110"
						>
							<section.icon class="h-6 w-6" />
						</div>
						{#if section.external}
							<ExternalLink class="h-4 w-4 text-muted-foreground/40" />
						{:else}
							<ArrowRight
								class="h-5 w-5 text-muted-foreground/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
							/>
						{/if}
					</div>
					<div class="space-y-1.5">
						<p class="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/80 uppercase">
							{section.subtitle}
						</p>
						<Card.Title class="text-xl font-bold tracking-tight text-foreground">
							{section.title}
						</Card.Title>
						<Card.Description class="line-clamp-2 text-sm leading-relaxed">
							{section.description}
						</Card.Description>
					</div>
				</Card.Header>

				<div
					class="absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.06]"
				>
					<section.icon class="h-24 w-24" />
				</div>
			</Card.Root>
		</a>
	{/each}

	<div class="mt-4 flex w-full flex-col gap-3 sm:col-span-2 sm:flex-row">
		<Button
			variant="outline"
			class="h-12 flex-1 gap-2.5 border-border/60 bg-card/50 font-semibold backdrop-blur-md transition-all hover:border-primary/40 hover:bg-card hover:text-primary"
			href="https://github.com/chithi-dev/chithi"
			target="_blank"
			rel="noopener noreferrer"
		>
			<SiGithub size={18} />
			GitHub Repository
		</Button>

		<Button
			variant="outline"
			class="h-12 flex-1 gap-2.5 border-border/60 bg-card/50 font-semibold backdrop-blur-md transition-all hover:border-primary/40 hover:bg-card hover:text-primary"
			href="https://docs.chithi.dev"
			target="_blank"
			rel="noopener noreferrer"
		>
			<BookOpen class="h-5 w-5" />
			Full Documentation
		</Button>
	</div>
</div>
