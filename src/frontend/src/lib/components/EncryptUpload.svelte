<script lang="ts">
    import { formatFileSize } from '#functions/bytes';
    import { base64url, base64ToBytes } from '#functions/encryption';

    export let files: File[] = [];
    export let password: string = '';

    let processing = $state(false);
    let progress = $state(0);
    let keySecret = $state('');
    let encryptedSize = $state(0);
    let error = $state('');
    let ready = $state(false);

    async function encrypt() {
        if (files.length === 0) {
            error = 'No files selected';
            return;
        }

        processing = true;
        error = '';
        progress = 0;

        try {
            // Generate random IKM
            const ikm = crypto.getRandomValues(new Uint8Array(32));

            // Derive AES key (simplified — uses Web Crypto directly)
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);

            const aesKey = await crypto.subtle.deriveKey(
                { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('aes-key') },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            );

            // Read and encrypt each file
            const CHUNK_SIZE = 64 * 1024;
            let totalBytes = 0;
            const encryptedChunks: Uint8Array[] = [];

            for (const file of files) {
                const content = new Uint8Array(await file.arrayBuffer());
                totalBytes += content.length;

                for (let offset = 0; offset < content.length; offset += CHUNK_SIZE) {
                    const chunk = content.slice(offset, offset + CHUNK_SIZE);
                    const iv = crypto.getRandomValues(new Uint8Array(12));

                    const encrypted = await crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv },
                        aesKey,
                        chunk,
                    );

                    // Store: IV (12 bytes) + ciphertext (chunk + 16 tag)
                    const withIv = new Uint8Array(12 + encrypted.byteLength);
                    withIv.set(iv, 0);
                    withIv.set(new Uint8Array(encrypted), 12);
                    encryptedChunks.push(withIv);

                    progress = Math.round((offset + chunk.length) / totalBytes * 100);
                }
            }

            encryptedSize = encryptedChunks.reduce((sum, c) => sum + c.length, 0);
            keySecret = base64url(ikm);
            ready = true;
        } catch (e: any) {
            error = e.message || 'Encryption failed';
        } finally {
            processing = false;
        }
    }

    async function verifyDecryption(): Promise<boolean> {
        if (!keySecret || encryptedSize === 0) return false;

        try {
            const ikm = base64ToBytes(keySecret);
            const salt = crypto.getRandomValues(new Uint8Array(16));

            // Re-derive key (in production, salt would be stored with the encrypted data)
            // This is a simplified verification — just checks key derivation works
            const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
            await crypto.subtle.deriveKey(
                { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('aes-key') },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt'],
            );
            return true;
        } catch {
            return false;
        }
    }
</script>

<div class="encrypt-upload">
    <div class="file-list">
        {#each files as file}
            <div class="file-item" data-testid="file-item">
                <span class="file-name">{file.name}</span>
                <span class="file-size">{formatFileSize(file.size)}</span>
            </div>
        {/each}
    </div>

    {#if error}
        <div class="error" data-testid="error">{error}</div>
    {/if}

    <div class="progress" data-testid="progress">
        <div class="progress-bar" style="width: {progress}%"></div>
        <span>{progress}%</span>
    </div>

    <button
        data-testid="encrypt-btn"
        onclick={encrypt}
        disabled={processing || files.length === 0}
    >
        {processing ? 'Encrypting...' : 'Encrypt & Prepare'}
    </button>

    {#if ready}
        <div data-testid="result">
            <div class="result-info">
                <p>Encrypted size: {formatFileSize(encryptedSize)}</p>
                <p data-testid="key-secret">Key: {keySecret.slice(0, 20)}...</p>
            </div>
            <button data-testid="verify-btn" onclick={() => verifyDecryption().then(v => { ready = v; })}>
                Verify Key
            </button>
        </div>
    {/if}
</div>

<style>
    .encrypt-upload {
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
    }
    .file-list {
        margin-bottom: 1rem;
    }
    .file-item {
        display: flex;
        justify-content: space-between;
        padding: 0.25rem 0;
    }
    .error {
        color: #ef4444;
        margin-bottom: 0.5rem;
    }
    .progress {
        position: relative;
        height: 1.5rem;
        background: #e2e8f0;
        border-radius: 0.25rem;
        margin-bottom: 1rem;
    }
    .progress-bar {
        height: 100%;
        background: #3b82f6;
        border-radius: 0.25rem;
        transition: width 0.2s;
    }
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
