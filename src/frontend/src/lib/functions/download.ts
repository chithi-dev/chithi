import { autoDownload } from '#functions/browser-download';
import { fetchDecryptedBlob } from '#functions/fetch-decrypt';
import { validateZipBlob } from '#functions/zip-validate';

export async function downloadAndDecryptFile(slug: string, key: string, password: string, filename: string, fileSize: number, _numberOfFiles: number, onProgress: (p: number) => void) {
  const blob = await fetchDecryptedBlob(slug, key, password, { knownSize: fileSize, onProgress });
  await validateZipBlob(blob);

  const downloadName = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;

  if ((window as any).showSaveFilePicker) {
    const handle = await (window as any).showSaveFilePicker({ suggestedName: downloadName });
    await blob.stream().pipeTo(await handle.createWritable());
  } else {
    const url = URL.createObjectURL(blob);
    autoDownload(url, downloadName);
    URL.revokeObjectURL(url);
  }
}
