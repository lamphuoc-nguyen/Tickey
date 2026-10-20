import {
  CheckCircle2,
  Eye,
  Search,
  Download,
  Send,
  MessageSquare,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useMockStore, exportToCsv, type DisputeItem } from '../../lib/mock-store';

export function AdminReportsPage() {
  const disputes = useMockStore((state) => state.disputes);
  const resolveDispute = useMockStore((state) => state.resolveDispute);
  const replyDispute = useMockStore((state) => state.replyDispute);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filtered = disputes.filter((d) => {
    if (!searchTerm) return true;
    return (
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.eventName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleResolve = (id: string) => {
    resolveDispute(id, resolutionNote);
    setSelectedDispute(null);
    setResolutionNote('');
    setActionSuccess(`Hồ sơ khiếu nại ${id} đã được giải quyết thành công.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleSendReply = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDispute || !replyText.trim()) return;

    replyDispute(selectedDispute.id, replyText.trim(), 'IN_PROGRESS');
    setActionSuccess(`Đã gửi tin nhắn phản hồi tới khách hàng ${selectedDispute.customerName}!`);
    setTimeout(() => setActionSuccess(null), 4000);
    setReplyText('');
    // refresh active selection
    const updated = disputes.find((d) => d.id === selectedDispute.id);
    if (updated) setSelectedDispute({ ...updated });
  };

  const handleExportExcel = () => {
    const headers = [
      'Mã khiếu nại',
      'Khách hàng',
      'Email',
      'Mã đơn hàng',
      'Sự kiện',
      'Nội dung khiếu nại',
      'Thời gian gửi',
      'Trạng thái',
      'Ghi chú kết luận',
    ];

    const rows = filtered.map((d) => [
      d.id,
      d.customerName,
      d.customerEmail,
      d.orderId,
      d.eventName,
      d.issue,
      d.submittedAt,
      d.status === 'RESOLVED' ? 'Đã giải quyết' : d.status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Đang mở',
      d.resolutionNote || 'Chưa có',
    ]);

    exportToCsv(`Tickey_Bao_Cao_Tranh_Chap_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    setActionSuccess(`Đã xuất file Excel/CSV ${rows.length} hồ sơ khiếu nại!`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          TICKEY / ADMIN / DISPUTES & SUPPORT
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Phản ánh & Tranh chấp người mua vé
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
              Tiếp nhận, xử lý khiếu nại giao dịch vé, lỗi thanh toán và tranh chấp giữa khách hàng với nhà tổ chức.
            </p>
          </div>

          <button
            onClick={handleExportExcel}
            className="btn btn-outline"
            style={{ fontSize: '13px' }}
          >
            <Download size={16} style={{ marginRight: '6px' }} />
            <span>Xuất file Excel</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            width: '320px',
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Tìm theo mã DS, khách hàng, mã đơn…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Tổng cộng <strong>{filtered.length}</strong> vụ việc
        </div>
      </div>

      {/* Disputes Table */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="table" style={{ width: '100%', margin: 0 }}>
          <thead>
            <tr>
              <th>Mã vụ việc</th>
              <th>Khách hàng</th>
              <th>Đơn hàng & Sự kiện</th>
              <th>Nội dung khiếu nại</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{item.id}</strong>
                </td>
                <td>
                  <div>{item.customerName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.customerEmail}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.orderId}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.eventName}</div>
                </td>
                <td style={{ maxWidth: '320px' }}>
                  <div
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '13px',
                    }}
                  >
                    {item.issue}
                  </div>
                </td>
                <td>
                  {item.status === 'OPEN' && <span className="badge badge-warning">Đang mở</span>}
                  {item.status === 'IN_PROGRESS' && (
                    <span className="badge badge-info">Đang xử lý</span>
                  )}
                  {item.status === 'RESOLVED' && (
                    <span className="badge badge-success">Đã giải quyết</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setSelectedDispute(item)}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    <Eye size={14} style={{ marginRight: '4px' }} />
                    Xem & Trả lời
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dispute Modal */}
      {selectedDispute && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  XỬ LÝ KHIẾU NẠI · {selectedDispute.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedDispute.eventName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="btn-ghost"
                style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Khách hàng</div>
                <div style={{ fontWeight: 600 }}>{selectedDispute.customerName} ({selectedDispute.customerEmail})</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Đơn hàng: {selectedDispute.orderId} · Thời gian gửi: {selectedDispute.submittedAt}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Chi tiết phản ánh</div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{selectedDispute.issue}</p>
              </div>

              {/* Chat Thread */}
              {selectedDispute.replies && selectedDispute.replies.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Nhật ký trả lời khách hàng ({selectedDispute.replies.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedDispute.replies.map((r, i) => (
                      <div key={i} style={{ backgroundColor: 'var(--bg)', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                          <strong style={{ color: 'var(--primary)' }}>{r.sender}</strong>
                          <span style={{ color: 'var(--muted)' }}>{r.time}</span>
                        </div>
                        <div style={{ fontSize: '13px' }}>{r.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Reply Form */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  <MessageSquare size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Gửi phản hồi trực tiếp tới email khách hàng:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="VD: Đã gửi lại mã QR qua email và kích hoạt vé thủ công trên hệ thống…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{ flex: 1, height: '38px', fontSize: '13px', padding: '0 12px' }}
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    className="btn btn-outline"
                    style={{ height: '38px', padding: '0 14px', fontSize: '13px' }}
                  >
                    <Send size={14} style={{ marginRight: '4px' }} />
                    Gửi
                  </button>
                </div>
              </div>

              {selectedDispute.status !== 'RESOLVED' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Ghi chú kết luận vụ việc & đóng hồ sơ:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú nội bộ: Lý do giải quyết xong tranh chấp..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                      resize: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedDispute(null)}
                className="btn btn-outline"
                style={{ fontSize: '13px' }}
              >
                Đóng
              </button>
              {selectedDispute.status !== 'RESOLVED' && (
                <button
                  onClick={() => handleResolve(selectedDispute.id)}
                  className="btn btn-primary"
                  style={{ fontSize: '13px' }}
                >
                  Giải quyết & Đóng hồ sơ khiếu nại
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
