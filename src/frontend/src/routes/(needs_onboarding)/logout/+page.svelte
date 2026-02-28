<script>
	import { user_store } from '$lib/store/user.svelte';

	const { unauthenticate } = user_store();

	$effect.pre(() => {
		unauthenticate();
	});
</script>
