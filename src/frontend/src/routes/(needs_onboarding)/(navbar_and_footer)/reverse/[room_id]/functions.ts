import type { ReceiveState } from './types';

export const getDisplayFilename = (f: string) => f.endsWith('.zip') ? f.slice(0, -4) : f;

export async function handleBinaryChunk(state: ReceiveState, data: ArrayBuffer | Blob): Promise<void> {
  if (state.type !== 'streaming') return;
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  if (state.size > 0 && state.received >= state.size) return;
  state.chunks.push(new Uint8Array(buf));
  state.received += buf.byteLength;
}
