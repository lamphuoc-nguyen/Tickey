import { useState } from 'react';
import { Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { FigmaPageHeader } from '../../components/common/FigmaScreenPrimitives';

export function AdminAuditPage() {
  const { state } = useMockStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('ALL');

  const filteredLogs = state.auditLogs.filter((log) => {
    const matchText =
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.target.toLowerCase().includes(search.toLowerCase());
    const matchActor =
      actorFilter === 'ALL' ||
      (actorFilter === 'ADMIN' && log.actor.includes('admin')) ||
      (actorFilter === 'ORG' && !log.actor.includes('admin'));
    return matchText && matchActor;
  });

  const handleExportCsv = () => {
    const rows = [
      ['Thoi gian', 'Nguoi thuc hien', 'Hanh dong', 'Doi tuong'],
      ...filteredLogs.map((l) => [l.timestamp, l.actor, l.action, l.target]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tickey-audit-logs.csv';
    a.click();
    showToast('Đã xuất sổ cái lịch sử thao tác (Audit Log) ra CSV.', 'success');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 320 }}>
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
              placeholder="Tìm theo tài khoản, hành động, mã hồ sơ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-input"
            style={{ width: 180 }}
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
          >
            <option value="ALL">Lọc đối tượng</option>
            <option value="ADMIN">Admin nền tảng</option>
            <option value="ORG">Tổ chức (Tenant)</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
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
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {filteredLogs.length} bản ghi
          </div>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>THỜI GIAN</th>
                <th>TÀI KHOẢN</th>
                <th>HÀNH ĐỘNG</th>
                <th>ĐỐI TƯỢNG TÁC ĐỘNG</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.timestamp}</td>
                  <td style={{ fontWeight: 700 }}>{log.actor}</td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                  <td>
                    <span className="badge badge-success">Đã ghi sổ</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
