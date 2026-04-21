<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '' } = $props();
</script>

<div class={cn(`absolute inset-0 z-0 overflow-hidden`, className)}>
	<!-- Blurry Blobs -->
	<div
		class="absolute -top-48 -left-48 h-150 w-150 rounded-full bg-primary/10 blur-[140px] dark:bg-primary/20"
	></div>
	<div
		class="absolute top-1/2 left-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px] dark:bg-indigo-500/10"
	></div>
	<div
		class="absolute -right-48 -bottom-48 h-150 w-150 rounded-full bg-blue-500/10 blur-[140px] dark:bg-blue-500/20"
	></div>

	<!-- Grid Pattern -->
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_80%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
	></div>
</div>
