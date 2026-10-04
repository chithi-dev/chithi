/// <reference lib="webworker" />
import { NONCE_LENGTH } from '#consts/encryption';
import { base64url, base64urlToBytes, deriveKeys } from '#functions/encryption';

// ---------------------------------------------------------------------------
// Wire format (mirrors Mozilla Send's ECE layout):
//   [16-byte random salt][4-byte record size, BE]
//   [record_0][record_1]...
// Each record = AES-128-GCM(plaintext_chunk) with a per-record nonce derived
// as: nonceBase XOR (sequence_number in the last 4 bytes, BE).
// The file key itself is derived (HKDF) from the IKM + salt, so the salt must
// travel with the ciphertext. The IKM (or password) travels in the URL hash.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

type WorkerRequest =
	| { type: 'init'; ikmB64: string; passwordB64: string | null; op: 'encrypt' | 'decrypt' }
	| { type: 'chunk'; index: number; data: ArrayBuffer }
	| { type: 'final'; index: number };

interface WorkerResponse {
	type: 'ready' | 'chunk' | 'final' | 'error';
	index?: number;
	data?: ArrayBuffer;
	error?: string;
}

// Per-record nonce: nonceBase (12 bytes) with the sequence number XOR'd into
// the final 4 bytes, big-endian. Matches Mozilla Send's generateNonce().
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
			const ikm = msg.ikmB64 ? base64urlToBytes(msg.ikmB64) : null;
			const password = msg.passwordB64 ? new TextDecoder().decode(base64urlToBytes(msg.passwordB64)) : null;
			const resolvedIkM = password
				? new Uint8Array(
						await (
							crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
						).then(async (km) =>
							crypto.subtle.deriveBits(
								{ name: 'PBKDF2', salt: encoder.encode('chithi-salt-v2'), iterations: 100_000, hash: 'SHA-256' },
								km,
								128,
							),
						),
				  )
				: (ikm as Uint8Array);

			const { fileKey: fk } = await deriveKeys(resolvedIkM);
			fileKey = fk;
			// Deterministic nonceBase: SHA-256(fileKey) truncated to 12 bytes.
			// Both directions derive the same value from the same file key, so
			// encrypt and decrypt agree on every per-record nonce.
			const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', fk));
			const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', rawKey));
			nonceBase = digest.slice(0, NONCE_LENGTH);
			op = msg.op;
			post({ type: 'ready' } satisfies WorkerResponse);
		} catch (e: any) {
			post({ type: 'error', error: e?.message ?? String(e) } satisfies WorkerResponse);
		}
		return;
	}

	if (!fileKey || !nonceBase) return;

	if (msg.type === 'chunk' || msg.type === 'final') {
		try {
			const nonce = recordNonce(nonceBase, msg.index);
			const input = new Uint8Array(msg.data);
			let output: ArrayBuffer;
			if (op === 'encrypt') {
				const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, input);
				output = ct;
			} else {
				const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, input);
				output = pt;
			}
			post({ type: msg.type === 'final' ? 'final' : 'chunk', index: msg.index, data: output } satisfies WorkerResponse);
		} catch (e: any) {
			post({ type: 'error', error: e?.message ?? String(e) } satisfies WorkerResponse);
		}
	}

	function post(msg: WorkerResponse) {
		const data = msg.data;
		if (data) {
			(self as unknown as Worker).postMessage(msg, [data]);
		} else {
			(self as unknown as Worker).postMessage(msg);
		}
	}
});
