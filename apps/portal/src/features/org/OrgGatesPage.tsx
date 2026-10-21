import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import {
  FigmaPageHeader,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const GATE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-gates', label: 'Cổng soát vé (Gates)' },
  { id: 'o-gate-create', label: 'Tạo cổng soát vé mới' },
  { id: 'o-gate-edit', label: 'Cấu hình cổng' },
  { id: 'o-devices', label: 'Thiết bị quét vé (Devices)' },
  { id: 'o-device-add', label: 'Đăng ký thiết bị mới' },
  { id: 'o-device-revoke', label: 'Thu hồi phiên thiết bị' },
];

export function OrgGatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    state,
    createGate,
    updateGate,
    createDevice,
    revokeDevice,
    reactivateDevice,
  } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-gates';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');

  // Gate form state
  const [selectedGateId, setSelectedGateId] = useState('g-1');
  const [gateCode, setGateCode] = useState('G1');
  const [gateName, setGateName] = useState('Cổng chính G1 · Sảnh A');
  const [gateTiers, setGateTiers] = useState('Standard, Vé Sinh viên 0đ');
  const [gateStaff, setGateStaff] = useState('Trần Quốc Bảo');
  const [isCreatingGate, setIsCreatingGate] = useState(false);

  // Device form state
  const [newDeviceCode, setNewDeviceCode] = useState('DEV-G1-03');
  const [newDeviceModel, setNewDeviceModel] = useState('Sunmi V2 Pro · Máy POS cầm tay');
  const [newDeviceGate, setNewDeviceGate] = useState('G1');
  const [newDeviceStaff, setNewDeviceStaff] = useState('Lê Minh Khoa');

  const [revokeDeviceId, setRevokeDeviceId] = useState('d-1');
  const [revokeDeviceCode, setRevokeDeviceCode] = useState('DEV-G1-02 · iPhone 15 Pro');
  const [revokeReason, setRevokeReason] = useState('Nhân sự đổi máy dự phòng tại cổng.');

  const screenMeta = GATE_SCREENS.find((s) => s.id === activeScreen) || GATE_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={GATE_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-gates */}
      {activeScreen === 'o-gates' && (
        <div>
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
                  placeholder="Tìm theo tên, mã, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-devices')}
              >
                Thiết bị quét vé
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => showToast('Đã xuất cấu hình cổng ra CSV.', 'success')}
              >
                Xuất CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setIsCreatingGate(true);
                  setSelectedGateId('');
                  const nextNum = state.gates.length + 1;
                  setGateCode(`G${nextNum}`);
                  setGateName(`Cổng G${nextNum} · Lối vào`);
                  setGateTiers('Tất cả hạng vé');
                  setGateStaff(state.members[0]?.name || 'Chưa gán');
                  setScreen('o-gate-create');
                }}
              >
                + Tạo cổng mới
              </button>
            </div>
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
                Tất cả danh sách
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.gates.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ CỔNG</th>
                    <th>TÊN CỔNG</th>
                    <th>HẠNG VÉ CHO PHÉP</th>
                    <th>THIẾT BỊ KẾT NỐI</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.gates.map((g) => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 700 }}>{g.code}</td>
                      <td>{g.name}</td>
                      <td>{g.allowedTiers}</td>
                      <td>{g.devicesCount || 0} thiết bị</td>
                      <td>
                        <span className="badge badge-success">Hoạt động</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingGate(false);
                            setSelectedGateId(g.id);
                            setGateCode(g.code);
                            setGateName(g.name);
                            setGateTiers(g.allowedTiers);
                            setGateStaff(state.members[0]?.name || 'Lê Minh Khoa');
                            setScreen('o-gate-edit');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cấu hình →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. o-gate-create & o-gate-edit */}
      {(activeScreen === 'o-gate-create' || activeScreen === 'o-gate-edit' || activeScreen === 'o-gate-g2') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              {isCreatingGate ? 'Tạo mới cổng soát vé' : `Cấu hình chi tiết · Cổng ${gateCode}`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Mã cổng</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: G1, G2, G3, Cổng VIP, Cổng Đông..."
                  value={gateCode}
                  onChange={(e) => setGateCode(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tên cổng soát vé</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Cổng chính G3 · Khán đài B, Cổng check-in Fanzone..."
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Hạng vé được phép qua cổng</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Standard, VIP, Vé mời COMP hoặc Tất cả hạng vé"
                  value={gateTiers}
                  onChange={(e) => setGateTiers(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Nhân sự phụ trách chính</label>
                <select
                  className="form-input"
                  value={gateStaff}
                  onChange={(e) => setGateStaff(e.target.value)}
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                  {state.members.length === 0 && <option value="Chưa gán">Chưa gán nhân sự</option>}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {isCreatingGate ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (!gateName.trim()) {
                        showToast('Vui lòng nhập tên cổng soát vé.', 'warning');
                        return;
                      }
                      createGate({
                        code: gateCode.trim() || `G${state.gates.length + 1}`,
                        name: gateName.trim(),
                        allowedTiers: gateTiers.trim() || 'Tất cả hạng vé',
                      });
                      showToast(`Đã tạo thành công cổng soát vé ${gateCode} - ${gateName}.`, 'success');
                      setScreen('o-gates');
                    }}
                  >
                    Tạo cổng mới
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      updateGate(selectedGateId || 'g-1', {
                        name: gateName,
                        allowedTiers: gateTiers,
                      });
                      showToast(`Đã lưu cấu hình cổng ${gateCode}.`, 'success');
                      setScreen('o-gates');
                    }}
                  >
                    Lưu cấu hình cổng
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-gates')}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-devices')}
                >
                  Xem thiết bị
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 3. o-devices: Danh sách thiết bị */}
      {activeScreen === 'o-devices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-gates')}
              >
                ← Danh sách cổng
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const nextNum = state.devices.length + 1;
                setNewDeviceCode(`DEV-G1-0${nextNum}`);
                setNewDeviceModel('Sunmi V2 Pro · Máy POS cầm tay');
                setNewDeviceGate(state.gates[0]?.code || 'G1');
                setNewDeviceStaff(state.members[0]?.name || 'Lê Minh Khoa');
                setScreen('o-device-add');
              }}
            >
              + Đăng ký thiết bị mới
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
                Thiết bị đang đăng nhập ứng dụng Staff Check-in
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.devices.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ THIẾT BỊ</th>
                    <th>TÊN MÁY</th>
                    <th>CỔNG GÁN</th>
                    <th>NHÂN SỰ</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.devices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.code}</td>
                      <td>{d.model}</td>
                      <td>
                        <span className="badge badge-secondary">{d.gateCode}</span>
                      </td>
                      <td>{d.staffName}</td>
                      <td>
                        <span
                          className={`badge ${
                            d.status === 'ONLINE' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {d.status === 'ONLINE' ? 'Trực tuyến' : 'Đã thu hồi'}
                        </span>
                      </td>
                      <td>
                        {d.status === 'ONLINE' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeDeviceId(d.id);
                              setRevokeDeviceCode(`${d.code} · ${d.model}`);
                              setScreen('o-device-revoke');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Thu hồi phiên
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              reactivateDevice(d.id);
                              showToast(`Đã kết nối lại thiết bị ${d.code}.`, 'success');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Kết nối lại →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. o-device-add: Đăng ký thiết bị mới */}
      {activeScreen === 'o-device-add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Đăng ký thiết bị quét vé Check-in mới
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Mã định danh thiết bị</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: DEV-G1-03, POS-01..."
                  value={newDeviceCode}
                  onChange={(e) => setNewDeviceCode(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tên dòng máy / Model</label>
                <select
                  className="form-input"
                  value={newDeviceModel}
                  onChange={(e) => setNewDeviceModel(e.target.value)}
                >
                  <option value="Sunmi V2 Pro · Máy POS cầm tay">Sunmi V2 Pro · Máy POS cầm tay</option>
                  <option value="iPad 10 Scanner · Máy tính bảng quầy">iPad 10 Scanner · Máy tính bảng quầy</option>
                  <option value="iPhone 15 Pro · Mobile Check-in">iPhone 15 Pro · Mobile Check-in</option>
                  <option value="Samsung Galaxy A54 · PDA chuyên dụng">Samsung Galaxy A54 · PDA chuyên dụng</option>
                  <option value="Đầu đọc mã QR cố định tại Barrier">Đầu đọc mã QR cố định tại Barrier</option>
                </select>
              </div>
              <div>
                <label className="form-label">Cổng soát vé được gán</label>
                <select
                  className="form-input"
                  value={newDeviceGate}
                  onChange={(e) => setNewDeviceGate(e.target.value)}
                >
                  {state.gates.map((g) => (
                    <option key={g.id} value={g.code}>
                      {g.code} · {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Nhân sự phụ trách cầm máy</label>
                <select
                  className="form-input"
                  value={newDeviceStaff}
                  onChange={(e) => setNewDeviceStaff(e.target.value)}
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                  {state.members.length === 0 && <option value="Chưa gán">Chưa gán nhân sự</option>}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    createDevice({
                      code: newDeviceCode.trim() || `DEV-${Date.now()}`,
                      model: newDeviceModel,
                      gateCode: newDeviceGate,
                      staffName: newDeviceStaff,
                    });
                    showToast(`Đã kích hoạt thiết bị ${newDeviceCode} kết nối cổng ${newDeviceGate}.`, 'success');
                    setScreen('o-devices');
                  }}
                >
                  Kích hoạt & gán thiết bị
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-devices')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. o-device-revoke: Thu hồi phiên thiết bị */}
      {activeScreen === 'o-device-revoke' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Thu hồi phiên thiết bị
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Thiết bị thu hồi</label>
                <input
                  className="form-input"
                  disabled
                  value={revokeDeviceCode}
                  onChange={(e) => setRevokeDeviceCode(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Lý do thu hồi phiên</label>
                <input
                  className="form-input"
                  placeholder="Nhập lý do thu hồi máy (ví dụ: Hết ca trực, Đổi máy dự phòng...)"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    revokeDevice(revokeDeviceId);
                    showToast(`Đã ngắt phiên đăng nhập của ${revokeDeviceCode}.`, 'warning');
                    setScreen('o-devices');
                  }}
                >
                  Xác nhận thu hồi thiết bị
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-devices')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}
    </div>
  );
}
