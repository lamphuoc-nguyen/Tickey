import { ScanLine, Smartphone, Plus } from 'lucide-react';

export function OrgGatesPage() {
  const gates = [
    {
      id: 'G1',
      name: 'Cổng chính G1 · Sảnh Mặt Tiền',
      zones: ['Khu VIP', 'Khu Standard (Hàng D - J)'],
      devices: [
        { id: 'DEV-01', name: 'Máy quét cầm tay POS-01', staff: 'Lê Minh Khoa', status: 'Online' },
        { id: 'DEV-02', name: 'Điện thoại Staff Android-02', staff: 'Trần Thị Bích', status: 'Online' },
      ],
      scannedCount: 42,
      totalExpected: 140,
    },
    {
      id: 'G2',
      name: 'Cổng phụ G2 · Lối Vào Tầng 2',
      zones: ['Khu Balcony Tầng 2', 'Khu đứng (Standing)'],
      devices: [
        { id: 'DEV-03', name: 'Máy quét cầm tay POS-03', staff: 'Nguyễn Văn An', status: 'Online' },
      ],
      scannedCount: 22,
      totalExpected: 60,
    },
  ];

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
          <span className="tag-overline">VẬN HÀNH CHECK-IN</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Quản lý cổng vào & Thiết bị soát vé
          </h1>
        </div>

        <button
          onClick={() => alert('Thêm cấu hình cổng mới')}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Thêm cổng mới</span>
        </button>
      </div>

      {/* Gates Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {gates.map((gate) => (
          <div key={gate.id} className="card" style={{ padding: '24px 28px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-tint)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScanLine size={22} />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '18px',
                      fontWeight: 700,
                      margin: '0 0 4px',
                    }}
                  >
                    {gate.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    Phân luồng vé: {gate.zones.join(' • ')}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tiến độ soát vé</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                  {gate.scannedCount} / {gate.totalExpected} khách
                </div>
              </div>
            </div>

            {/* Devices Connected */}
            <div
              style={{
                backgroundColor: 'var(--bg)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                marginTop: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '12px',
                }}
              >
                Thiết bị kết nối ({gate.devices.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {gate.devices.map((dev) => (
                  <div
                    key={dev.id}
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Smartphone size={16} color="var(--primary)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{dev.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Phụ trách: {dev.staff}</div>
                      </div>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                      {dev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
