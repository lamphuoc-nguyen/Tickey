import { FileText, ShieldCheck, Download, CheckCircle2, X } from 'lucide-react';

export interface DocumentPreviewItem {
  title: string;
  code?: string;
  issuer?: string;
  date?: string;
  fileName?: string;
  fileSize?: string;
  statusLabel?: string;
  summary?: string;
  fields?: Array<{ label: string; value: string }>;
}

interface DocumentPreviewModalProps {
  doc?: DocumentPreviewItem | null;
  isOpen?: boolean;
  title?: string;
  organization?: string;
  status?: string;
  onClose: () => void;
}

/**
 * Shared Figma Frame: 34:6978 | w-document-preview / Xem tài liệu
 * Section 05 / DÙNG CHUNG · Hộp thoại tài liệu
 */
export function DocumentPreviewModal({
  doc,
  isOpen,
  title,
  organization,
  status,
  onClose,
}: DocumentPreviewModalProps) {
  const effectiveDoc: DocumentPreviewItem | null =
    doc ??
    (isOpen && title
      ? {
          title,
          fileName: title,
          issuer: organization || 'Ánh Trăng Events',
          statusLabel: status || 'Đã kiểm tra chữ ký số',
        }
      : null);

  if (!effectiveDoc) return null;

  const fields = effectiveDoc.fields ?? [
    { label: 'Đơn vị nộp hồ sơ', value: effectiveDoc.issuer || 'Công ty TNHH Nghệ Thuật Ánh Trăng' },
    { label: 'Mã tài liệu / Hồ sơ', value: effectiveDoc.code || 'DOC-2026-1024' },
    { label: 'Ngày tải lên', value: effectiveDoc.date || '21/10/2026 · 09:30' },
    {
      label: 'Định dạng & Dung lượng',
      value: `${effectiveDoc.fileName || 'ho-so-phap-ly-xac-minh.pdf'} · ${effectiveDoc.fileSize || '2.4 MB'}`,
    },
  ];

  const handleDownloadDocument = () => {
    const content = [
      '=== BẢN SAO HỒ SƠ ĐIỆN TỬ TICKEY VAULT ===',
      `Tiêu đề: ${effectiveDoc.title}`,
      `Trạng thái: ${effectiveDoc.statusLabel || 'Đã kiểm tra chữ ký số SHA-256'}`,
      '',
      ...fields.map((f) => `${f.label}: ${f.value}`),
      '',
      `Tóm tắt: ${effectiveDoc.summary || 'Tài liệu phục vụ quy trình kiểm duyệt pháp lý, đối soát tài chính hoặc xác minh địa điểm.'}`,
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = (effectiveDoc.fileName || effectiveDoc.code || 'tai-lieu-tickey').replace(
      /\.[^.]+$/,
      '',
    );
    link.download = `${baseName}-tickey-vault.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(23, 42, 53, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-alt)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-tint)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="tag-overline" style={{ marginBottom: 0 }}>
                  05 / DÙNG CHUNG · w-document-preview
                </span>
                <span
                  className="badge badge-success"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  {effectiveDoc.statusLabel || 'Đã kiểm tra chữ ký số'}
                </span>
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>
                Xem tài liệu · {effectiveDoc.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '8px', borderRadius: '50%' }}
            aria-label="Đóng tài liệu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  BẢN SAO HỒ SƠ ĐIỆN TỬ · TICKEY VAULT
                </div>
                <h4 style={{ margin: '4px 0 6px', fontSize: '16px' }}>{effectiveDoc.title}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                  {effectiveDoc.summary ||
                    'Xem tài liệu theo quyền trước khi đưa ra quyết định. Thao tác xem được ghi nhận tự động vào lịch sử hệ thống.'}
                </p>
              </div>
              <span className="badge badge-info" style={{ flexShrink: 0 }}>
                <ShieldCheck size={14} /> Toàn vẹn SHA-256
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              {fields.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{f.label}</div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginTop: '2px',
                    }}
                  >
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--success)',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={15} /> Đã đối chiếu thông tin pháp nhân và phạm vi quyền hạn
                </span>
                <span style={{ color: 'var(--muted)' }}>Trang 1 / 3</span>
              </div>
              <div
                style={{
                  height: '8px',
                  width: '80%',
                  backgroundColor: 'var(--surface-alt)',
                  borderRadius: '4px',
                  marginBottom: '6px',
                }}
              />
              <div
                style={{
                  height: '8px',
                  width: '95%',
                  backgroundColor: 'var(--surface-alt)',
                  borderRadius: '4px',
                  marginBottom: '6px',
                }}
              />
              <div
                style={{
                  height: '8px',
                  width: '62%',
                  backgroundColor: 'var(--surface-alt)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Truy cập tài liệu được lưu theo quyền của tài khoản.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleDownloadDocument}
                className="btn btn-outline"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                <Download size={15} /> Tải bản hồ sơ
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontSize: '13px' }}
              >
                Đóng tài liệu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
