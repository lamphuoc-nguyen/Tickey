import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_MAX_BYTES,
  EvidenceValidationError,
  evidenceSize,
  isEvidenceImage,
  validateEvidence,
} from './evidence-file';

describe('evidence before an upload', () => {
  it('accepts the contract file types at the exact size limit', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
      expect(() => validateEvidence([{ name: 'file', mimeType, size: EVIDENCE_MAX_BYTES }])).not.toThrow();
  });
  it('rejects oversized and unsupported files with user-facing local errors', () => {
    expect(() => validateEvidence([{ name: 'empty.pdf', size: 0 }])).toThrow('Tệp đang trống');
    expect(() => validateEvidence([{ name: 'photo.jpg', size: EVIDENCE_MAX_BYTES + 1 }])).toThrow(
      EvidenceValidationError,
    );
    expect(() => validateEvidence([{ name: 'document.pdf', mimeType: 'application/zip' }])).toThrow(
      'Chọn ảnh',
    );
    expect(() => validateEvidence([{ name: 'image.svg' }])).toThrow(EvidenceValidationError);
  });
  it('distinguishes image previews from PDF and keeps unknown sizes honest', () => {
    expect(isEvidenceImage({ name: 'IMAGE.PNG' })).toBe(true);
    expect(isEvidenceImage({ name: 'photo.jpg', mimeType: 'application/pdf' })).toBe(false);
    expect(evidenceSize()).toBe('Chưa rõ kích thước');
    expect(evidenceSize(1024)).toBe('1 KB');
    expect(() => validateEvidence([{ name: 'file.pdf' }])).not.toThrow();
  });
});
