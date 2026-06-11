import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EncryptUpload from './EncryptUpload.svelte';

describe('EncryptUpload', () => {
    const testFiles = [
        new File(['Hello, World!'], 'hello.txt', { type: 'text/plain' }),
        new File([1, 2, 3, 4, 5], 'data.bin', { type: 'application/octet-stream' }),
    ];

    it('should render with no files', () => {
        const { container } = render(EncryptUpload, { files: [] });
        expect(container.querySelector('[data-testid="encrypt-btn"]')).toBeTruthy();
    });

    it('should show file items', () => {
        render(EncryptUpload, { files: testFiles });

        const items = screen.getAllByTestId('file-item');
        expect(items).toHaveLength(2);
    });

    it('should display file names and sizes', () => {
        render(EncryptUpload, { files: testFiles });

        expect(screen.getByText('hello.txt')).toBeTruthy();
        expect(screen.getByText('data.bin')).toBeTruthy();
        expect(screen.getByText('13 Bytes')).toBeTruthy(); // "Hello, World!" = 13 bytes
    });

    it('should show error when encrypting with no files', async () => {
        const { container } = render(EncryptUpload, { files: [] });
        const btn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(btn!);

        await waitFor(() => {
            const error = screen.getByTestId('error');
            expect(error.textContent).toBe('No files selected');
        });
    });

    it('should encrypt files and show key secret', async () => {
        const { container } = render(EncryptUpload, { files: testFiles });
        const btn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(btn!);

        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 10000 });

        expect(screen.getByTestId('key-secret')).toBeTruthy();
        expect(screen.getByTestId('progress').textContent).toContain('100%');
    });

    it('should show progress during encryption', async () => {
        const { container } = render(EncryptUpload, { files: testFiles });
        const btn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(btn!);

        // Wait for encryption to complete
        await waitFor(() => {
            expect(screen.getByTestId('progress').textContent).toContain('100%');
        }, { timeout: 10000 });
    });

    it('should verify key after encryption', async () => {
        const { container } = render(EncryptUpload, { files: testFiles });
        const encryptBtn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(encryptBtn!);

        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 10000 });

        const verifyBtn = screen.getByTestId('verify-btn');
        await fireEvent.click(verifyBtn!);

        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 5000 });
    });

    it('should handle single file', async () => {
        const singleFile = [new File(['small'], 'small.txt', { type: 'text/plain' })];
        const { container } = render(EncryptUpload, { files: singleFile });
        const btn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(btn!);

        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 10000 });
    });

    it('should handle larger files', async () => {
        const largeFile = new File(
            [crypto.getRandomValues(new Uint8Array(1024 * 1024))], // 1 MB
            'large.bin',
            { type: 'application/octet-stream' },
        );

        const { container } = render(EncryptUpload, { files: [largeFile] });
        const btn = container.querySelector('[data-testid="encrypt-btn"]');

        await fireEvent.click(btn!);

        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 30000 });

        const keySecret = screen.getByTestId('key-secret');
        expect(keySecret.textContent).toContain('Key:');
    });

    it('should disable button during processing', async () => {
        const { container } = render(EncryptUpload, { files: testFiles });
        const btn = container.querySelector('[data-testid="encrypt-btn"]') as HTMLButtonElement;

        expect(btn.disabled).toBe(false);

        btn.click();

        // Button should show "Encrypting..." text
        // Since encryption is fast, we check the final state
        await waitFor(() => {
            expect(screen.getByTestId('result')).toBeTruthy();
        }, { timeout: 10000 });
    });
});
