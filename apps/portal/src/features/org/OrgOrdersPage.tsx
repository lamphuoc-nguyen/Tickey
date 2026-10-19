import { useState } from 'react';
import { Search, Filter, Download, Plus } from 'lucide-react';

export function OrgOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const orders = [
    {
      id: 'TK-1024',
      customer: 'Trần Văn Hoàng',
      email: 'hoang.tran@gmail.com',
      event: 'Đêm nhạc Mùa Thu (Đêm 1)',
      tier: 'Khu VIP · Hàng A',
      quantity: 2,
      total: '1.700.000đ',
      paymentMethod: 'Chuyển khoản QR',
      time: '19/10/2026 14:20',
      status: 'Đã thanh toán',
    },
    {
      id: 'TK-1025',
      customer: 'Lê Thị Mai',
      email: 'mai.le@gmail.com',
      event: 'Đêm nhạc Mùa Thu (Đêm 1)',
      tier: 'Khu Standard · Hàng D',
      quantity: 1,
      total: '450.000đ',
      paymentMethod: 'Thẻ ATM nội địa',
      time: '19/10/2026 13:45',
      status: 'Đã thanh toán',
    },
    {
      id: 'TK-1026',
      customer: 'Phạm Minh Đức',
      email: 'duc.pham@gmail.com',
      event: 'Hòa Nhạc Acoustic Bên Sông',
      tier: 'Khu Đứng',
      quantity: 3,
      total: '450.000đ',
      paymentMethod: 'Ví MoMo',
      time: '19/10/2026 11:10',
      status: 'Đã thanh toán',
    },
    {
      id: 'TK-1027',
      customer: 'Ngô Bảo Châu',
      email: 'chau.ngo@gmail.com',
      event: 'Đêm nhạc Mùa Thu (Đêm 2)',
      tier: 'Vé mời Ban Tổ Chức (COMP)',
      quantity: 2,
      total: '0đ',
      paymentMethod: 'Vé mời (COMP)',
      time: '18/10/2026 16:30',
      status: 'Đã cấp vé',
    },
  ];

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => alert('Mở hộp thoại nhập danh sách vé mời từ Excel (o-comp-import)')}
            className="btn btn-outline"
          >
            <Plus size={16} />
            <span>Cấp vé mời (COMP)</span>
          </button>
          <button
            onClick={() => alert('Xuất danh sách đơn vé ra file Excel (.xlsx)')}
            className="btn btn-outline"
          >
            <Download size={16} />
            <span>Xuất file Excel</span>
          </button>
        </div>
      </div>

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
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px', height: '38px' }}>
              <Filter size={14} />
              <span>Tất cả sự kiện</span>
            </button>
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
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((ord) => (
                <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
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
                  <td style={{ padding: '16px 20px' }}>
                    <span className="badge badge-success">{ord.status}</span>
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
          }}
        >
          Hiển thị {filteredOrders.length} đơn hàng
        </div>
      </div>
    </div>
  );
}
