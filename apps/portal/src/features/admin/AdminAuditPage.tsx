import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatDateTime } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import { FigmaPageHeader } from '../../components/common/FigmaScreenPrimitives';
import { AUDIT_SCOPE, useAuditLogs } from './data/admin-data';

const SCOPE_FILTERS = ['ALL', 'ADMIN', 'ORG', 'STAFF', 'CUSTOMER', 'SYSTEM'];

/** Escapes one CSV field (quotes doubled, wrapped when it holds a separator). */
const csvField = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function AdminAuditPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('');

  const logs = useAuditLogs({ action: actionFilter.trim() || undefined });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = logs.data ?? [];
    return all.filter((log) => {
      const matchScope = scopeFilter === 'ALL' || log.actorScope === scopeFilter;
      if (!matchScope) return false;
      if (!needle) return true;
      return `${log.action} ${log.actorId ?? ''} ${log.targetType ?? ''} ${log.targetId ?? ''} ${log.orgId ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [logs.data, search, scopeFilter]);

  const handleExportCsv = () => {
    const rows = [
      ['Thoi gian', 'Pham vi', 'Tai khoan', 'Hanh dong', 'Doi tuong', 'Ma doi tuong', 'To chuc'],
      ...filtered.map((l) => [
        formatDateTime(l.createdAt),
        AUDIT_SCOPE[l.actorScope ?? '']?.label ?? l.actorScope ?? '',
        l.actorId ?? '',
        l.action,
        l.targetType ?? '',
        l.targetId ?? '',
        l.orgId ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => csvField(String(c))).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tickey-audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${filtered.length} bản ghi lịch sử thao tác ra CSV.`, 'success');
  };

  return (
    <div>
      <FigmaPageHeader overline="TICKEY / ADMIN" title="Lịch sử thao tác hệ thống (Audit Log)" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 300 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Tìm theo hành động, tài khoản, đối tượng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-input"
            style={{ width: 180 }}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            {SCOPE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'Mọi phạm vi' : (AUDIT_SCOPE[s]?.label ?? s)}
              </option>
            ))}
          </select>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="Lọc theo mã hành động (vd: KYC.APPROVE)"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleExportCsv} disabled={!filtered.length}>
          Xuất CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
            Tất cả bản ghi bất biến (Immutable Audit Trail)
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} bản ghi</div>
        </div>
        <QueryNotice
          loading={logs.isPending}
          error={logs.error}
          onRetry={() => logs.refetch()}
          empty={logs.isSuccess && !(logs.data ?? []).length}
          emptyText="Chưa có bản ghi lịch sử thao tác nào."
        />
        {!!filtered.length && (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>THỜI GIAN</th>
                  <th>PHẠM VI</th>
                  <th>TÀI KHOẢN</th>
                  <th>HÀNH ĐỘNG</th>
                  <th>ĐỐI TƯỢNG TÁC ĐỘNG</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const scope = AUDIT_SCOPE[log.actorScope ?? ''] ?? {
                    label: log.actorScope ?? '—',
                    badge: 'badge-info',
                  };
                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td>
                        <span className={`badge ${scope.badge}`}>{scope.label}</span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>
                        {log.actorId ? log.actorId.slice(0, 8) : 'Hệ thống'}
                      </td>
                      <td>{log.action}</td>
                      <td style={{ fontSize: 12 }}>
                        {log.targetType ? `${log.targetType}` : '—'}
                        {log.targetId ? ` · ${log.targetId.slice(0, 8)}` : ''}
                      </td>
                      <td>
                        <span className="badge badge-success">Đã ghi sổ</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
