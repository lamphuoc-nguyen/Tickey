import { errorMessage } from '../../lib/api';

/** Loading / error (with retry) / empty state for a block of server data. Renders nothing once data is there. */
export function QueryNotice({
  loading,
  error,
  empty,
  emptyText = 'Chưa có dữ liệu.',
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}) {
  const box = { padding: '18px 20px', fontSize: 13, color: 'var(--muted)' } as const;
  if (loading) return <div style={box}>Đang tải dữ liệu…</div>;
  if (error) {
    return (
      <div style={{ ...box, color: '#B42318', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{errorMessage(error)}</span>
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  }
  if (empty) return <div style={box}>{emptyText}</div>;
  return null;
}
