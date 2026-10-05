/// <reference lib="webworker" />
import { NONCE_LENGTH } from '#consts/encryption';
import { base64urlToBytes, deriveFileKey } from '#functions/encryption';

// ---------------------------------------------------------------------------
// Wire format v3 (mirrors the Python CLI in src/cli/app/helpers/crypto.py):
//   [16-byte random salt][1-byte version][4-byte record size, BE]
//   [record_0][record_1]...
// Each record = AES-256-GCM(plaintext_chunk) with a per-record nonce derived
// as nonceBase XOR (sequence_number in the last 4 bytes, BE).
// The file key is HKDF(IKM, salt=header_salt). The IKM is resolved by
// streams.ts (Argon2id of the password, or the raw secret) and passed in.
// ---------------------------------------------------------------------------

type WorkerRequest =
	| { type: 'init'; ikmB64: string; saltB64: string; op: 'encrypt' | 'decrypt' }
	| { type: 'chunk'; index: number; data: ArrayBuffer }
	| { type: 'final'; index: number; data: ArrayBuffer };

interface WorkerResponse {
	type: 'ready' | 'chunk' | 'final' | 'error';
	index?: number;
	data?: ArrayBuffer;
	error?: string;
}

// Per-record nonce: nonceBase (12 bytes) with the sequence number XOR'd into
// the final 4 bytes, big-endian. Matches the CLI's record_nonce().
function recordNonce(nonceBase: Uint8Array, seq: number): Uint8Array {
	const nonce = new Uint8Array(nonceBase);
	const view = new DataView(nonce.buffer, nonce.byteOffset + nonce.byteLength - 4);
	view.setUint32(0, view.getUint32(0) ^ (seq >>> 0));
	return nonce;
}

let fileKey: CryptoKey | null = null;
let nonceBase: Uint8Array | null = null;
let op: 'encrypt' | 'decrypt' = 'encrypt';

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
	const msg = event.data;

	if (msg.type === 'init') {
		try {
			const ikm = base64urlToBytes(msg.ikmB64);
			const salt = base64urlToBytes(msg.saltB64);
			fileKey = await deriveFileKey(ikm, salt);

			// Deterministic nonceBase: SHA-256(raw file key) truncated to 12 bytes.
			// Both directions derive the same value from the same key, so encrypt
			// and decrypt agree on every per-record nonce.
			const raw = new Uint8Array(await crypto.subtle.exportKey('raw', fileKey));
			const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
			nonceBase = digest.slice(0, NONCE_LENGTH);
			op = msg.op;
			post({ type: 'ready' } satisfies WorkerResponse);
		} catch (e: unknown) {
			post({ type: 'error', error: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
		}
		return;
	}

	if (!fileKey || !nonceBase) return;

	if (msg.type !== 'chunk' && msg.type !== 'final') return;

	{
		try {
			const nonce = recordNonce(nonceBase, msg.index).slice().buffer;
			const data = msg.data;
			const output =
				op === 'encrypt'
					? await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, data)
					: await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, data);
			post({ type: msg.type, index: msg.index, data: output } satisfies WorkerResponse);
		} catch (e: unknown) {
			post({ type: 'error', error: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
		}
	}

	function post(msg: WorkerResponse) {
		if (msg.data) {
			(self as unknown as Worker).postMessage(msg, [msg.data]);
		} else {
			(self as unknown as Worker).postMessage(msg);
		}
	}
});
