<script lang="ts">
	import * as Item from '$lib/components/ui/item';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let {
		username = $bindable(),
		email = $bindable(),
		avatarBlobUrl,
		initials,
		isAvatarLoading
	}: {
		username: string;
		email: string;
		avatarBlobUrl: string | null;
		initials: string;
		isAvatarLoading: boolean;
	} = $props();
</script>

<Item.Group>
	<Item.Root>
		<Item.Content>
			<Item.Title>Avatar</Item.Title>
			<Item.Description class="line-clamp-none">
				Your profile picture, fetched from Libravatar using your email.
			</Item.Description>
		</Item.Content>
		<Item.Actions class="w-full justify-start md:w-auto md:min-w-75 md:justify-end">
			{#if isAvatarLoading}
				<Skeleton class="h-16 w-16 rounded-full" />
			{:else}
				<Avatar.Root class="h-16 w-16 border bg-muted">
					<Avatar.Image src={avatarBlobUrl} alt="@{username}" />
					<Avatar.Fallback class="text-lg">{initials}</Avatar.Fallback>
				</Avatar.Root>
			{/if}
		</Item.Actions>
	</Item.Root>

	<Item.Separator />

	<Item.Root>
		<Item.Content>
			<Item.Title>Username</Item.Title>
			<Item.Description class="line-clamp-none">This is your public display name.</Item.Description>
		</Item.Content>
		<Item.Actions class="w-full md:min-w-75">
			<Input id="username" bind:value={username} class="w-full bg-background" required />
		</Item.Actions>
	</Item.Root>

	<Item.Separator />

	<Item.Root>
		<Item.Content>
			<Item.Title>Email Address</Item.Title>
			<Item.Description class="line-clamp-none">Used for avatar and notifications.</Item.Description
			>
		</Item.Content>
		<Item.Actions class="w-full md:min-w-75">
			<Input
				id="email"
				type="email"
				bind:value={email}
				class="w-full bg-background"
				placeholder="email@example.com"
			/>
		</Item.Actions>
	</Item.Root>
</Item.Group>
