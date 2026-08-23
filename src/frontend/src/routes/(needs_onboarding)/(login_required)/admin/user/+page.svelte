<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { H2, Mutated } from '$lib/components/ui/typography/index.js';
	import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
	import { MeDocument, UpdateUserDocument } from '$lib/graphql/generated/graphql.js';
	import type { MeQuery, UpdateUserMutation } from '$lib/graphql/generated/graphql.js';
	import { client } from '$lib/graphql/client.js';
	import { kebab_to_initials } from '#functions/string-conversion';
	import { make_libravatar_url } from '#functions/libravatar';

	const { default: ProfileFieldsGroup } = await import('./profile_fields_group.svelte');
	const { default: ProfileSubmitSection } = await import('./profile_submit_section.svelte');

	const meQuery = createQueryStore<MeQuery>(MeDocument);

	let username = $state('');
	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let initials = $derived(kebab_to_initials(username));
	let avatarBlobUrl = $state<string | null>(null);
	let isAvatarLoading = $state(false);

	$effect.pre(() => {
		let active = true;
		let objectUrl: string | null = null;

		(async () => {
			if (!email) return;
			isAvatarLoading = true;
			try {
				const url = await make_libravatar_url(email);
				const res = await fetch(url);
				const blob = await res.blob();
				if (active) {
					objectUrl = URL.createObjectURL(blob);
					avatarBlobUrl = objectUrl;
				}
			} catch (err) {
				console.error('Failed to load avatar', err);
			} finally {
				if (active) {
					isAvatarLoading = false;
				}
			}
		})();

		return () => {
			active = false;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	});

	$effect(() => {
		if (meQuery.data?.me) {
			username = meQuery.data.me.username;
			email = meQuery.data.me.email || '';
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		success = null;

		try {
			const currentUser = meQuery.data?.me;
			if (!currentUser) throw new Error('No authenticated user');
			const result = await client.mutate<UpdateUserMutation>({
				mutation: UpdateUserDocument,
				variables: {
					userId: currentUser.id,
					username,
					email: email ? email : null
				}
			});
			if (result.error) throw new Error(result.error.message);
			success = 'Profile updated successfully';
			// Clear success message after 3 seconds
			setTimeout(() => {
				success = null;
			}, 3000);
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<H2>Profile</H2>
		<Mutated>Manage your public profile and private details.</Mutated>
	</div>
</div>

<Card.Root class="border bg-background">
	<Card.Header class="px-6 py-4">
		<Card.Title class="text-base font-medium">Personal Information</Card.Title>
	</Card.Header>
	<Card.Content class="p-0">
		<form onsubmit={handleSubmit} class="space-y-0">
			<ProfileFieldsGroup bind:username bind:email {avatarBlobUrl} {initials} {isAvatarLoading} />

			<ProfileSubmitSection {error} {success} {loading} />
		</form>
	</Card.Content>
</Card.Root>
