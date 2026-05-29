export async function traverseFileTree(item: FileSystemEntry, path = ''): Promise<File[]> {
	try {
		if ('isFile' in item && item.isFile) {
			return new Promise<File[]>((resolve) => {
				(item as FileSystemFileEntry).file((file) => {
					if (path) (file as any).relativePath = `${path}${file.name}`;
					resolve([file]);
				}, () => resolve([]));
			});
		}
		if ('isDirectory' in item && item.isDirectory) {
			const dirReader = (item as FileSystemDirectoryEntry).createReader();
			const entries: FileSystemEntry[] = [];
			const read = async () => {
				const result = await new Promise<FileSystemEntry[]>((resolve, reject) => dirReader.readEntries(resolve, reject));
				if (result.length) { entries.push(...result); await read(); }
			};
			await read();
			return (await Promise.all(entries.map(e => traverseFileTree(e, `${path}${item.name}/`)))).flat();
		}
	} catch (err) { console.error('Error traversing item:', err); }
	return [];
}

export async function processDataTransferItems(items: DataTransferItem[]): Promise<File[]> {
	const promises = Array.from(items).map((item) => {
		const entry = (item as any).webkitGetAsEntry?.();
		return entry
			? traverseFileTree(entry)
			: item.kind === 'file'
				? Promise.resolve([(item.getAsFile() as File)])
				: Promise.resolve<File[]>([]);
	});
	return (await Promise.all(promises)).flat().filter(Boolean) as File[];
}
