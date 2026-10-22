import { useState, type ReactNode } from 'react';

interface ConfirmButtonProps {
  /** Label of the first button; clicking it only opens the confirmation. */
  children: ReactNode;
  /** What will happen, shown above the confirm / cancel pair. */
  message: ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}

/** A decision button that asks once more inline before it runs (review approvals, rejections). */
export function ConfirmButton({
  children,
  message,
  confirmLabel = 'Xác nhận',
  className = 'btn btn-primary',
  disabled,
  pending,
  onConfirm,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} disabled={disabled || pending} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '8px 12px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface-alt)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{message}</span>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || pending}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {pending ? 'Đang gửi…' : confirmLabel}
      </button>
      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setAsking(false)}>
        Hủy
      </button>
    </div>
  );
}
