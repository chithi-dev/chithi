<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { useAuth } from '#queries/auth';
	import { kebab_to_initials } from '#functions/string-conversion';
	import { make_libravatar_url } from '#functions/libravatar';
	import ProfileFieldsGroup from './profile_fields_group.svelte';
	import ProfileSubmitSection from './profile_submit_section.svelte';

	const { user, updateUser } = useAuth();

	let username = $state('');
	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let initials = $derived(kebab_to_initials(username));
	let avatarBlobUrl = $state<string | null>(null);
	let isAvatarLoading = $state(false);

	$effect(() => {
		if (user.data) {
			username = user.data.username;
			email = user.data.email || '';
		}
	});

	$effect(() => {
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

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		success = null;

		try {
			await updateUser({
				username,
				email: email ? email : null
			});
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
		<h2 class="text-3xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">Manage your public profile and private details.</p>
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
