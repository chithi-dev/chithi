export async function traverseFileTree(item: FileSystemEntry, path = ''): Promise<File[]> {
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

export async function processDataTransferItems(items: DataTransferItem[]): Promise<File[]> {
	const { files } = await processDataTransfer(items);
	return files;
}

export async function processDataTransfer(items: DataTransferItem[]): Promise<{ files: File[]; folderName?: string }> {
	const promises = [...items].map(async (item) => {
		const entry = (item as any).webkitGetAsEntry?.();
		if (entry) return traverseFileTree(entry);
		const file = item.kind === 'file' ? item.getAsFile?.() : null;
		return file ? [file] : [];
	});
	const fileArrays = await Promise.all(promises);
	const files = fileArrays.flat();

	let folderName: string | undefined;
	for (const item of items) {
		const entry = (item as any).webkitGetAsEntry?.();
		if (entry?.isDirectory) {
			folderName = entry.name;
			break;
		}
	}

	return { files, folderName };
}
