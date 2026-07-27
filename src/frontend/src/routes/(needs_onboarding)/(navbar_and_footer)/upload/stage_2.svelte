<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Switch from '$lib/components/ui/switch/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Kbd, KbdGroup } from '$lib/components/ui/kbd/index.js';
	import { useConfigQuery } from '#queries/config';
	import { Plus, ArrowLeft, X, FileIcon, Eye, EyeOff, Trash2, Upload } from '@lucide/svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { formatFileSize } from '#functions/bytes';
	import { formatSeconds } from '#functions/times';
	import { clipboardFiles, hasFileItems } from '#functions/file-tree';
	import { createZipStream, createEncryptedStream } from '#functions/streams';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { v7 as uuidv7 } from 'uuid';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { client } from '$lib/graphql/client.js';
	import { UPLOAD_FILE_MUTATION } from '$lib/graphql/queries.js';
	import { addHistoryEntry } from '$lib/database';
	import { toast } from 'svelte-sonner';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';

	let {
		files = $bindable(),
		onFilesUpdated,
		onUploadComplete,
		onBack,
		isDraggingOverZone,
		onZoneDragEnter,
		onZoneDragLeave
	}: {
		files: File[];
		onFilesUpdated: (files: File[]) => void;
		onUploadComplete: (r: { finalLink: string; viewOnceLink: string; isViewOnce: boolean }) => void;
		onBack: () => void;
		isDraggingOverZone: boolean;
		onZoneDragEnter: (e: DragEvent) => void;
		onZoneDragLeave: (e: DragEvent) => void;
	} = $props();

	const { config: configData } = useConfigQuery();
	let fileInput = $state<HTMLInputElement>();
	let downloadLimit = $state('1');
	let timeLimit = $state('86400');
	let isPasswordProtected = $state(false);
	let password = $state('');
	let showPassword = $state(false);
	let folderName = $state(uuidv7());
	let defaultsLoaded = $state(false);
	const fmtUnit = (val: number, unit: string) => (val === 1 ? unit.slice(0, -1) : unit);
	let inProgress = $state(false);
	let isEncrypting = $state(false);
	let uploadError = $state('');
	const newTween = () => new Tween(0, { duration: 500, easing: cubicOut });
	let encryptionProgress = $state(newTween());
	let uploadProgress = $state(newTween());
	const rawTotalSize = $derived(files.reduce((s, f) => s + f.size, 0));
	const totalSize = $derived(formatFileSize(rawTotalSize));
	const prog = $derived(isEncrypting ? encryptionProgress : uploadProgress);

	$effect(() => {
		if (files.length === 1) {
			folderName = files[0].name;
		} else if (!files.length) {
			folderName = uuidv7();
		}
	});

	$effect(() => {
		if (configData.data && !defaultsLoaded) {
			downloadLimit = configData.data.defaultNumberOfDownloads?.toString() ?? downloadLimit;
			timeLimit = configData.data.defaultExpiry?.toString() ?? timeLimit;
			defaultsLoaded = true;
		}
	});

	const addFiles = (newFiles: File[]) => {
		const newSize = newFiles.reduce((s, f) => s + f.size, 0);
		if (
			configData.data?.maxFileSizeLimit &&
			rawTotalSize + newSize > configData.data.maxFileSizeLimit
		) {
			toast.error(
				`Total file size cannot exceed ${formatFileSize(configData.data.maxFileSizeLimit)}`
			);
			return;
		}
		files = [...files, ...newFiles];
		onFilesUpdated(files);
	};

	const handleZoneDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onZoneDragLeave(e);
		if (e.dataTransfer?.items) {
			const newFiles = await clipboardFiles(e.dataTransfer.items);
			if (newFiles.length > 0) addFiles(newFiles);
		} else if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	};

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) addFiles(Array.from(target.files));
		target.value = '';
	};

	const removeFile = (file: File) => {
		files = files.filter((f) => f !== file);
		onFilesUpdated(files);
		if (!files.length) onBack();
	};

	const clearAll = () => {
		files = [];
		onFilesUpdated(files);
		onBack();
	};

	const handleUpload = async (viewOnce = false) => {
		if (!files.length || inProgress) return;
		if (viewOnce && files.length !== 1) {
			toast.error('View Once only supports a single file');
			return;
		}
		try {
			uploadError = '';
			inProgress = true;
			uploadProgress = newTween();
			const stream = await createZipStream(files, isPasswordProtected ? password : undefined);
			isEncrypting = true;
			encryptionProgress = newTween();
			const { stream: encryptedStream, keySecret } = await createEncryptedStream(
				stream,
				isPasswordProtected ? password : undefined,
				rawTotalSize,
				(processed, total) => {
					if (total && total > 0) {
						encryptionProgress.target = Math.min(100, Math.round((processed / total) * 100));
					} else {
						encryptionProgress = newTween();
					}
				}
			);
			const encryptedBlob = await new Response(encryptedStream).blob();
			isEncrypting = false;
			encryptionProgress.target = 100;

			const result = await client.mutate<any>({
				mutation: UPLOAD_FILE_MUTATION,
				variables: {
					file: encryptedBlob,
					filename: files.length === 1 ? files[0].name : folderName,
					expiresAt: parseInt(timeLimit),
					expireAfterNDownload: viewOnce ? 1 : parseInt(downloadLimit),
					numberOfFiles: files.length
				}
			});

			if (result.error) {
				throw new Error(result.error.message);
			}

			uploadProgress.target = 100;
			const data = result.data?.uploadFile;
			const serverPath = String(data?.id ?? data?.path ?? data?.key ?? '');
			if (!serverPath || serverPath === 'null' || serverPath === 'undefined')
				throw new Error('Invalid server response');
			const origin = window.location.origin;
			const downloadPath = `/download/${serverPath}#${keySecret}`;
			const finalLink = `${origin}${downloadPath}`;
			const viewOnceLink = viewOnce ? `${origin}/once/${serverPath}#${keySecret}` : '';

			addHistoryEntry({
				id: serverPath,
				name: files.length === 1 ? files[0].name : folderName,
				link: viewOnce ? viewOnceLink : finalLink,
				expiry: Temporal.Now.instant().epochMilliseconds + parseInt(timeLimit) * 1000,
				downloadLimit: viewOnce ? '1' : downloadLimit,
				createdAt: Temporal.Now.instant().epochMilliseconds,
				size: totalSize
			});
			onUploadComplete({ finalLink, viewOnceLink, isViewOnce: viewOnce });
			toast.success(viewOnce ? 'View Once link created' : 'Upload complete');
		} catch (err: any) {
			console.error('Upload failed', err);
			uploadError = err?.message ?? String(err);
			toast.error('Upload failed: ' + (err?.message ?? err));
		} finally {
			inProgress = false;
			isEncrypting = false;
			uploadProgress = newTween();
			encryptionProgress = newTween();
		}
	};

	const handlePaste = async (e: ClipboardEvent) => {
		const items = e.clipboardData?.items;
		if (!items || !hasFileItems(items)) return;
		e.preventDefault();
		const newFiles = await clipboardFiles(items);
		if (newFiles.length > 0) addFiles(newFiles);
	};
</script>

<svelte:window onpaste={handlePaste} />

{#snippet fileItem(file: File)}
	<div
		class="flex items-center justify-between border-b border-border py-2 first:pt-0 last:border-0"
	>
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
				<FileIcon class="h-4 w-4 text-primary" />
			</div>
			<div class="flex flex-col gap-0.5">
				<div class="text-sm leading-none font-medium">{file.name}</div>
				<div class="text-xs text-muted-foreground">
					{#if (file as any).relativePath}<span class="block max-w-50 truncate text-xs opacity-70"
							>{(file as any).relativePath}</span
						>{/if}
					{formatFileSize(file.size)}
				</div>
			</div>
		</div>
		<Button
			variant="ghost"
			onclick={() => removeFile(file)}
			class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			><X class="h-4 w-4" /></Button
		>
	</div>
{/snippet}

{#if inProgress}
	<div class="flex h-full w-full flex-col items-center justify-center p-8">
		<div class="relative mb-8 flex h-40 w-40 items-center justify-center">
			<div class="absolute inset-0 animate-pulse rounded-full bg-primary/5"></div>
			<div class="absolute inset-0 rounded-full border-4 border-muted/20"></div>
			<div class="absolute inset-0 flex items-center justify-center">
				<Spinner class="size-20 text-primary" aria-label="Encrypting and uploading" />
			</div>
			<div class="absolute inset-0 flex items-center justify-center">
				<Spinner class="size-16 text-primary/70" aria-label="Progress" />
			</div>
			<div class="relative z-10"><Upload class="h-12 w-12 text-primary drop-shadow-md" /></div>
		</div>
		<h3 class="mb-2 text-2xl font-semibold tracking-tight">Encrypting & Uploading...</h3>
		<p class="mb-8 text-muted-foreground">Please wait while we secure your files</p>
		<div class="w-full max-w-md space-y-3">
			<Progress value={prog.current} class="h-2" />
			<div class="flex justify-between text-xs font-medium text-muted-foreground">
				<span>{isEncrypting ? 'Encrypting ' : ''}{Math.round(prog.current)}%</span>
				<span>{totalSize}</span>
			</div>
		</div>
	</div>
{:else if files.length}
	<div class="flex h-full w-full flex-col pb-2">
		<div class="mb-2 flex items-center justify-between gap-2">
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						><Button variant="ghost" size="sm" class="mb-2" onclick={onBack}
							><ArrowLeft class="mr-2 h-4 w-4" />Back</Button
						></Tooltip.Trigger
					>
					<Tooltip.Content>Return to file selection (stage 1)</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
			<div class="flex items-center gap-2">
				{#if files.length > 1}<Input
						bind:value={folderName}
						class="h-8 w-48"
						placeholder="Folder Name"
					/>{/if}
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger
							class={`${buttonVariants({ variant: 'ghost' })} cursor-pointer`}
							onclick={clearAll}><Trash2 class="h-4 w-4" /></Tooltip.Trigger
						>
						<Tooltip.Content><p>Clear all files</p></Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>
		<ScrollArea
			class={[
				'mb-4 h-60 max-h-[45vh] w-full rounded-lg border border-border bg-card transition-colors lg:max-h-[50vh] lg:flex-1',
				isDraggingOverZone && 'bg-primary/5'
			]}
			ondragenter={onZoneDragEnter}
			ondragleave={onZoneDragLeave}
			ondragover={(e) => e.preventDefault()}
			ondrop={handleZoneDrop}
		>
			<div class="p-4">
				{#each files as file}{@render fileItem(file)}{/each}
			</div>
		</ScrollArea>
		<div class="mb-4 flex items-center">
			<button
				class="flex cursor-pointer items-center text-sm text-primary hover:underline"
				onclick={() => fileInput?.click()}
				><Plus class="mr-1 h-4 w-4" />Select files to upload</button
			>
			<KbdGroup class="ml-2">
				<Kbd>Ctrl</Kbd>
				<Kbd class="mx-0.5">+</Kbd>
				<Kbd>V</Kbd>
			</KbdGroup>
			<input
				bind:this={fileInput}
				type="file"
				class="hidden"
				multiple
				onchange={handleFileSelect}
			/>
			<div class="ml-auto text-sm text-muted-foreground">Total size: {totalSize}</div>
		</div>
		<div class="mb-4 space-y-2">
			<div class="flex items-center">
				<span class="text-sm">Expires after</span>
				<div class="ml-2 w-35">
					<Select.Root type="single" bind:value={downloadLimit}>
						<Select.Trigger
							>{downloadLimit} {fmtUnit(Number(downloadLimit), 'downloads')}</Select.Trigger
						>
						<Select.Content>
							{#if configData.data?.downloadConfigs}
								{#each configData.data.downloadConfigs as limit}
									<Select.Item value={limit.toString()}
										>{limit} {fmtUnit(limit, 'downloads')}</Select.Item
									>
								{/each}
							{:else}
								<Select.Item value="1">1 download</Select.Item>
							{/if}
						</Select.Content>
					</Select.Root>
				</div>
				<span class="mx-2 text-sm">or</span>
				<div class="w-35">
					<Select.Root type="single" bind:value={timeLimit}>
						<Select.Trigger
							>{@const { val, unit } = formatSeconds(parseInt(timeLimit))}{val}
							{fmtUnit(val, unit)}</Select.Trigger
						>
						<Select.Content>
							{#if configData.data?.timeConfigs}
								{#each configData.data.timeConfigs as time}
									{@const { val, unit } = formatSeconds(time)}
									<Select.Item value={time.toString()}>{val} {fmtUnit(val, unit)}</Select.Item>
								{/each}
							{:else}
								<Select.Item value="86400">1 Day</Select.Item>
							{/if}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			<div class="flex h-9 items-center gap-2">
				<div class="flex items-center gap-2">
					<Switch.Root bind:checked={isPasswordProtected} aria-label="Protect with password" />
					<span class="text-sm leading-none font-medium">Protect with password</span>
				</div>
				{#if isPasswordProtected}
					<div class="relative max-w-xs flex-1">
						<Input
							type={showPassword ? 'text' : 'password'}
							placeholder="Password"
							bind:value={password}
							class="h-9 pr-10"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1 right-3 text-muted-foreground hover:text-foreground"
						>
							{#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>
		<Button
			class="w-full cursor-pointer"
			onclick={() => handleUpload(false)}
			disabled={!files.length || inProgress}>Upload</Button
		>
		{#if files.length === 1}
			<Button
				variant="outline"
				class="w-full cursor-pointer"
				onclick={() => handleUpload(true)}
				disabled={inProgress}
			>
				<Eye class="mr-2 size-4" /> View Once
			</Button>
		{:else}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="outline" class="w-full" disabled>
							<Eye class="mr-2 size-4" /> View Once
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>View Once requires exactly one file</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
		{#if uploadError}
			<Alert.Root variant="destructive" class="mt-4">
				<Alert.Title>Upload failed</Alert.Title>
				<Alert.Description>{uploadError}</Alert.Description>
			</Alert.Root>
		{/if}
	</div>
{:else}
	<Empty.Root class="flex h-full w-full items-center justify-center">
		<Empty.Media><Upload class="h-8 w-8" /></Empty.Media>
		<Empty.Header>
			<Empty.Title class="text-sm">No files selected</Empty.Title>
		</Empty.Header>
	</Empty.Root>
{/if}
