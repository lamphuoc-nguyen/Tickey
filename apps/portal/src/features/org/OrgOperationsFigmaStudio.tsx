import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  KeyRound,
  Landmark,
  Plus,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';

/**
 * 1. OrgStaffFigmaPanel
 * Frames: o-members (1:5540), o-member-add (1:5705), o-invite-sent (137:7910),
 *         o-staff (1:8746), o-staff-assign (1:8905), o-staff-khoa (137:7997)
 */
export function OrgStaffFigmaPanel() {
  const { staffList, addStaff, updateStaff } = useMockStore();
  const [tab, setTab] = useState<'o-members' | 'o-staff-assign' | 'o-staff-khoa' | 'o-invite-sent'>('o-staff-khoa');
  const [banner, setBanner] = useState<string | null>(null);

  // Shift assignment controlled state
  const [assignStaffName, setAssignStaffName] = useState('Trần Minh Khoa');
  const [assignGate, setAssignGate] = useState('Đêm 1 · Cổng G1 (VIP A–C)');
  const [assignShiftTime, setAssignShiftTime] = useState('24/10/2026 • 18:00 – 22:30');
  const [assignDevice, setAssignDevice] = useState('Scanner G1-01 (Online)');
  const [assignPermission, setAssignPermission] = useState('Quét vé & tra cứu tại cổng');

  // Member list & invite state
  const [members, setMembers] = useState([
    {
      id: 'MEM-01',
      name: 'Nguyễn Minh Anh',
      email: 'minhanh@anhtrang.vn',
      role: 'Owner',
      scope: 'Toàn quyền quản trị Organization & Tài chính',
      status: 'Toàn quyền',
    },
    {
      id: 'MEM-02',
      name: 'Lê Thảo',
      email: 'thao.le@anhtrang.vn',
      role: 'Event Manager',
      scope: 'Quản lý sự kiện, sơ đồ ghế, vé mời COMP',
      status: 'Đang hoạt động',
    },
    {
      id: 'MEM-03',
      name: 'Trần Minh Khoa',
      email: 'khoa.le@dev.local',
      role: 'Staff',
      scope: 'Ứng dụng soát vé Cổng G1 · Đêm 1',
      status: 'Soát vé Đêm 1',
    },
  ]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Staff');
  const [lastInvitedEmail, setLastInvitedEmail] = useState('khoa.tran@anhtrang.vn');

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="tag-overline">03 / ORGANIZATION · THÀNH VIÊN WORKSPACE & CA TRỰC STAFF FIGMA</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '20px' }}>
            Phân quyền Thành viên (o-members) & Ca trực của {assignStaffName} (o-staff-khoa)
          </h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'o-staff-khoa', label: `Ca trực ${assignStaffName} (o-staff-khoa)` },
              { id: 'o-staff-assign', label: 'Phân công Đêm 1 (o-staff-assign)' },
              { id: 'o-members', label: `Thành viên & Quyền (${members.length})` },
              { id: 'o-invite-sent', label: 'Đã gửi lời mời (o-invite-sent)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setBanner(null);
              }}
              className={`btn ${tab === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-bg)', color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{banner}</span>
        </div>
      )}

      {tab === 'o-staff-khoa' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">137:7997 · o-staff-khoa / Ca trực của {assignStaffName}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '8px', marginBottom: '14px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Nhân sự</div>
              <div style={{ fontWeight: 700 }}>{assignStaffName} (Staff)</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Suất diễn & Cổng</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{assignGate}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Khung giờ trực</div>
              <div style={{ fontWeight: 700 }}>{assignShiftTime}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Thiết bị & Quyền</div>
              <div style={{ fontWeight: 700, color: 'var(--success)' }}>{assignDevice}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{assignPermission}</div>
            </div>
          </div>
          <button type="button" onClick={() => setTab('o-staff-assign')} className="btn btn-outline" style={{ fontSize: '12px' }}>
            Điều chỉnh ca trực & cổng phụ trách
          </button>
        </div>
      )}

      {tab === 'o-staff-assign' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">1:8905 · o-staff-assign / Phân công Staff cho Đêm 1</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '10px 0 16px' }}>
            <label>
              Nhân viên
              <select
                value={assignStaffName}
                onChange={(e) => setAssignStaffName(e.target.value)}
              >
                <option value="Trần Minh Khoa">Trần Minh Khoa</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cổng phụ trách
              <select value={assignGate} onChange={(e) => setAssignGate(e.target.value)}>
                <option value="Đêm 1 · Cổng G1 (VIP A–C)">Đêm 1 · Cổng G1 (VIP A–C)</option>
                <option value="Đêm 1 · Cổng G2 (Standard D–H)">Đêm 1 · Cổng G2 (Standard D–H)</option>
                <option value="Đêm 2 · Cổng G2 (Khu đứng Bến Sông)">Đêm 2 · Cổng G2 (Khu đứng Bến Sông)</option>
              </select>
            </label>
            <label>
              Ca làm việc
              <input
                type="text"
                value={assignShiftTime}
                onChange={(e) => setAssignShiftTime(e.target.value)}
              />
            </label>
            <label>
              Quyền thao tác
              <select value={assignPermission} onChange={(e) => setAssignPermission(e.target.value)}>
                <option value="Quét vé & tra cứu tại cổng">Quét vé & tra cứu tại cổng</option>
                <option value="Chỉ quét mã QR (Check-in Only)">Chỉ quét mã QR (Check-in Only)</option>
                <option value="Trưởng ca cổng (Override & Check-in)">Trưởng ca cổng (Override & Check-in)</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              const target = staffList.find((s) => s.name.toLowerCase().includes('khoa')) || staffList[0];
              if (target) {
                updateStaff(target.id, {
                  assignment: `${assignGate} (${assignShiftTime})`,
                  status: 'Đang hoạt động',
                });
              }
              setAssignDevice(assignGate.includes('G2') ? 'Scanner G2-01 (Online)' : 'Scanner G1-01 (Online)');
              setTab('o-staff-khoa');
              setBanner(`Đã lưu phân công ca trực "${assignGate}" cho ${assignStaffName} và đồng bộ vào bảng nhân sự!`);
            }}
            className="btn btn-primary"
          >
            Lưu phân công
          </button>
        </div>
      )}

      {tab === 'o-members' && (
        <div>
          <table className="table" style={{ marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Thành viên (1:5540 · o-members)</th>
                <th>Vai trò</th>
                <th>Phạm vi quyền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{m.email}</div>
                  </td>
                  <td>
                    <select
                      value={m.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setMembers((prev) =>
                          prev.map((item) => (item.id === m.id ? { ...item, role: newRole } : item)),
                        );
                        setBanner(`Đã cập nhật vai trò của ${m.name} thành ${newRole}.`);
                      }}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      <option value="Owner">Owner</option>
                      <option value="Event Manager">Event Manager</option>
                      <option value="Finance">Finance</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </td>
                  <td>{m.scope}</td>
                  <td>
                    <span className="badge badge-success">{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg)' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Mời thành viên mới vào Workspace (1:5705 · o-member-add)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px auto', gap: '10px', alignItems: 'end' }}>
              <label>
                Họ và tên
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="VD: Phạm Thanh Hằng"
                />
              </label>
              <label>
                Email công việc
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="hang.pham@anhtrang.vn"
                />
              </label>
              <label>
                Vai trò
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="Event Manager">Event Manager</option>
                  <option value="Finance">Finance</option>
                  <option value="Staff">Staff</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!inviteName.trim() || !inviteEmail.trim()) return;
                  const newMember = {
                    id: `MEM-0${members.length + 1}`,
                    name: inviteName.trim(),
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    scope:
                      inviteRole === 'Finance'
                        ? 'Đối soát & Chi trả doanh thu'
                        : inviteRole === 'Event Manager'
                        ? 'Quản lý sự kiện, sơ đồ ghế, vé mời COMP'
                        : 'Ứng dụng soát vé tại cổng',
                    status: 'Đã gửi lời mời',
                  };
                  setMembers((prev) => [...prev, newMember]);
                  addStaff({
                    name: inviteName.trim(),
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    assignment: 'Cổng G1 · Đêm nhạc Mùa Thu',
                    status: 'Đã gửi lời mời',
                  });
                  setLastInvitedEmail(inviteEmail.trim());
                  setInviteName('');
                  setInviteEmail('');
                  setTab('o-invite-sent');
                  setBanner(`Đã gửi lời mời tham gia workspace tới ${newMember.email}!`);
                }}
                className="btn btn-primary"
              >
                <Plus size={15} /> Gửi lời mời
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'o-invite-sent' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>137:7910 · o-invite-sent / Đã gửi lời mời</div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
              Đã gửi email mời ({lastInvitedEmail}) tham gia workspace Ánh Trăng Events kèm liên kết kích hoạt 2FA.
            </div>
          </div>
          <UserCheck size={24} />
        </div>
      )}
    </div>
  );
}

/**
 * 2. OrgGatesFigmaPanel
 * Frames: o-gate-edit (17:6334), o-gate-g2 (156:9499), o-devices (1:9204),
 *         o-device-g2 (156:9680), o-device-revoke (1:9359)
 */
export function OrgGatesFigmaPanel() {
  const { addDeviceToGate } = useMockStore();
  const [tab, setTab] = useState<'o-gate-edit' | 'o-gate-g2' | 'o-devices' | 'o-device-g2' | 'o-device-revoke'>('o-devices');
  const [revokeReason, setRevokeReason] = useState('Thiết bị G1-02 pin yếu 42%, chuyển sang thiết bị dự phòng G1-03.');
  const [revoked, setRevoked] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Editable gate configurations
  const [g1Config, setG1Config] = useState({
    name: 'Cổng G1',
    zones: 'VIP • Hàng A-C',
    mode: 'Chỉ nhận vé đúng cổng hoặc tất cả cổng',
    status: 'Đang mở',
  });
  const [g2Config, setG2Config] = useState({
    name: 'Cổng G2',
    zones: 'Standard • Hàng D-H & Khu đứng',
    mode: 'Chỉ nhận vé đúng cổng hoặc tất cả cổng',
    status: 'Đang mở',
  });

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="tag-overline">03 / ORGANIZATION · CẤU HÌNH CỔNG G1/G2 & THU HỒI THIẾT BỊ SOÁT VÉ FIGMA</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '20px' }}>
            Chi tiết Cổng G1, Cổng G2, Thiết bị G2-01 & Thu hồi thiết bị G1-02 (o-device-revoke)
          </h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'o-devices', label: 'Thiết bị soát vé (o-devices)' },
              { id: 'o-gate-edit', label: `Cấu hình ${g1Config.name} (o-gate-edit)` },
              { id: 'o-gate-g2', label: `Cấu hình ${g2Config.name} (o-gate-g2)` },
              { id: 'o-device-g2', label: 'Thiết bị G2-01 (o-device-g2)' },
              { id: 'o-device-revoke', label: 'Thu hồi G1-02 (o-device-revoke)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setBanner(null);
              }}
              className={`btn ${tab === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-bg)', color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{banner}</span>
        </div>
      )}

      {tab === 'o-devices' && (
        <table className="table">
          <thead>
            <tr>
              <th>Thiết bị (1:9204 · o-devices)</th>
              <th>Cổng / Đồng bộ</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>Scanner G1-01</td>
              <td>{g1Config.name} ({g1Config.zones}) • Online • Đồng bộ 98%</td>
              <td><span className="badge badge-success">{g1Config.status}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button type="button" onClick={() => setTab('o-gate-edit')} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  Cấu hình {g1Config.name}
                </button>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Scanner G1-02</td>
              <td>{g1Config.name} • Pin 42%</td>
              <td>
                <span className={`badge ${revoked ? 'badge-danger' : 'badge-warning'}`}>
                  {revoked ? 'Đã thu hồi phiên' : 'Cần kiểm tra'}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                {revoked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRevoked(false);
                      setBanner('Đã cấp lại phiên hoạt động cho thiết bị Scanner G1-02.');
                    }}
                    className="btn btn-outline"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                  >
                    Kích hoạt lại G1-02
                  </button>
                ) : (
                  <button type="button" onClick={() => setTab('o-device-revoke')} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--danger)' }}>
                    Thu hồi thiết bị
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Scanner G2-01</td>
              <td>{g2Config.name} • {g2Config.zones} • Đồng bộ 100%</td>
              <td><span className="badge badge-success">{g2Config.status}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button type="button" onClick={() => setTab('o-device-g2')} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  Xem G2-01
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {(tab === 'o-gate-edit' || tab === 'o-gate-g2') && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">
            {tab === 'o-gate-edit' ? '17:6334 · o-gate-edit / Cấu hình cổng G1' : '156:9499 · o-gate-g2 / Cấu hình cổng G2'}
          </span>
          {tab === 'o-gate-edit' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '8px 0 14px' }}>
                <label>
                  Tên cổng
                  <input
                    type="text"
                    value={g1Config.name}
                    onChange={(e) => setG1Config({ ...g1Config, name: e.target.value })}
                  />
                </label>
                <label>
                  Khu vực được phép qua
                  <input
                    type="text"
                    value={g1Config.zones}
                    onChange={(e) => setG1Config({ ...g1Config, zones: e.target.value })}
                  />
                </label>
                <label>
                  Chế độ kiểm tra
                  <select
                    value={g1Config.mode}
                    onChange={(e) => setG1Config({ ...g1Config, mode: e.target.value })}
                  >
                    <option value="Chỉ nhận vé đúng cổng hoặc tất cả cổng">Chỉ nhận vé đúng cổng hoặc tất cả cổng</option>
                    <option value="Bắt buộc đúng khu VIP A-C">Bắt buộc đúng khu VIP A-C</option>
                  </select>
                </label>
                <label>
                  Trạng thái
                  <select
                    value={g1Config.status}
                    onChange={(e) => setG1Config({ ...g1Config, status: e.target.value })}
                  >
                    <option value="Đang mở">Đang mở</option>
                    <option value="Tạm khóa">Tạm khóa</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setBanner(`Đã lưu cấu hình cho ${g1Config.name} (${g1Config.zones})!`)}
                className="btn btn-primary"
              >
                Lưu cấu hình cổng G1
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '8px 0 14px' }}>
                <label>
                  Tên cổng
                  <input
                    type="text"
                    value={g2Config.name}
                    onChange={(e) => setG2Config({ ...g2Config, name: e.target.value })}
                  />
                </label>
                <label>
                  Khu vực được phép qua
                  <input
                    type="text"
                    value={g2Config.zones}
                    onChange={(e) => setG2Config({ ...g2Config, zones: e.target.value })}
                  />
                </label>
                <label>
                  Chế độ kiểm tra
                  <select
                    value={g2Config.mode}
                    onChange={(e) => setG2Config({ ...g2Config, mode: e.target.value })}
                  >
                    <option value="Chỉ nhận vé đúng cổng hoặc tất cả cổng">Chỉ nhận vé đúng cổng hoặc tất cả cổng</option>
                    <option value="Bắt buộc đúng khu Standard & GA">Bắt buộc đúng khu Standard & GA</option>
                  </select>
                </label>
                <label>
                  Trạng thái
                  <select
                    value={g2Config.status}
                    onChange={(e) => setG2Config({ ...g2Config, status: e.target.value })}
                  >
                    <option value="Đang mở">Đang mở</option>
                    <option value="Tạm khóa">Tạm khóa</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setBanner(`Đã lưu cấu hình cho ${g2Config.name} (${g2Config.zones})!`)}
                className="btn btn-primary"
              >
                Lưu cấu hình cổng G2
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'o-device-g2' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="tag-overline">156:9680 · o-device-g2 / Thiết bị G2-01</span>
            <h4 style={{ margin: '4px 0' }}>Thiết bị Scanner G2-01 · {g2Config.name}</h4>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--muted)' }}>
              Đã tải offline danh sách 300 vé Khu đứng & Hàng D–H • Pin 94% • Kết nối ổn định.
            </p>
            <button
              type="button"
              onClick={() =>
                setBanner('Đã đồng bộ lại dữ liệu vé offline (300 vé) xuống thiết bị Scanner G2-01!')
              }
              className="btn btn-outline"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Đồng bộ lại danh sách vé Offline
            </button>
          </div>
          <Smartphone size={28} color="var(--primary)" />
        </div>
      )}

      {tab === 'o-device-revoke' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger)' }}>
          <span className="tag-overline" style={{ color: 'var(--danger)' }}>1:9359 · o-device-revoke / Thu hồi thiết bị G1-02</span>
          <h4 style={{ margin: '4px 0 8px', fontSize: '18px' }}>Thu hồi thiết bị Scanner G1-02 · Cổng G1</h4>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--muted)' }}>
            Thu hồi sẽ hủy phiên làm việc của thiết bị ngay lập tức và cấp thiết bị dự phòng.
          </p>
          <label style={{ marginBottom: '14px' }}>
            Lý do thu hồi
            <input type="text" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setRevoked(true);
                addDeviceToGate('G1', {
                  name: 'Scanner G1-03 (Dự phòng)',
                  staff: 'Trần Minh Khoa',
                  status: 'Online',
                });
                setTab('o-devices');
                setBanner('Đã thu hồi phiên thiết bị G1-02 và kích hoạt máy dự phòng Scanner G1-03 tại Cổng G1!');
              }}
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              Xác nhận thu hồi & Bật máy dự phòng G1-03
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 3. OrgOrdersFigmaPanel
 * Frames: o-order-detail (1:10312), o-comp-import (17:6652),
 *         o-comp-import-review (17:6804), o-comp-import-confirm (17:6980), o-comp-result (156:9277)
 */
interface CompCsvRow {
  id: string;
  name: string;
  email: string;
  seat: string;
}

export function OrgOrdersFigmaPanel() {
  const navigate = useNavigate();
  const { issueCompTicket } = useMockStore();
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<'o-order-detail' | 'o-comp-import' | 'o-comp-import-review' | 'o-comp-import-confirm' | 'o-comp-result'>('o-order-detail');
  const [targetSession, setTargetSession] = useState('Đêm 1 • 24/10/2026');
  const [uploadedFileName, setUploadedFileName] = useState('danh-sach-khach-moi-dem-1.csv');
  const [compRows, setCompRows] = useState<CompCsvRow[]>([
    { id: 'ROW-1', name: 'Trần Thu Hà', email: 'ha@guest.vn', seat: 'A04' },
    { id: 'ROW-2', name: 'Phạm Quốc Bảo', email: 'bao@partner.vn', seat: 'A05' },
    { id: 'ROW-3', name: 'Lê Anh', email: 'email-khong-hop-le', seat: 'A03' },
  ]);
  const [issuedCount, setIssuedCount] = useState(0);
  const [issuedSeatsText, setIssuedSeatsText] = useState('A04, A05');

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validRows = compRows.filter((r) => r.name.trim() && isValidEmail(r.email) && r.seat.trim());
  const invalidRows = compRows.filter((r) => !r.name.trim() || !isValidEmail(r.email) || !r.seat.trim());

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setUploadedFileName(f.name);
          }
          e.target.value = '';
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="tag-overline">03 / ORGANIZATION · CHI TIẾT ĐƠN TK-1024 & LUỒNG IMPORT VÉ MỜI CSV FIGMA</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '20px' }}>
            Chi tiết đơn TK-1024 (o-order-detail) & Kiểm tra danh sách vé mời CSV (o-comp-import-review)
          </h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'o-order-detail', label: 'Đơn TK-1024 (o-order-detail)' },
              { id: 'o-comp-import', label: '1. Nhập CSV (o-comp-import)' },
              { id: 'o-comp-import-review', label: `2. Kiểm tra CSV (${validRows.length}/${compRows.length} hợp lệ)` },
              { id: 'o-comp-import-confirm', label: '3. Xác nhận phát (o-comp-import-confirm)' },
              { id: 'o-comp-result', label: '4. Kết quả COMP (o-comp-result)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`btn ${step === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {step === 'o-order-detail' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">1:10312 · o-order-detail / Đơn TK-1024</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '10px 0 16px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Khách hàng</div>
              <div style={{ fontWeight: 700 }}>Nguyễn Minh Anh • minhanh@email.com</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Vé trong đơn</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>A01 • A02 · VIP</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Thanh toán</div>
              <div style={{ fontWeight: 700, color: 'var(--success)' }}>700.000đ • Thành công</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Lịch sử hoàn tiền</div>
              <div style={{ fontWeight: 700 }}>Chưa có yêu cầu</div>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/org/reports')} className="btn btn-primary">
            Yêu cầu hoàn tiền (Chuyển sang RF-024)
          </button>
        </div>
      )}

      {step === 'o-comp-import' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">17:6652 · o-comp-import / Nhập danh sách vé mời CSV</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', margin: '10px 0 16px' }}>
            <label>
              Suất diễn áp dụng
              <select value={targetSession} onChange={(e) => setTargetSession(e.target.value)}>
                <option value="Đêm 1 • 24/10/2026">Đêm 1 • 24/10/2026 (Nhà hát Ánh Trăng)</option>
                <option value="Đêm 2 • 25/10/2026">Đêm 2 • 25/10/2026 (Sân khấu Bến Sông)</option>
              </select>
            </label>
            <label>
              Định dạng cột CSV
              <input
                type="text"
                value="Họ tên, email, khu hoặc ghế, ghi chú"
                disabled
              />
            </label>
          </div>
          <div
            onClick={() => csvFileInputRef.current?.click()}
            style={{
              padding: '14px',
              border: '1px dashed var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface)',
              marginBottom: '16px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Upload size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Đã chọn file: <strong>{uploadedFileName}</strong> ({compRows.length} dòng dữ liệu)
            </div>
            <span className="badge badge-info">Nhấn để chọn file CSV khác</span>
          </div>
          <button type="button" onClick={() => setStep('o-comp-import-review')} className="btn btn-primary">
            Kiểm tra danh sách ({compRows.length} dòng)
          </button>
        </div>
      )}

      {step === 'o-comp-import-review' && (
        <div>
          <span className="tag-overline">17:6804 · o-comp-import-review / Kiểm tra & sửa trực tiếp danh sách vé mời</span>
          <p style={{ margin: '4px 0 10px', fontSize: '13px', color: 'var(--muted)' }}>
            Bạn có thể sửa trực tiếp email hoặc mã ghế bị lỗi bên dưới để chuyển trạng thái từ <strong>Cần sửa</strong> sang <strong>Hợp lệ</strong>:
          </p>
          <table className="table" style={{ marginTop: '8px', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Khách mời</th>
                <th>Email nhận mã QR</th>
                <th>Ghế / Khu</th>
                <th>Kết quả kiểm tra</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {compRows.map((row) => {
                const valid = Boolean(row.name.trim() && isValidEmail(row.email) && row.seat.trim());
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          setCompRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                          )
                        }
                        style={{ padding: '5px 8px', fontSize: '13px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) =>
                          setCompRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, email: e.target.value } : r)),
                          )
                        }
                        style={{
                          padding: '5px 8px',
                          fontSize: '13px',
                          borderColor: isValidEmail(row.email) ? 'var(--border)' : 'var(--danger)',
                        }}
                      />
                    </td>
                    <td style={{ maxWidth: '110px' }}>
                      <input
                        type="text"
                        value={row.seat}
                        onChange={(e) =>
                          setCompRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, seat: e.target.value } : r)),
                          )
                        }
                        style={{ padding: '5px 8px', fontSize: '13px' }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${valid ? 'badge-success' : 'badge-danger'}`}>
                        {valid ? 'Hợp lệ' : 'Cần sửa email'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!valid && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, email: 'leanh@guest.vn' } : r,
                              ),
                            )
                          }
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}
                        >
                          Sửa nhanh Email
                        </button>
                      )}
                      {compRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCompRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={() => setStep('o-comp-import-confirm')}
              className="btn btn-primary"
            >
              Phát hành các dòng hợp lệ ({validRows.length} khách)
            </button>
            <button
              type="button"
              onClick={() =>
                setCompRows((prev) => [
                  ...prev,
                  {
                    id: `ROW-${Date.now()}`,
                    name: 'Khách mời VIP Mới',
                    email: `vip${prev.length + 1}@partner.vn`,
                    seat: `A0${prev.length + 4}`,
                  },
                ])
              }
              className="btn btn-outline"
            >
              <Plus size={14} /> Thêm dòng khách mời
            </button>
            <button type="button" onClick={() => setStep('o-comp-import')} className="btn btn-outline">
              Quay lại chọn file CSV
            </button>
          </div>
        </div>
      )}

      {step === 'o-comp-import-confirm' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">17:6980 · o-comp-import-confirm / Xác nhận phát {validRows.length} vé mời</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '10px 0 16px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Hợp lệ</div>
              <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                {validRows.length} khách mời ({validRows.map((r) => r.seat).join(', ')})
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Bỏ qua</div>
              <div style={{ fontWeight: 700, color: 'var(--danger)' }}>
                {invalidRows.length} dòng lỗi không được tạo vé
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Kênh gửi</div>
              <div style={{ fontWeight: 700 }}>Gửi vé QR qua email đã kiểm tra</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              validRows.forEach((r) => {
                issueCompTicket({
                  customer: r.name.trim(),
                  email: r.email.trim(),
                  event: `Đêm nhạc Mùa Thu (${targetSession})`,
                  tier: `Vé mời COMP · Ghế ${r.seat.trim()}`,
                  quantity: 1,
                  note: 'Import CSV',
                });
              });
              setIssuedCount(validRows.length);
              setIssuedSeatsText(validRows.map((r) => r.seat).join(', '));
              setStep('o-comp-result');
            }}
            className="btn btn-primary"
          >
            Xác nhận phát hành ({validRows.length} vé COMP vào danh sách Đơn hàng)
          </button>
        </div>
      )}

      {step === 'o-comp-result' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>156:9277 · o-comp-result / Kết quả cấp vé mời</div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
              Đã phát hành {issuedCount || validRows.length} vé mời COMP (Ghế {issuedSeatsText}) vào bảng Đơn hàng bên trên và gửi mã QR vào email khách mời thành công!
            </div>
          </div>
          <FileSpreadsheet size={24} />
        </div>
      )}
    </div>
  );
}

/**
 * 4. OrgFinanceFigmaPanel
 * Frames: o-settlements (1:10674), o-payouts (1:10829),
 *         o-bank (1:10971), o-bank-mfa (17:7115), o-bank-pending (17:7255)
 */
export function OrgFinanceFigmaPanel() {
  const { requestPayout } = useMockStore();
  const [tab, setTab] = useState<'o-settlements' | 'o-payouts' | 'o-bank' | 'o-bank-mfa' | 'o-bank-pending'>('o-settlements');
  const [bankName, setBankName] = useState('Vietcombank - CN Nam Sài Gòn');
  const [bankAccount, setBankAccount] = useState('0071009876789');
  const [bankHolder, setBankHolder] = useState('CÔNG TY TNHH TỔ CHỨC SỰ KIỆN ÁNH TRĂNG');
  const [otp, setOtp] = useState('482910');
  const [cooldownDone, setCooldownDone] = useState(false);
  const [st009Requested, setSt009Requested] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const maskedAccount = `••••${bankAccount.slice(-4)}`;

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="tag-overline">03 / ORGANIZATION · ĐỐI SOÁT SUẤT DIỄN, LỊCH SỬ PO-014 & ĐỔI TÀI KHOẢN NGÂN HÀNG 2FA FIGMA</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '20px' }}>
            Đối soát ST-009 (o-settlements), Chi trả PO-014 (o-payouts) & Đổi tài khoản + Cooldown 72h (o-bank)
          </h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'o-settlements', label: 'Đối soát theo suất (o-settlements)' },
              { id: 'o-payouts', label: 'Lịch sử PO-014 (o-payouts)' },
              { id: 'o-bank', label: 'Đổi TK nhận tiền (o-bank)' },
              { id: 'o-bank-mfa', label: 'Xác thực 2FA TK (o-bank-mfa)' },
              { id: 'o-bank-pending', label: 'Cooldown 72h (o-bank-pending)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setBanner(null);
              }}
              className={`btn ${tab === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-bg)', color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{banner}</span>
        </div>
      )}

      {tab === 'o-settlements' && (
        <table className="table">
          <thead>
            <tr>
              <th>Suất diễn (1:10674 · o-settlements)</th>
              <th>Doanh thu / Phí / Thực nhận</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>ST-009 · 18/10/2026</td>
              <td>Tổng 15.700.000đ · Phí 785.000đ · Thực nhận 14.915.000đ</td>
              <td>
                <span className={`badge ${st009Requested ? 'badge-info' : 'badge-success'}`}>
                  {st009Requested ? 'Đã tạo lệnh rút' : 'Sẵn sàng chi trả'}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {!st009Requested && (
                    <button
                      type="button"
                      onClick={() => {
                        const created = requestPayout({
                          amount: 15700000,
                          bankName,
                          accountNumber: bankAccount,
                          accountHolder: bankHolder,
                          eventName: 'Đối soát ST-009 · 18/10/2026',
                        });
                        setSt009Requested(true);
                        setBanner(`Đã khởi tạo lệnh chi trả ${created.id} (14.915.000đ) vào bảng Lịch sử giải ngân!`);
                      }}
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                    >
                      Tạo lệnh rút ST-009
                    </button>
                  )}
                  <button type="button" onClick={() => setTab('o-payouts')} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }}>
                    Xem lịch sử chi trả
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Đêm 1 · 24/10/2026</td>
              <td>Tổng 23.400.000đ · Phí 1.170.000đ · Tạm giữ 22.230.000đ</td>
              <td><span className="badge badge-warning">Trong thời gian chờ</span></td>
              <td style={{ textAlign: 'right' }}>
                <span className="text-muted" style={{ fontSize: '12px' }}>Mở đối soát 25/10/2026</span>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {tab === 'o-payouts' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="tag-overline">1:10829 · o-payouts / Lịch sử chi trả</span>
            <h4 style={{ margin: '4px 0' }}>
              PO-014 · 14.915.000đ · {bankName.split('-')[0].trim()} {maskedAccount}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Trạng thái: <strong>Chờ duyệt (Phiếu AP-014 tại Platform Admin)</strong>
            </p>
          </div>
          <button type="button" onClick={() => setTab('o-bank')} className="btn btn-primary">
            Cập nhật tài khoản nhận tiền
          </button>
        </div>
      )}

      {tab === 'o-bank' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">1:10971 · o-bank / Tài khoản nhận doanh thu</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '10px 0 14px' }}>
            <label>
              Tên ngân hàng
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </label>
            <label>
              Số tài khoản
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
            </label>
            <label>
              Chủ tài khoản (Trùng tên pháp lý)
              <input
                type="text"
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
              />
            </label>
          </div>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
            Khi đổi tài khoản nhận tiền, lệnh chi trả mới sẽ chờ xác minh và hết thời gian chờ 72 giờ.
          </div>
          <button type="button" onClick={() => setTab('o-bank-mfa')} className="btn btn-primary">
            <KeyRound size={15} /> Xác thực 2FA và gửi duyệt
          </button>
        </div>
      )}

      {tab === 'o-bank-mfa' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">17:7115 · o-bank-mfa / Xác thực thay đổi tài khoản nhận tiền</span>
          <h4 style={{ margin: '4px 0 10px' }}>Nhập mã 6 chữ số từ ứng dụng xác thực để gửi yêu cầu đổi tài khoản</h4>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ maxWidth: '220px', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.15em' }}
            />
            <button
              type="button"
              onClick={() => {
                setCooldownDone(false);
                setTab('o-bank-pending');
                setBanner(`Đã xác thực 2FA (Mã ${otp}) và lưu yêu cầu đổi sang ${bankName} (${maskedAccount}).`);
              }}
              className="btn btn-primary"
            >
              Xác nhận và gửi Admin duyệt
            </button>
          </div>
        </div>
      )}

      {tab === 'o-bank-pending' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">17:7255 · o-bank-pending / Đã gửi yêu cầu đổi tài khoản</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '10px 0 14px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Tài khoản mới</div>
              <div style={{ fontWeight: 700 }}>
                {bankName.split('-')[0].trim()} {maskedAccount}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{bankHolder}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Trạng thái</div>
              <div style={{ fontWeight: 700, color: cooldownDone ? 'var(--success)' : 'var(--warning)' }}>
                {cooldownDone ? 'Đã xác minh & Kích hoạt' : 'Chờ Admin xác minh'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Cooldown</div>
              <div style={{ fontWeight: 700, color: cooldownDone ? 'var(--success)' : 'var(--primary)' }}>
                {cooldownDone ? '0 giờ (Đã mở khóa chi trả)' : '72 giờ trước khi mở lại chi trả'}
              </div>
            </div>
          </div>
          {!cooldownDone && (
            <button
              type="button"
              onClick={() => {
                setCooldownDone(true);
                setBanner('Đã hoàn tất xác minh và kết thúc Cooldown 72 giờ. Tài khoản ngân hàng mới đã sẵn sàng nhận chi trả!');
              }}
              className="btn btn-outline"
              style={{ fontSize: '12px' }}
            >
              Mô phỏng: Hoàn tất xác minh & Kết thúc Cooldown 72h
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 5. OrgReportsFigmaPanel
 * Frames: o-dispute-response (1:11530), o-refunds (140:8493), o-refund-review (140:8580),
 *         o-refund-outcome (140:8667), o-refund-policy (140:9131),
 *         o-empty (1:16318), o-error (1:16448), o-forbidden (1:16578), o-loading (1:16706)
 */
interface RefundItem {
  id: string;
  orderCode: string;
  customer: string;
  seats: string;
  amount: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function OrgReportsFigmaPanel() {
  const [tab, setTab] = useState<'o-refunds' | 'o-refund-review' | 'o-refund-outcome' | 'o-refund-policy' | 'system-states'>('o-refunds');
  const [sysState, setSysState] = useState<'o-empty' | 'o-error' | 'o-forbidden' | 'o-loading'>('o-empty');
  const [banner, setBanner] = useState<string | null>(null);

  const [refunds, setRefunds] = useState<RefundItem[]>([
    {
      id: 'RF-024',
      orderCode: 'TK-1024',
      customer: 'Nguyễn Minh Anh',
      seats: '2 vé VIP A01, A02',
      amount: '700.000đ',
      reason: 'Khách yêu cầu hoàn vé trước giờ diễn 5 ngày',
      status: 'PENDING',
    },
    {
      id: 'RF-025',
      orderCode: 'TK-1025',
      customer: 'Lê Thị Mai',
      seats: '1 vé Standard D04',
      amount: '450.000đ',
      reason: 'Bận công tác đột xuất, xin hoàn theo mức 70%',
      status: 'PENDING',
    },
  ]);
  const [selectedRefundId, setSelectedRefundId] = useState('RF-024');
  const currentRefund = refunds.find((r) => r.id === selectedRefundId) || refunds[0];

  const [policyRules, setPolicyRules] = useState([
    { id: 'POL-1', rate: 100, desc: 'Khi suất diễn bị hủy hoặc dời lịch chính thức' },
    { id: 'POL-2', rate: 70, desc: 'Yêu cầu gửi trước giờ mở màn tối thiểu 72 giờ' },
    { id: 'POL-3', rate: 0, desc: 'Trong vòng 24 giờ trước giờ diễn hoặc vé đã check-in' },
  ]);

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="tag-overline">03 / ORGANIZATION · YÊU CẦU HOÀN TIỀN RF-024, CHÍNH SÁCH HOÀN & TRẠNG THÁI GIAO DIỆN FIGMA</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '20px' }}>
            Hoàn tiền khách hàng (o-refunds · {currentRefund.id}), Chính sách hoàn tiền (o-refund-policy) & 4 trạng thái hệ thống
          </h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'o-refunds', label: `Yêu cầu hoàn tiền (${refunds.filter((r) => r.status === 'PENDING').length} chờ)` },
              { id: 'o-refund-review', label: `Duyệt ${currentRefund.id} (o-refund-review)` },
              { id: 'o-refund-outcome', label: `Kết quả ${currentRefund.id} (o-refund-outcome)` },
              { id: 'o-refund-policy', label: 'Chính sách hoàn theo suất (o-refund-policy)' },
              { id: 'system-states', label: 'Trạng thái UI (o-empty / error / forbidden / loading)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setBanner(null);
              }}
              className={`btn ${tab === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-bg)', color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{banner}</span>
        </div>
      )}

      {tab === 'o-refunds' && (
        <table className="table">
          <thead>
            <tr>
              <th>Mã yêu cầu (140:8493 · o-refunds)</th>
              <th>Đơn hàng & Khách</th>
              <th>Số tiền / Lý do</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((rf) => (
              <tr key={rf.id}>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{rf.id}</td>
                <td>{rf.orderCode} · {rf.customer} ({rf.seats})</td>
                <td>{rf.amount} · {rf.reason}</td>
                <td>
                  <span
                    className={`badge ${
                      rf.status === 'APPROVED'
                        ? 'badge-success'
                        : rf.status === 'REJECTED'
                        ? 'badge-danger'
                        : 'badge-warning'
                    }`}
                  >
                    {rf.status === 'APPROVED'
                      ? 'Đã chấp thuận hoàn'
                      : rf.status === 'REJECTED'
                      ? 'Đã từ chối'
                      : 'Chờ Org xem xét'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRefundId(rf.id);
                      setTab('o-refund-review');
                    }}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    {rf.status === 'PENDING' ? `Duyệt ${rf.id}` : `Xem ${rf.id}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'o-refund-review' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">140:8580 · o-refund-review / Duyệt {currentRefund.id}</span>
          <h4 style={{ margin: '4px 0 10px' }}>
            Kiểm tra yêu cầu hoàn tiền {currentRefund.id} · Đơn {currentRefund.orderCode} ({currentRefund.amount})
          </h4>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted)' }}>
            Khách hàng: <strong>{currentRefund.customer}</strong> ({currentRefund.seats}) — Lý do: {currentRefund.reason}. Vé chưa sử dụng check-in tại cổng G1. Sau khi chấp thuận hoàn tiền, mã QR sẽ bị hủy hiệu lực và ghế được trả về trạng thái mở bán.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setRefunds((prev) =>
                  prev.map((r) => (r.id === currentRefund.id ? { ...r, status: 'APPROVED' } : r)),
                );
                setTab('o-refund-outcome');
                setBanner(`Đã phê duyệt yêu cầu hoàn tiền ${currentRefund.id} (${currentRefund.amount})!`);
              }}
              className="btn btn-primary"
            >
              <RotateCcw size={15} /> Chấp thuận hoàn tiền {currentRefund.id}
            </button>
            <button
              type="button"
              onClick={() => {
                setRefunds((prev) =>
                  prev.map((r) => (r.id === currentRefund.id ? { ...r, status: 'REJECTED' } : r)),
                );
                setTab('o-refunds');
                setBanner(`Đã từ chối yêu cầu hoàn tiền ${currentRefund.id}.`);
              }}
              className="btn btn-outline"
              style={{ color: 'var(--danger)' }}
            >
              Từ chối yêu cầu
            </button>
            <button type="button" onClick={() => setTab('o-refund-policy')} className="btn btn-outline">
              Xem chính sách hoàn tiền
            </button>
          </div>
        </div>
      )}

      {tab === 'o-refund-outcome' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>140:8667 · o-refund-outcome / Kết quả hoàn tiền</div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
              Đã phê duyệt yêu cầu hoàn tiền {currentRefund.id} ({currentRefund.amount} · {currentRefund.customer}) và chuyển lệnh hoàn sang bộ phận Tài chính nền tảng.
            </div>
          </div>
          <CheckCircle2 size={24} />
        </div>
      )}

      {tab === 'o-refund-policy' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">140:9131 · o-refund-policy / Chính sách hoàn tiền theo suất</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '10px 0 14px' }}>
            {policyRules.map((rule) => (
              <div key={rule.id} className="card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        rule.rate === 100
                          ? 'var(--success)'
                          : rule.rate > 0
                          ? 'var(--warning)'
                          : 'var(--danger)',
                    }}
                  >
                    Hoàn {rule.rate}%
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.rate}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                      setPolicyRules((prev) =>
                        prev.map((p) => (p.id === rule.id ? { ...p, rate: val } : p)),
                      );
                    }}
                    style={{ maxWidth: '75px', padding: '3px 6px', fontSize: '12px' }}
                  />
                </div>
                <input
                  type="text"
                  value={rule.desc}
                  onChange={(e) =>
                    setPolicyRules((prev) =>
                      prev.map((p) => (p.id === rule.id ? { ...p, desc: e.target.value } : p)),
                    )
                  }
                  style={{ fontSize: '12px', padding: '5px 8px' }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBanner('Đã lưu cập nhật tỷ lệ chính sách hoàn tiền theo suất diễn!')}
            className="btn btn-primary"
          >
            Lưu chính sách hoàn tiền
          </button>
        </div>
      )}

      {tab === 'system-states' && (
        <div style={{ padding: '18px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'o-empty', label: 'Trạng thái trống (1:16318 · o-empty)' },
                { id: 'o-error', label: 'Trạng thái lỗi (1:16448 · o-error)' },
                { id: 'o-forbidden', label: 'Không đủ quyền (1:16578 · o-forbidden)' },
                { id: 'o-loading', label: 'Đang tải dữ liệu (1:16706 · o-loading)' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSysState(s.id)}
                className={`btn ${sysState === s.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '5px 10px', fontSize: '11px' }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {sysState === 'o-empty' && (
            <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
              <Landmark size={28} color="var(--muted)" />
              <h4 style={{ margin: '8px 0 4px' }}>Chưa có dữ liệu trong mục này (o-empty · 1:16318)</h4>
              <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
                Bắt đầu tạo bản ghi đầu tiên hoặc thay đổi bộ lọc tìm kiếm.
              </p>
              <button type="button" onClick={() => setTab('o-refunds')} className="btn btn-primary" style={{ fontSize: '12px' }}>
                Quay về danh sách Hoàn tiền ({refunds.length})
              </button>
            </div>
          )}

          {sysState === 'o-error' && (
            <div className="card" style={{ textAlign: 'center', padding: '28px', borderColor: 'var(--danger)' }}>
              <AlertTriangle size={28} color="var(--danger)" />
              <h4 style={{ margin: '8px 0 4px', color: 'var(--danger)' }}>Không thể tải dữ liệu (o-error · 1:16448)</h4>
              <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
                Kết nối tạm thời gián đoạn. Vui lòng thử tải lại trang.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab('o-refunds');
                  setBanner('Đã kết nối lại máy chủ và đồng bộ thành công danh sách hoàn tiền!');
                }}
                className="btn btn-primary"
                style={{ fontSize: '12px' }}
              >
                Thử tải lại ngay
              </button>
            </div>
          )}

          {sysState === 'o-forbidden' && (
            <div className="card" style={{ textAlign: 'center', padding: '28px', borderColor: 'var(--warning)' }}>
              <ShieldAlert size={28} color="var(--warning)" />
              <h4 style={{ margin: '8px 0 4px' }}>Không đủ quyền thao tác (o-forbidden · 1:16578)</h4>
              <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
                Tài khoản hiện tại không có quyền truy cập mục này trong workspace đã chọn.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab('o-refunds');
                  setBanner('Đã xác nhận quyền Organization Owner và mở khóa thao tác.');
                }}
                className="btn btn-outline"
                style={{ fontSize: '12px' }}
              >
                Xác nhận quyền Owner & Mở khóa
              </button>
            </div>
          )}

          {sysState === 'o-loading' && (
            <div className="card" style={{ textAlign: 'center', padding: '28px' }}>
              <Clock size={28} color="var(--info)" />
              <h4 style={{ margin: '8px 0 4px' }}>Đang tải dữ liệu workspace... (o-loading · 1:16706)</h4>
              <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
                Đang đồng bộ trạng thái vé, cổng soát vé và số dư đối soát.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab('o-refunds');
                  setBanner('Đồng bộ hoàn tất!');
                }}
                className="btn btn-outline"
                style={{ fontSize: '12px' }}
              >
                Hoàn tất đồng bộ ngay
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
