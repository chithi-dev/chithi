import { sha256 } from 'hash-wasm';

/** Browser only Implementation
    export async function hashSHA256(message: string) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
*/

export { sha256 as hashSHA256 };
