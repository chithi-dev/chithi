async function _traverseFileTree(item: FileSystemEntry, path: string): Promise<File[]> {
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
		return (await Promise.all(entries.map((e) => _traverseFileTree(e, path + item.name + '/')))).flat();
	}
	return [];
}

export const traverseFileTree = (item: FileSystemEntry, path = '') => _traverseFileTree(item, path);

export const clipboardFiles = async (items: DataTransferItemList): Promise<File[]> => {
	const promises: Promise<File[]>[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.kind !== 'file') continue;
		const entry = (item as any).webkitGetAsEntry;
		if (entry) promises.push(traverseFileTree(entry()));
		else {
			const f = item.getAsFile();
			if (f) promises.push(Promise.resolve([f]));
		}
	}
	return (await Promise.all(promises)).flat();
};

export const hasFileItems = (items: DataTransferItemList) =>
	Array.from(items).some((i) => i.kind === 'file');

export const dropFiles = async (items: DataTransferItemList): Promise<{ files: File[], folderName?: string }> => {
	const promises: Promise<File[]>[] = [];
	let folderName: string | undefined;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.kind !== 'file') continue;
		const entry = (item as any).webkitGetAsEntry;
		if (entry) {
			const e = entry();
			promises.push(traverseFileTree(e));
			if (e.isDirectory && !folderName) folderName = e.name;
		}
	}
	return { files: (await Promise.all(promises)).flat(), folderName };
};
