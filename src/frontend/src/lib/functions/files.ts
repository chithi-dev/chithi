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
		return (await Promise.all(entries.map((e) => traverseFileTree(e, path + item.name + '/'))))
			.flat();
	}

	return [];
}

export async function processDataTransferItems(items: DataTransferItem[]): Promise<File[]> {
	const promises = Array.from(items).map((item) => {
		const entry = (item as any).webkitGetAsEntry?.();
		if (entry) return traverseFileTree(entry);
		if (item.kind === 'file') return [item.getAsFile() as File];
		return [];
	});
	return (await Promise.all(promises)).flat().filter(Boolean) as File[];
}
