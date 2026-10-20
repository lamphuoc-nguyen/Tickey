import { useState, type FormEvent } from 'react';
import { MessageSquare, Send, CheckCircle2, User, Clock, CheckCircle } from 'lucide-react';
import { useMockStore, type ReportItem } from '../../lib/mock-store';

export function OrgReportsPage() {
  const reports = useMockStore((state) => state.reports);
  const replyReport = useMockStore((state) => state.replyReport);

  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [markAsResolved, setMarkAsResolved] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const quickReplies = [
    {
      label: 'Đổi chỗ ngồi VIP',
      text: 'Chào bạn, Ban Tổ Chức đã kiểm tra và tiến hành đổi chỗ ngồi sang hàng ghế mới cho bạn. Thông tin vé mới đã được cập nhật tự động trong email.',
    },
    {
      label: 'Quy định trẻ em',
      text: 'Chào bạn, sự kiện cho phép trẻ em dưới 6 tuổi tham gia miễn phí khi ngồi cùng bố mẹ. Nếu cần ghế riêng xin vui lòng đặt thêm vé standard.',
    },
    {
      label: 'Hỗ trợ check-in vé QR',
      text: 'Chào bạn, bạn chỉ cần xuất trình mã QR trên email hoặc ứng dụng tại Gate 1, nhân viên sẽ quét mã hỗ trợ vào cửa trực tiếp.',
    },
  ];

  const handleSendReply = (e: FormEvent) => {
    e.preventDefault();
    if (!activeReport || !replyMessage.trim()) return;

    const newStatus = markAsResolved ? 'Đã giải quyết' : 'Đã phản hồi';
    replyReport(activeReport.id, replyMessage.trim(), newStatus);

    showToast(`Đã gửi câu trả lời cho khách hàng ${activeReport.customer}!`);
    setActiveReport(null);
    setReplyMessage('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <span className="tag-overline">HỖ TRỢ & KHIẾU NẠI</span>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Phản ánh từ khách hàng
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
          Tiếp nhận, xử lý thắc mắc về chỗ ngồi, suất diễn và phản hồi trực tiếp tới người mua vé.
        </p>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Reports Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Mã phản ánh
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Khách hàng
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Chủ đề & Nội dung
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Thời gian
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Trạng thái
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((rp) => (
              <tr key={rp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {rp.id}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{rp.customer}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{rp.session}</div>
                </td>
                <td style={{ padding: '16px 24px', maxWidth: '380px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {rp.topic}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    {rp.content}
                  </div>
                  {rp.replies && rp.replies.length > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={13} />
                      <span>Đã có {rp.replies.length} phản hồi từ BTC</span>
                    </div>
                  )}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {rp.time}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span
                    className={`badge ${
                      rp.status === 'Chờ phản hồi'
                        ? 'badge-warning'
                        : rp.status === 'Đã phản hồi'
                        ? 'badge-info'
                        : 'badge-success'
                    }`}
                  >
                    {rp.status}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => {
                      setActiveReport(rp);
                      setReplyMessage('');
                      setMarkAsResolved(true);
                    }}
                  >
                    <MessageSquare size={13} style={{ marginRight: '6px' }} />
                    {rp.status === 'Chờ phản hồi' ? 'Trả lời' : 'Xem & Phản hồi'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            color: 'var(--muted)',
            backgroundColor: 'var(--bg)',
          }}
        >
          Tổng cộng {reports.length} phản ánh từ khán giả
        </div>
      </div>

      {/* Reply Modal */}
      {activeReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '580px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  PHẢN HỒI Ý KIẾN KHÁCH HÀNG · {activeReport.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                  }}
                >
                  {activeReport.topic}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Customer Message Box */}
            <div
              style={{
                backgroundColor: 'var(--bg)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <User size={16} color="var(--primary)" />
                <strong style={{ fontSize: '13px' }}>{activeReport.customer}</strong>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>• {activeReport.session}</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>
                  <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                  {activeReport.time}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--text)' }}>
                {activeReport.content}
              </p>
            </div>

            {/* Previous Replies Thread */}
            {activeReport.replies && activeReport.replies.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Lịch sử trao đổi ({activeReport.replies.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeReport.replies.map((rep, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        borderLeft: '3px solid var(--primary)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--primary)' }}>{rep.sender}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{rep.time}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>{rep.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick replies */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                Mẫu câu trả lời nhanh:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReplyMessage(qr.text)}
                    className="btn btn-outline"
                    style={{ fontSize: '11px', padding: '4px 10px', height: 'auto' }}
                  >
                    + {qr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Nội dung phản hồi khách hàng: *
                </label>
                <textarea
                  rows={4}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Nhập nội dung phản hồi chính thức từ Ban Tổ Chức..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '13.5px',
                    resize: 'none',
                    lineHeight: 1.4,
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="markResolved"
                  checked={markAsResolved}
                  onChange={(e) => setMarkAsResolved(e.target.checked)}
                />
                <label htmlFor="markResolved" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                  Đánh dấu phản ánh là <strong>"Đã giải quyết"</strong> sau khi gửi phản hồi
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  className="btn btn-outline"
                >
                  Đóng
                </button>
                <button type="submit" className="btn btn-primary">
                  <Send size={15} />
                  Gửi phản hồi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
