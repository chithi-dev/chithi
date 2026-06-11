import { describe, it, expect } from 'vitest';
import { formatBytes, formatFileSize, bytesToNumber, B_VALS } from './bytes';

describe('formatBytes', () => {
    it('should return 0 MB for zero bytes', () => {
        expect(formatBytes(0)).toEqual({ val: 0, unit: 'MB' });
    });

    it('should format bytes', () => {
        const result = formatBytes(500);
        expect(result.unit).toBe('Bytes');
        expect(result.val).toBe(500);
    });

    it('should format kilobytes', () => {
        const result = formatBytes(1536); // 1.5 KB
        expect(result.unit).toBe('KB');
        expect(result.val).toBe(1.5);
    });

    it('should format megabytes', () => {
        const result = formatBytes(1572864); // 1.5 MB
        expect(result.unit).toBe('MB');
        expect(result.val).toBe(1.5);
    });

    it('should format gigabytes', () => {
        const result = formatBytes(1610612736); // 1.5 GB
        expect(result.unit).toBe('GB');
        expect(result.val).toBe(1.5);
    });

    it('should format terabytes', () => {
        const result = formatBytes(1649267441664); // 1.5 TB
        expect(result.unit).toBe('TB');
        expect(result.val).toBe(1.5);
    });
});

describe('formatFileSize', () => {
    it('should return "0 Bytes" for zero', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format with unit name', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format partial units', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format large files', () => {
        const result = formatFileSize(2147483648); // 2 GB
        expect(result).toBe('2 GB');
    });
});

describe('bytesToNumber', () => {
    it('should convert KB to bytes', () => {
        expect(bytesToNumber(1, 'KB')).toBe(1024);
    });

    it('should convert MB to bytes', () => {
        expect(bytesToNumber(1, 'MB')).toBe(1048576);
    });

    it('should convert GB to bytes', () => {
        expect(bytesToNumber(1, 'GB')).toBe(1073741824);
    });

    it('should handle fractional values', () => {
        const result = bytesToNumber(1.5, 'MB');
        expect(result).toBe(1572864);
    });

    it('should floor the result', () => {
        const result = bytesToNumber(1.999, 'KB');
        expect(result).toBe(2046); // 1.999 * 1024 = 2046.976, floored to 2046
    });
});
