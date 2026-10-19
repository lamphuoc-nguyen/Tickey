
export function OrgReportsPage() {
  const reports = [
    {
      id: 'RP-018',
      customer: 'Vũ Minh Tuấn',
      session: 'Đêm nhạc Mùa Thu (Đêm 1)',
      topic: 'Yêu cầu đổi chỗ ngồi khu VIP',
      content: 'Tôi muốn đổi từ ghế A-04 sang ghế A-06 do đi cùng bạn bè.',
      status: 'Chờ phản hồi',
      time: '19/10/2026 10:15',
    },
    {
      id: 'RP-019',
      customer: 'Hoàng Lan Anh',
      session: 'Đêm nhạc Mùa Thu (Đêm 1)',
      topic: 'Hỏi về quy định mang trẻ em',
      content: 'Chương trình có giới hạn độ tuổi không? Trẻ em 5 tuổi có cần mua vé riêng không ạ?',
      status: 'Đã giải quyết',
      time: '18/10/2026 15:30',
    },
  ];

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
      </div>

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
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((rp) => (
              <tr key={rp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                  {rp.id}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 600 }}>
                  {rp.customer}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {rp.topic}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    {rp.content}
                  </div>
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--muted)' }}>
                  {rp.time}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span
                    className={`badge ${rp.status === 'Chờ phản hồi' ? 'badge-warning' : 'badge-success'}`}
                  >
                    {rp.status}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '13px', padding: '6px 10px', color: 'var(--primary)' }}
                    onClick={() => alert(`Mở khung chat phản hồi cho phản ánh ${rp.id}`)}
                  >
                    Trả lời
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
