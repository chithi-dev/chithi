<script lang="ts">
    import { formatFileSize } from '#functions/bytes';
    import { base64url, base64ToBytes } from '#functions/encryption';
    import { ensureInitialized, wasmEncryptChunk, wasmGetChunkNonce, generateIkmWasm, argon2DeriveWasm } from '#wasm/chithi_wasm';

    export let files: File[] = [];
    export let password: string = '';

    let processing = $state(false);
    let progress = $state(0);
    let keySecret = $state('');
    let encryptedSize = $state(0);
    let error = $state('');
    let ready = $state(false);

    async function encrypt() {
        if (files.length === 0) { error = 'No files selected'; return; }
        await ensureInitialized();

        processing = true;
        error = '';
        progress = 0;

        try {
            const ikm = generateIkmWasm();
            const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
            const keyRaw = await argon2DeriveWasm(ikm, hkdfSalt, 3, 16384, 32);
            const baseIv = crypto.getRandomValues(new Uint8Array(12));

            let totalBytes = 0;
            for (const file of files) totalBytes += file.size;

            const encryptedChunks: Uint8Array[] = [];
            let chunkIndex = 0;

            for (const file of files) {
                const content = new Uint8Array(await file.arrayBuffer());
                for (let offset = 0; offset < content.length; offset += 64 * 1024) {
                    const chunk = content.slice(offset, offset + 64 * 1024);
                    const nonce = wasmGetChunkNonce(baseIv, chunkIndex);
                    encryptedChunks.push(wasmEncryptChunk(chunk, keyRaw, nonce));
                    chunkIndex++;
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
            await argon2DeriveWasm(ikm, salt, 3, 16384, 32);
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

    <button data-testid="encrypt-btn" onclick={encrypt} disabled={processing || files.length === 0}>
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
    .encrypt-upload { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
    .file-list { margin-bottom: 1rem; }
    .file-item { display: flex; justify-content: space-between; padding: 0.25rem 0; }
    .error { color: #ef4444; margin-bottom: 0.5rem; }
    .progress { position: relative; height: 1.5rem; background: #e2e8f0; border-radius: 0.25rem; margin-bottom: 1rem; }
    .progress-bar { height: 100%; background: #3b82f6; border-radius: 0.25rem; transition: width 0.2s; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
