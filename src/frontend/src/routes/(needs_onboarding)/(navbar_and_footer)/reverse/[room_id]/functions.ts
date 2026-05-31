import type { ReceiveState } from './types';

/**
 * Strips .zip extension if present
 */
export const getDisplayFilename = (filename: string) =>
	filename.endsWith('.zip') ? filename.slice(0, -4) : filename;

/**
 * Handles incoming binary chunks for a streaming file transfer.
 * Mutates the receiveState object if it is in 'streaming' mode.
 */
export async function handleBinaryChunk(
	receiveState: ReceiveState,
	data: ArrayBuffer | Blob
): Promise<void> {
	if (receiveState.type !== 'streaming') return;
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;

	// If we've already received the full file, ignore subsequent chunks (e.g. from duplicate host streams)
	if (receiveState.size > 0 && receiveState.received >= receiveState.size) {
		return;
	}

	receiveState.chunks.push(buf as any);
	receiveState.received += buf.byteLength;
}
