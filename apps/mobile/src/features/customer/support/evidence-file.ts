import type { DocumentPickerAsset } from 'expo-document-picker';

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export function evidenceMimeType(asset: Pick<DocumentPickerAsset, 'name' | 'mimeType'>): string {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const extension = asset.name.split('.').at(-1)?.toLowerCase();
  return (
    (
      {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        pdf: 'application/pdf',
      } as Record<string, string>
    )[extension ?? ''] ?? ''
  );
}

export function isEvidenceImage(asset: Pick<DocumentPickerAsset, 'name' | 'mimeType'>): boolean {
  return evidenceMimeType(asset).startsWith('image/') && supported.has(evidenceMimeType(asset));
}

export class EvidenceValidationError extends Error {}

/** Same file types and per-file size as the upload contract; no invented attachment-count limit. */
export function validateEvidence(
  assets: readonly Pick<DocumentPickerAsset, 'name' | 'mimeType' | 'size'>[],
): void {
  for (const asset of assets) {
    if (!supported.has(evidenceMimeType(asset)))
      throw new EvidenceValidationError('Chọn ảnh JPG, PNG, WEBP hoặc tài liệu PDF.');
    if (asset.size !== undefined && (!Number.isFinite(asset.size) || asset.size < 0))
      throw new EvidenceValidationError('Chưa thể đọc thông tin tệp. Vui lòng chọn lại.');
    if (asset.size === 0) throw new EvidenceValidationError('Tệp đang trống. Vui lòng chọn tệp khác.');
    if ((asset.size ?? 0) > EVIDENCE_MAX_BYTES)
      throw new EvidenceValidationError('Mỗi tệp tối đa 10 MB. Vui lòng chọn tệp nhỏ hơn.');
  }
}

export function evidenceSize(size?: number): string {
  if (size === undefined || !Number.isFinite(size) || size < 0) return 'Chưa rõ kích thước';
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
    : `${Math.ceil(size / 1024)} KB`;
}
