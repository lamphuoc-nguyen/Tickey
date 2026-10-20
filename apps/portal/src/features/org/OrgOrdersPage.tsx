import { useState, type FormEvent } from 'react';
import { Search, Filter, Download, CheckCircle2, Ticket, Mail, Gift } from 'lucide-react';
import { useMockStore, exportToCsv } from '../../lib/mock-store';

export function OrgOrdersPage() {
  const orders = useMockStore((state) => state.orders);
  const issueCompTicket = useMockStore((state) => state.issueCompTicket);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('ALL');

  const [showCompModal, setShowCompModal] = useState(false);
  const [compCustomer, setCompCustomer] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compEvent, setCompEvent] = useState('Đêm nhạc Mùa Thu (Đêm 1)');
  const [compTier, setCompTier] = useState('Vé mời Ban Tổ Chức (VVIP)');
  const [compQuantity, setCompQuantity] = useState(2);
  const [compNote, setCompNote] = useState('Khách mời danh dự');
  const [sendEmailImmediately, setSendEmailImmediately] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleIssueComp = (e: FormEvent) => {
    e.preventDefault();
    if (!compCustomer || !compEmail) return;

    const newOrder = issueCompTicket({
      customer: compCustomer,
      email: compEmail,
      event: compEvent,
      tier: compTier,
      quantity: Number(compQuantity) || 1,
      note: compNote,
    });

    setShowCompModal(false);
    setCompCustomer('');
    setCompEmail('');
    setCompQuantity(2);
    setCompNote('Khách mời danh dự');

    showToast(
      `Đã cấp thành công ${newOrder.quantity} vé mời (COMP) mã ${newOrder.id} cho ${newOrder.customer}! ${
        sendEmailImmediately ? 'Mã QR đã được gửi về email.' : ''
      }`
    );
  };

  const handleExportExcel = () => {
    const headers = [
      'Mã đơn hàng',
      'Khách hàng',
      'Email',
      'Sự kiện',
      'Hạng vé',
      'Số lượng',
      'Tổng tiền',
      'Phương thức thanh toán',
      'Thời gian mua',
      'Trạng thái',
    ];

    const rows = filteredOrders.map((ord) => [
      ord.id,
      ord.customer,
      ord.email,
      ord.event,
      ord.tier,
      ord.quantity,
      ord.total,
      ord.paymentMethod,
      ord.time,
      ord.status,
    ]);

    exportToCsv(`Tickey_Danh_Sach_Don_Ve_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    showToast(`Đã xuất file Excel/CSV thành công với ${rows.length} đơn hàng!`);
  };

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.event.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEvent = selectedEventFilter === 'ALL' || o.event.includes(selectedEventFilter);

    return matchSearch && matchEvent;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <span className="tag-overline">ĐƠN HÀNG & PHÁT HÀNH VÉ</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Đơn vé & Vé mời (COMP)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Theo dõi danh sách người mua vé, cấp phát vé mời ngoại giao và xuất báo cáo bán vé ra Excel.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowCompModal(true)}
            className="btn btn-primary"
          >
            <Gift size={16} />
            <span>Cấp vé mời (COMP)</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="btn btn-outline"
          >
            <Download size={16} />
            <span>Xuất file Excel</span>
          </button>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '360px', width: '100%' }}>
            <Search
              size={16}
              color="var(--muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Tìm theo mã đơn TK-..., khách hàng, email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={14} color="var(--muted)" />
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              style={{ height: '38px', fontSize: '13px', padding: '0 12px' }}
            >
              <option value="ALL">Tất cả sự kiện</option>
              <option value="Đêm nhạc Mùa Thu (Đêm 1)">Đêm nhạc Mùa Thu (Đêm 1)</option>
              <option value="Đêm nhạc Mùa Thu (Đêm 2)">Đêm nhạc Mùa Thu (Đêm 2)</option>
              <option value="Hòa Nhạc Acoustic">Hòa Nhạc Acoustic Bên Sông</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Mã đơn
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Khách hàng
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Sự kiện & Hạng vé
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Số lượng
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Tổng tiền
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Hình thức
                </th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((ord) => (
                <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {ord.id}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                      {ord.customer}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{ord.email}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                      {ord.event}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{ord.tier}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600 }}>
                    {ord.quantity} vé
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                    {ord.total}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--muted)' }}>
                    {ord.paymentMethod}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span
                      className={`badge ${
                        ord.total === '0đ' || ord.status === 'Đã cấp vé'
                          ? 'badge-info'
                          : 'badge-success'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            color: 'var(--muted)',
            backgroundColor: 'var(--bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Hiển thị {filteredOrders.length} / {orders.length} đơn hàng</span>
          <span>Cập nhật theo thời gian thực</span>
        </div>
      </div>

      {/* Issue Comp Modal */}
      {showCompModal && (
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
              maxWidth: '520px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ticket size={22} color="var(--primary)" />
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Cấp vé mời ngoại giao (COMP)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCompModal(false)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
              Vé mời (Complimentary) có giá 0đ, được cấp cho nhà tài trợ, báo chí hoặc đại biểu danh dự.
            </p>

            <form onSubmit={handleIssueComp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Họ tên cá nhân / Tổ chức nhận vé *
                </label>
                <input
                  type="text"
                  placeholder="VD: Nhà báo Nguyễn Lan Hương (VTV3)"
                  value={compCustomer}
                  onChange={(e) => setCompCustomer(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Email nhận vé điện tử QR *
                </label>
                <input
                  type="email"
                  placeholder="lanhuong.vtv@gmail.com"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Suất diễn
                  </label>
                  <select
                    value={compEvent}
                    onChange={(e) => setCompEvent(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  >
                    <option value="Đêm nhạc Mùa Thu (Đêm 1)">Đêm nhạc Mùa Thu (Đêm 1)</option>
                    <option value="Đêm nhạc Mùa Thu (Đêm 2)">Đêm nhạc Mùa Thu (Đêm 2)</option>
                    <option value="Hòa Nhạc Acoustic Bên Sông">Hòa Nhạc Acoustic Bên Sông</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Số lượng vé mời
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={compQuantity}
                    onChange={(e) => setCompQuantity(Number(e.target.value))}
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Hạng vé cấp
                </label>
                <select
                  value={compTier}
                  onChange={(e) => setCompTier(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Vé mời Ban Tổ Chức (VVIP)">Vé mời Ban Tổ Chức (VVIP - Khu vực danh dự)</option>
                  <option value="Khu VIP · Hàng A">Khu VIP · Hàng A</option>
                  <option value="Khu Standard · Hàng D">Khu Standard · Hàng D</option>
                  <option value="Khu Đứng Standing">Khu Đứng (Standing)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Ghi chú mục đích cấp
                </label>
                <input
                  type="text"
                  placeholder="VD: Tài trợ Vàng, Khách mời Sở VHTT, Báo chí..."
                  value={compNote}
                  onChange={(e) => setCompNote(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmailImmediately}
                  onChange={(e) => setSendEmailImmediately(e.target.checked)}
                />
                <label htmlFor="sendEmail" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                  Gửi email tự động kèm vé QR Code cho người nhận ngay bây giờ
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  <Mail size={16} />
                  Xác nhận cấp vé mời
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
