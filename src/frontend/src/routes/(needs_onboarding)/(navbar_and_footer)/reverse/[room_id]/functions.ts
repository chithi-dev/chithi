import type { ReceiveState } from './types';

export const get_display_filename = (filename: string) =>
	filename.endsWith('.zip') ? filename.slice(0, -4) : filename;

export async function handle_binary_chunk({
	receive_state,
	data
}: {
	receive_state: ReceiveState;
	data: ArrayBuffer | Blob;
}) {
	if (receive_state.type !== 'streaming') return;
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;

	if (receive_state.size > 0 && receive_state.received >= receive_state.size) return;

	receive_state.chunks.push(buf as BlobPart);
	receive_state.received += buf.byteLength;
}
