<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus } from '@lucide/svelte';
	import { formatFileSize } from '#functions/bytes';
	async function traverseFileTree(item: FileSystemEntry, path = ''): Promise<File[]> {
		if (item.isFile) {
			return new Promise((resolve) => {
				(item as FileSystemFileEntry).file(
					(file: File) => {
						if (path) (file as any).relativePath = path + file.name;
						resolve([file]);
					},
					() => resolve([])
				);
			});
		}
		if (item.isDirectory) {
			const reader = (item as FileSystemDirectoryEntry).createReader();
			const entries: FileSystemEntry[] = [];
			const read = async () => {
				const result = await new Promise<FileSystemEntry[]>((resolve, reject) =>
					reader.readEntries(resolve, reject)
				);
				if (result.length) {
					entries.push(...result);
					await read();
				}
			};
			await read();
			return (
				await Promise.all(entries.map((e) => traverseFileTree(e, path + item.name + '/')))
			).flat();
		}
		return [];
	}

	function handleDrop(e: DropEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!e.dataTransfer) return;
		const dtFiles = Array.from(e.dataTransfer.files || []);
		if (dtFiles.length > 0) {
			onFilesSelected(dtFiles);
			return;
		}
		const items = e.dataTransfer.items;
		if (!items) return;
		const promises: Array<Promise<Array<File>>> = [];
		let folderName: string | undefined;
		for (let i = 0; i < items.length; i++) {
			const entry = (items[i] as any).webkitGetAsEntry?.();
			if (entry) {
				promises.push(traverseFileTree(entry));
				if (entry.isDirectory && !folderName) folderName = entry.name;
			}
		}
		if (promises.length) {
			promises.flat().then((files) => {
				if (files.length > 0) {
					onFilesSelected(files as File[], folderName);
				}
			});
		}
	}