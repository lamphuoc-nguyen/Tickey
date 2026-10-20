import { useState, type FormEvent } from 'react';
import { ScanLine, Smartphone, Plus, Trash2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useMockStore, type GateItem } from '../../lib/mock-store';

export function OrgGatesPage() {
  const gates = useMockStore((state) => state.gates);
  const staffList = useMockStore((state) => state.staffList);
  const addGate = useMockStore((state) => state.addGate);
  const removeGate = useMockStore((state) => state.removeGate);
  const addDeviceToGate = useMockStore((state) => state.addDeviceToGate);

  const [showAddModal, setShowAddModal] = useState(false);
  const [gateName, setGateName] = useState('');
  const [selectedZones, setSelectedZones] = useState<string[]>(['Khu VIP']);
  const [expectedCount, setExpectedCount] = useState<number>(120);
  const [initialDeviceName, setInitialDeviceName] = useState('Máy quét cầm tay POS');
  const [initialDeviceStaff, setInitialDeviceStaff] = useState(staffList[0]?.name || 'Lê Minh Khoa');

  const [showAddDeviceModal, setShowAddDeviceModal] = useState<string | null>(null);
  const [newDevName, setNewDevName] = useState('Điện thoại Staff Android');
  const [newDevStaff, setNewDevStaff] = useState(staffList[0]?.name || 'Nguyễn Văn An');

  const [deleteConfirm, setDeleteConfirm] = useState<GateItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const availableZones = [
    'Khu VIP',
    'Khu Standard (Hàng D - J)',
    'Khu Balcony Tầng 2',
    'Khu đứng (Standing)',
    'Khu Khách mời (VVIP)',
  ];

  const toggleZone = (z: string) => {
    if (selectedZones.includes(z)) {
      if (selectedZones.length > 1) {
        setSelectedZones(selectedZones.filter((item) => item !== z));
      }
    } else {
      setSelectedZones([...selectedZones, z]);
    }
  };

  const handleAddGate = (e: FormEvent) => {
    e.preventDefault();
    if (!gateName.trim()) return;

    addGate({
      name: gateName,
      zones: selectedZones,
      totalExpected: Number(expectedCount) || 100,
      devices: [
        {
          id: 'DEV-01',
          name: initialDeviceName || 'Máy quét POS',
          staff: initialDeviceStaff || 'Nhân viên phụ trách',
          status: 'Online',
        },
      ],
    });

    setShowAddModal(false);
    setGateName('');
    setSelectedZones(['Khu VIP']);
    setExpectedCount(120);
    showToast(`Đã thiết lập cổng mới "${gateName}" thành công!`);
  };

  const handleAddDeviceSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!showAddDeviceModal) return;

    addDeviceToGate(showAddDeviceModal, {
      name: newDevName,
      staff: newDevStaff,
      status: 'Online',
    });

    showToast(`Đã liên kết thiết bị "${newDevName}" vào cổng thành công!`);
    setShowAddDeviceModal(null);
  };

  const handleDeleteGate = (gate: GateItem) => {
    removeGate(gate.id);
    setDeleteConfirm(null);
    showToast(`Đã xóa cổng "${gate.name}"!`);
  };

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
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Cấu hình phân luồng khán giả tại các cửa vào sự kiện, liên kết máy quét mã vạch và phân công người trực.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Thêm cổng mới</span>
        </button>
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
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-tint, rgba(0, 102, 204, 0.1))',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScanLine size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '19px',
                        fontWeight: 700,
                        margin: 0,
                      }}
                    >
                      {gate.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      {gate.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                    Phân luồng vé: <strong>{gate.zones.join(' • ')}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tiến độ soát vé</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                    {gate.scannedCount} / {gate.totalExpected} khách
                  </div>
                </div>

                <button
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger, #dc2626)', padding: '6px 8px' }}
                  title="Xóa cấu hình cổng"
                  onClick={() => setDeleteConfirm(gate)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'var(--bg)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.round((gate.scannedCount / (gate.totalExpected || 1)) * 100))}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                  borderRadius: '3px',
                }}
              />
            </div>

            {/* Devices Connected */}
            <div
              style={{
                backgroundColor: 'var(--bg)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Thiết bị kết nối ({gate.devices.length})
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
                  onClick={() => setShowAddDeviceModal(gate.id)}
                >
                  <Plus size={12} style={{ marginRight: '4px' }} />
                  Gán thêm thiết bị
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
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
                    <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {dev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Gate Modal */}
      {showAddModal && (
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
                <Layers size={20} color="var(--primary)" />
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Thêm cấu hình cổng mới
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
              Thiết lập cổng kiểm soát vé vào khán phòng và gán luồng vé hợp lệ.
            </p>

            <form onSubmit={handleAddGate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Tên cổng & Vị trí *
                </label>
                <input
                  type="text"
                  placeholder="VD: Cổng phụ G3 · Sảnh Tây (Khu VIP)"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Phân luồng loại vé cho phép qua cổng này:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableZones.map((z) => {
                    const isSelected = selectedZones.includes(z);
                    return (
                      <button
                        type="button"
                        key={z}
                        onClick={() => toggleZone(z)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: isSelected ? 'var(--primary-tint, rgba(0, 102, 204, 0.1))' : 'var(--bg)',
                          color: isSelected ? 'var(--primary)' : 'var(--text)',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {z}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Số khách dự kiến
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={expectedCount}
                    onChange={(e) => setExpectedCount(Number(e.target.value))}
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Nhân viên phụ trách ban đầu
                  </label>
                  <select
                    value={initialDeviceStaff}
                    onChange={(e) => setInitialDeviceStaff(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  >
                    {staffList.map((stf) => (
                      <option key={stf.id} value={stf.name}>
                        {stf.name} ({stf.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Tên thiết bị soát vé đầu tiên
                </label>
                <input
                  type="text"
                  placeholder="VD: Máy quét Sunmi POS-04"
                  value={initialDeviceName}
                  onChange={(e) => setInitialDeviceName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
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
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  Tạo cổng mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDeviceModal && (
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
              maxWidth: '440px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '19px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Gán thiết bị cho cổng {showAddDeviceModal}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddDeviceModal(null)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDeviceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Tên thiết bị *
                </label>
                <input
                  type="text"
                  placeholder="VD: Điện thoại Samsung Galaxy A15 (Staff)"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Nhân viên sử dụng
                </label>
                <select
                  value={newDevStaff}
                  onChange={(e) => setNewDevStaff(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  {staffList.map((stf) => (
                    <option key={stf.id} value={stf.name}>
                      {stf.name} ({stf.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(null)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Kết nối thiết bị
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', color: 'var(--danger, #dc2626)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Xác nhận xóa cổng vào</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Bạn có chắc chắn muốn xóa cấu hình <strong>{deleteConfirm.name}</strong>? Các thiết bị liên kết với cổng này sẽ bị ngắt kết nối.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ backgroundColor: 'var(--danger, #dc2626)', color: '#fff', border: 'none' }}
                onClick={() => handleDeleteGate(deleteConfirm)}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
