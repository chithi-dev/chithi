<script lang="ts">
	const repo = 'https://github.com/chithi-dev/chithi';

	const version = __APP_VERSION__;
	const commit = __COMMIT_SHA__;

	const commitUrl = `${repo}/commit/${commit}`;
</script>

<footer>
	{#if version.startsWith('v0.0.0')}
		<a href={commitUrl} target="_blank">
			{version}
		</a>
	{:else}
		{version}
	{/if}
</footer>
