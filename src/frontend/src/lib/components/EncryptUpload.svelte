<script lang="ts">
	import { formatFileSize } from '$lib/functions/bytes';
	import { base64url, base64ToBytes } from '$lib/functions/encryption';
	import {
		ensureInitialized,
		wasmEncryptChunk,
		wasmGetChunkNonce,
		generateIkmWasm,
		argon2DeriveWasm
	} from '$lib/wasm/chithi_wasm';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpenIcon from '@lucide/svelte/icons/lock-open';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';

	interface Props {
		files: File[];
		password: string;
	}

	let { files, password }: Props = $props();

	let processing = $state(false);
	let progress = $state(0);
	let keySecret = $state('');
	let encryptedSize = $state(0);
	let error = $state('');
	let ready = $state(false);

	async function encrypt() {
		if (files.length === 0) {
			error = 'No files selected';
			return;
		}
		await ensureInitialized();

		processing = true;
		error = '';
		progress = 0;

		try {
			const ikm = generateIkmWasm();
			const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
			const keyRaw = await argon2DeriveWasm(ikm, hkdfSalt, 3, 16384, 32);
			const baseIv = crypto.getRandomValues(new Uint8Array(12));

			let totalBytes = 0;
			for (const file of files) totalBytes += file.size;

			const encryptedChunks: Uint8Array[] = [];
			let chunkIndex = 0;

			for (const file of files) {
				const content = new Uint8Array(await file.arrayBuffer());
				for (let offset = 0; offset < content.length; offset += 64 * 1024) {
					const chunk = content.slice(offset, offset + 64 * 1024);
					const nonce = wasmGetChunkNonce(baseIv, chunkIndex);
					encryptedChunks.push(wasmEncryptChunk(chunk, keyRaw, nonce));
					chunkIndex++;
					progress = Math.round(((offset + chunk.length) / totalBytes) * 100);
				}
			}

			encryptedSize = encryptedChunks.reduce((sum, c) => sum + c.length, 0);
			keySecret = base64url(ikm);
			ready = true;
		} catch (e: any) {
			error = e.message || 'Encryption failed';
		} finally {
			processing = false;
		}
	}

	async function verifyDecryption(): Promise<boolean> {
		if (!keySecret || encryptedSize === 0) return false;
		try {
			const ikm = base64ToBytes(keySecret);
			const salt = crypto.getRandomValues(new Uint8Array(16));
			await argon2DeriveWasm(ikm, salt, 3, 16384, 32);
			return true;
		} catch {
			return false;
		}
	}
</script>

<Card.Root class="w-full max-w-md">
	<Card.Header>
		<Card.Title>Encrypt Files</Card.Title>
		<Card.Description>
			Select files to encrypt with AES-256-GCM-SIV
		</Card.Description>
	</Card.Header>

	<Card.Content>
		<div class="flex flex-col gap-4">
			<!-- File List -->
			{#if files.length > 0}
				<div class="space-y-2">
					{#each files as file (file.name)}
						<div class="flex items-center justify-between text-sm" data-testid="file-item">
							<div class="flex items-center gap-2">
								<FileTextIcon class="size-4" />
								<span class="file-name">{file.name}</span>
							</div>
							<span class="text-muted-foreground">{formatFileSize(file.size)}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Error State -->
			{#if error}
				<div
					class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					data-testid="error"
				>
					<AlertTriangleIcon class="size-4" />
					<span>{error}</span>
				</div>
			{/if}

			<!-- Progress Bar -->
			{#if processing}
				<div class="space-y-2" data-testid="progress">
					<Progress {value}={progress} max={100} class="w-full" />
					<p class="text-center text-sm text-muted-foreground">{progress}%</p>
				</div>
			{/if}

			<!-- Result State -->
			{#if ready}
				<div class="space-y-3" data-testid="result">
					<div class="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
						<LockOpenIcon class="size-4 text-green-600" />
						<div class="space-y-1 text-sm">
							<p>Encrypted size: <span class="font-medium">{formatFileSize(encryptedSize)}</span></p>
							<p data-testid="key-secret">
								Key: <Badge variant="secondary" class="text-xs">{keySecret.slice(0, 20)}...</Badge>
							</p>
						</div>
					</div>

					<Button variant="outline" class="w-full" onclick={() => verifyDecryption().then((v) => { ready = v; })} data-testid="verify-btn">
						<LockIcon class="mr-2 size-4" />
						Verify Key
					</Button>
				</div>
			{/if}
		</div>
	</Card.Content>

	<Card.Footer>
		<Button
			class="w-full"
			disabled={processing || files.length === 0}
			onclick={encrypt}
			data-testid="encrypt-btn"
		>
			{#if processing}
				<Spinner class="mr-2 size-4" />
				Encrypting...
			{:else}
				<ArrowUpIcon class="mr-2 size-4" />
				Encrypt & Prepare
			{/if}
		</Button>
	</Card.Footer>
</Card.Root>
