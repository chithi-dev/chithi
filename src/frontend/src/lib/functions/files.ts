export async function traverseFileTree(item: FileSystemEntry, path = ''): Promise<File[]> {
	try {
		if ('isFile' in item && item.isFile) {
			return new Promise((resolve) => {
				(item as FileSystemFileEntry).file(
					(file: File) => {
						if (path) {
							(file as any).relativePath = path + file.name;
						}
						resolve([file]);
					},
					(err: Error) => {
						console.error('Error reading file:', err);
						resolve([]);
					}
				);
			});
		} else if ('isDirectory' in item && item.isDirectory) {
			const dirReader = (item as FileSystemDirectoryEntry).createReader();
			const entries: FileSystemEntry[] = [];

			const readEntries = async () => {
				try {
					const result = await new Promise<FileSystemEntry[]>((resolve, reject) => {
						dirReader.readEntries(resolve, reject);
					});

					if (result.length > 0) {
						entries.push(...result);
						await readEntries();
					}
				} catch (err) {
					console.error('Error reading directory:', err);
				}
			};

			await readEntries();

			const fileArrays = await Promise.all(
				entries.map((entry) => traverseFileTree(entry, path + item.name + '/'))
			);
			return fileArrays.flat();
		}
	} catch (err) {
		console.error('Error traversing item:', err);
	}
	return [];
}
