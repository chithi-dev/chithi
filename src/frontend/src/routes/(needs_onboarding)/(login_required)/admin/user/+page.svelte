<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Switch } from '$lib/components/ui/switch';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';
	import { toast } from 'svelte-sonner';

	let tab = 'profile';

	// Profile state
	let username = 'zarif-ahnaf';
	let email = 'zarifahnaf@outlook.com';
	let avatarUrl: string | null = null;
	let avatarPreview: string | null = null;

	// KMS / Encryption state
	let kmsType = 'none'; // none | vault | aws
	let vaultAddress = '';
	let authMethod = 'token'; // token | approle
	let kmsEnabled = false;

	let sseEnabled = false;
	let rotateKeysAfterDays = 30;

	onMount(async () => {
		// simple placeholder avatar: try Libravatar via email helper if available
		avatarUrl = `https://seccdn.libravatar.org/avatar/${
			crypto.subtle
				? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)).then((b) =>
						Array.from(new Uint8Array(b))
							.map((x) => x.toString(16).padStart(2, '0'))
							.join('')
					)
				: 'default'
		}?s=512`;
	});

	function handleAvatarChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		avatarPreview = URL.createObjectURL(file);
		toast.info('Avatar chosen — remember to save changes.');
	}

	function saveProfile() {
		// TODO: wire to backend
		avatarUrl = avatarPreview ?? avatarUrl;
		toast.success('Profile saved');
	}

	function saveKms() {
		toast.success('KMS configuration saved');
	}

	function saveSse() {
		toast.success('Encryption configuration saved');
	}

	function createKey() {
		toast.success('New KMS key created (demo)');
	}
</script>

<div class="space-y-6 p-6">
	<div class="mt-6 space-y-6">
		<!-- Profile Tab -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div class="space-y-6 lg:col-span-8">
				<Card.Root>
					<Card.Header class="space-y-3 pt-6 pb-3">
						<Card.Title class="text-lg font-semibold">Personal Information</Card.Title>
						<Card.Description class="text-sm text-muted-foreground"
							>Manage your public profile and private details.</Card.Description
						>
					</Card.Header>

					<Card.Content class="space-y-6">
						<!-- Avatar row -->
						<div class="flex items-center justify-between">
							<div>
								<Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
									>Avatar</Label
								>
								<p class="mt-1 text-sm text-muted-foreground">
									Your profile picture. Provided by Libravatar or upload a custom one.
								</p>
							</div>

							<div class="flex items-center gap-4">
								<div class="flex items-center gap-3">
									<Avatar.Root>
										{#if avatarPreview}
											<Avatar.Image src={avatarPreview} alt="avatar preview" />
										{:else if avatarUrl}
											<Avatar.Image src={avatarUrl} alt="avatar" />
										{:else}
											<Avatar.Fallback>UA</Avatar.Fallback>
										{/if}
									</Avatar.Root>

									<div class="flex flex-col">
										<label class="inline-flex cursor-pointer items-center gap-2">
											<input
												type="file"
												accept="image/*"
												class="sr-only"
												on:change={handleAvatarChange}
											/>
											<Button variant="secondary" size="sm">Upload</Button>
										</label>
										<Button size="sm" class="mt-2">Remove</Button>
									</div>
								</div>
							</div>
						</div>

						<Separator />

						<!-- Username -->
						<div class="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
							<div class="md:col-span-1">
								<Label>Username</Label>
								<p class="mt-1 text-sm text-muted-foreground">This is your public display name.</p>
							</div>
							<div class="md:col-span-2">
								<Input
									value={username}
									on:input={(e) => (username = (e.target as HTMLInputElement).value)}
								/>
							</div>
						</div>

						<!-- Email -->
						<div class="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
							<div class="md:col-span-1">
								<Label>Email Address</Label>
								<p class="mt-1 text-sm text-muted-foreground">Used for avatar and notifications.</p>
							</div>
							<div class="md:col-span-2">
								<Input
									type="email"
									value={email}
									on:input={(e) => (email = (e.target as HTMLInputElement).value)}
								/>
							</div>
						</div>

						<div class="flex justify-end">
							<Button class="mt-2" on:click={saveProfile}>Save Changes</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	</div>
</div>
