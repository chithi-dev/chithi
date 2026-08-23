async function traverse(item: FileSystemEntry, path = ''): Promise<File[]> {
  if (item.isFile) {
    return new Promise((resolve) => {
      (item as FileSystemFileEntry).file(
        (f) => { if (path) (f as any).relativePath = path + f.name; resolve([f]); },
        () => resolve([]),
      );
    });
  }
  if (item.isDirectory) {
    const reader = (item as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = [];
    const read = async () => {
      const result = await new Promise<FileSystemEntry[]>((rj, rej) => reader.readEntries(rj, rej));
      if (result.length) { entries.push(...result); await read(); }
    };
    await read();
    return (await Promise.all(entries.map((e) => traverse(e, path + item.name + '/')))).flat();
  }
  return [];
}

export { traverse as traverseFileTree };

export const hasFileItems = (items: DataTransferItemList) =>
  Array.from(items).some((i) => i.kind === 'file');

export const clipboardFiles = async (items: DataTransferItemList): Promise<File[]> => {
  const promises: Promise<File[]>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const entry = (item as any).webkitGetAsEntry;
    if (entry) promises.push(traverse(entry()));
    else { const f = item.getAsFile(); if (f) promises.push(Promise.resolve([f])); }
  }
  return (await Promise.all(promises)).flat();
};

export const dropFiles = async (items: DataTransferItemList): Promise<{ files: File[], folderName?: string }> => {
  const { files } = await processDataTransfer(Array.from(items));
  return { files, folderName: files[0] ? (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] : undefined };
};

export async function processDataTransfer(items: DataTransferItem[]): Promise<{ files: File[]; folderName?: string }> {
  const promises = items.map(async (item) => {
    const entry = (item as any).webkitGetAsEntry?.();
    if (entry) return traverse(entry);
    const file = item.kind === 'file' ? item.getAsFile?.() : null;
    return file ? [file] : [];
  });
  const files = (await Promise.all(promises)).flat();
  const folderEntry = items.find((i) => { const e = (i as any).webkitGetAsEntry?.(); return e?.isDirectory; });
  const folderName = folderEntry ? (folderEntry as any).webkitGetAsEntry().name : undefined;
  return { files, folderName };
}
