import React from 'react';
import { ArrowLeft, FileText, ShieldCheck, UploadCloud } from 'lucide-react';

export interface FigmaScreenOption {
  id: string;
  label: string;
}

export interface FigmaWorkflowStep {
  id: string;
  label: string;
  matchIds?: string[];
}

export function FigmaPageHeader({
  overline = 'TICKEY / ORGANIZATION',
  title,
  screens,
  activeScreen,
  onSelectScreen,
  workflowSteps: _workflowSteps,
  hideDefaultStepBar: _hideDefaultStepBar = false,
}: {
  overline?: string;
  title: string;
  screens?: FigmaScreenOption[];
  activeScreen?: string;
  onSelectScreen?: (id: string) => void;
  workflowSteps?: FigmaWorkflowStep[];
  hideDefaultStepBar?: boolean;
}) {
  const rootScreen = screens && screens.length > 0 ? screens[0] : undefined;
  const isSubScreen = Boolean(rootScreen && activeScreen && activeScreen !== rootScreen.id);

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="tag-overline">{overline}</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              margin: '4px 0 0',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
        </div>

        {isSubScreen && rootScreen && onSelectScreen && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelectScreen(rootScreen.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              padding: '7px 14px',
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={14} />
            Quay lại {rootScreen.label.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

export function FigmaHeroBanner({
  variant = 'curtain',
  text = 'Không gian cho\nnhững trải nghiệm đáng nhớ.',
}: {
  variant?: 'curtain' | 'concert';
  text?: string;
}) {
  const bgUrl =
    variant === 'curtain'
      ? '/assets/f7ad36f342262321f71aa3b016819fcef14fcc90.jpg'
      : '/assets/9c7be2acbe8f7bdd910d9d1826c52f35aa38986e.jpg';

  return (
    <div
      style={{
        position: 'relative',
        height: 124,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#172A35',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
      }}
    >
      <img
        src={bgUrl}
        alt="Tickey Hero"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(16, 14, 13, 0.76) 0%, rgba(16, 14, 13, 0.35) 55%, rgba(16, 14, 13, 0.18) 100%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1.25,
          whiteSpace: 'pre-line',
          textShadow: '0 2px 10px rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function FigmaNavyContextBanner({
  title = 'Ánh Trăng Events',
  subtitle = 'Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý',
  badge = 'Đã ghi nhận',
  image,
}: {
  title?: string;
  subtitle?: string;
  badge?: string;
  image?: string | null;
}) {
  return (
    <div
      style={{
        background: '#172A35',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 14,
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {image ? (
          <img
            src={image}
            alt={title}
            style={{
              width: 86,
              height: 52,
              borderRadius: 8,
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: '#2A4354',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🎪
          </div>
        )}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{subtitle}</div>
        </div>
      </div>
      <span
        style={{
          background: '#FBF6EE',
          color: '#3A3028',
          fontSize: 11.5,
          fontWeight: 700,
          padding: '5px 12px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
        }}
      >
        {badge}
      </span>
    </div>
  );
}

export function FigmaContextGrid({
  items,
  columns = 2,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 12,
        marginBottom: 14,
      }}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function FigmaDocumentRow({
  title = 'Tài liệu hồ sơ',
  subtitle = 'Xem tài liệu theo quyền trước khi đưa ra quyết định',
  buttonLabel = 'Xem tài liệu',
  onView,
}: {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  onView?: () => void;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{subtitle}</div>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onView}>
        {buttonLabel}
      </button>
    </div>
  );
}

export function FigmaInfoAlert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'success' | 'danger';
  children: React.ReactNode;
}) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    info: { bg: '#EDF3FF', border: '#C9DCFF', color: '#1F4B99' },
    warning: { bg: '#FDF4E7', border: '#F5D6A7', color: '#8A4F08' },
    success: { bg: '#EAF7F0', border: '#B9E4CD', color: '#13653F' },
    danger: { bg: '#FDECEC', border: '#F5C2C2', color: '#9E2626' },
  };
  const st = styles[tone] || styles.info;
  return (
    <div
      style={{
        background: st.bg,
        border: `1px solid ${st.border}`,
        color: st.color,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12.5,
        fontWeight: 500,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

export function FigmaRecordInfoCard({
  title = 'Thông tin được ghi nhận',
  description = 'Kiểm tra dữ liệu trước khi gửi. Các thay đổi được lưu theo quyền của tài khoản.',
  badge = 'Theo quyền workspace',
  icon = 'file',
}: {
  title?: string;
  description?: string;
  badge?: string;
  icon?: 'file' | 'shield';
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: 230,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: '#FDF0EC',
          color: 'var(--brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        {icon === 'shield' ? <ShieldCheck size={22} /> : <FileText size={22} />}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15.5,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--muted)',
          lineHeight: 1.5,
          maxWidth: 260,
          marginBottom: 14,
        }}
      >
        {description}
      </div>
      <span
        style={{
          background: '#EDF3FF',
          color: '#1F4B99',
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: 999,
        }}
      >
        {badge}
      </span>
    </div>
  );
}

const SAMPLE_POSTERS = [
  { label: 'Acoustic', url: '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg' },
  { label: 'Concert', url: '/assets/2ba0a1dcc121100d3d8f109009a71fe5b0c24c83.jpg' },
  { label: 'EDM Fest', url: '/assets/3f342ec49c80bf8bf7c5c9152109747e1638fd36.jpg' },
  { label: 'Triển lãm', url: '/assets/548d1e4f2d839eceb38b120027ff7b991f6c8222.jpg' },
];

export function FigmaEventPreviewCard({
  title = 'Chưa đặt tên sự kiện',
  subtitle = 'Ban tổ chức',
  badge = 'Bản nháp',
  image,
  onImageChange,
}: {
  title?: string;
  subtitle?: string;
  badge?: string;
  image?: string | null;
  onImageChange?: (url: string) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG, WebP...)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onImageChange?.(result);
      }
    };
    reader.readAsDataURL(f);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      processFile(f);
    }
    e.target.value = '';
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 16,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {image ? (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <img
            src={image}
            alt={title}
            style={{
              width: '100%',
              height: 160,
              objectFit: 'cover',
              borderRadius: 10,
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'rgba(0,0,0,0.7)',
                color: '#FFFFFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              Đổi poster
            </button>
            <button
              type="button"
              onClick={() => onImageChange?.('')}
              style={{
                background: 'rgba(225,29,72,0.85)',
                color: '#FFFFFF',
                border: 'none',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              ✕ Xóa
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) processFile(dropped);
          }}
          style={{
            width: '100%',
            height: 160,
            border: isDragging ? '2px dashed var(--brand)' : '2px dashed var(--border)',
            borderRadius: 10,
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDragging ? '#FDF0EC' : '#FAF9F6',
            cursor: 'pointer',
            padding: 12,
            textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <UploadCloud size={24} style={{ color: isDragging ? 'var(--brand)' : 'var(--muted)', marginBottom: 6 }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
            Tải lên ảnh poster sự kiện
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Nhấp hoặc kéo thả ảnh vào đây · JPG, PNG, WebP
          </div>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 10.5, color: 'var(--muted)', width: '100%', marginBottom: 2 }}>
              Hoặc chọn mẫu:
            </span>
            {SAMPLE_POSTERS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onImageChange?.(p.url)}
                style={{
                  fontSize: 10.5,
                  padding: '2px 7px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>{subtitle}</div>
      <span
        style={{
          display: 'inline-block',
          background: '#EDF3FF',
          color: '#1F4B99',
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: 999,
        }}
      >
        {badge}
      </span>
    </div>
  );
}
