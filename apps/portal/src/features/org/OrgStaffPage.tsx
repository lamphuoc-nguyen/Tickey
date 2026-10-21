import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import {
  FigmaPageHeader,
  FigmaRecordInfoCard,
  FigmaEventPreviewCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const STAFF_SCREENS: FigmaScreenOption[] = [
  { id: 'o-members', label: 'Thành viên tổ chức' },
  { id: 'o-member-add', label: 'Thêm nhân sự mới' },
  { id: 'o-invite-sent', label: 'Đã thêm thành viên' },
  { id: 'o-staff', label: 'Nhân sự sự kiện' },
  { id: 'o-staff-assign', label: 'Phân công nhân sự cổng' },
  { id: 'o-staff-khoa', label: 'Phân công · Lê Minh Khoa' },
];

export function OrgStaffPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, inviteMember, assignStaffShift } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-members';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Check-in Staff · Nhân sự soát vé');
  const [staffActiveNow, setStaffActiveNow] = useState(true);

  // Extract all sessions from existing events in data
  const allEventSessions = (state?.events || []).flatMap((ev) => {
    if (!ev.sessions || ev.sessions.length === 0) {
      return [
        {
          id: `${ev.id}-default`,
          eventId: ev.id,
          eventName: ev.name,
          sessionName: 'Suất chính',
          display: `${ev.name} · Suất chính`,
          time: '19:00 – 22:30',
          gates: 'Cổng chính G1, Cổng phụ G2',
          poster: ev.poster,
          venueName: ev.venueName,
        },
      ];
    }
    return ev.sessions.map((sess) => ({
      id: `${ev.id}-${sess.id}`,
      eventId: ev.id,
      eventName: ev.name,
      sessionName: sess.name,
      display: `${ev.name} · ${sess.name}`,
      time: sess.time || '18:30 – 22:30',
      gates: sess.gates || 'Cổng chính G1, Cổng VIP G2',
      poster: ev.poster,
      venueName: ev.venueName,
    }));
  });

  const [selectedSessionKey, setSelectedSessionKey] = useState<string>(
    allEventSessions[0]?.id || '',
  );

  const activeSessionObj =
    allEventSessions.find((s) => s.id === selectedSessionKey) || allEventSessions[0];

  const [assignMember, setAssignMember] = useState(
    state.members[0] ? `${state.members[0].name} (${state.members[0].role})` : 'Trần Quốc Bảo (Staff)',
  );
  const [assignSession, setAssignSession] = useState(
    activeSessionObj ? activeSessionObj.display : 'Đêm nhạc Mùa Thu · Đêm 1 (24/10)',
  );
  const [assignGate, setAssignGate] = useState('Cổng chính G1');
  const [shiftStart, setShiftStart] = useState('18:30');
  const [shiftEnd, setShiftEnd] = useState('22:30');
  const [assignShift, setAssignShift] = useState('18:30 – 22:30');

  const updateShiftTimes = (start: string, end: string, label?: string) => {
    setShiftStart(start);
    setShiftEnd(end);
    setAssignShift(label || `${start} – ${end}`);
  };

  const [khoaGate, setKhoaGate] = useState('Cổng phụ G2 · VIP');
  const [khoaShift, setKhoaShift] = useState('18:30 – 22:30 (Cả 2 đêm)');

  const screenMeta = STAFF_SCREENS.find((s) => s.id === activeScreen) || STAFF_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={STAFF_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-members */}
      {activeScreen === 'o-members' && (
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
                onClick={() => setScreen('o-staff')}
              >
                Nhân sự sự kiện
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => showToast('Đã xuất danh sách thành viên ra CSV.', 'success')}
              >
                Xuất CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setInviteName('');
                  setInviteEmail('');
                  setInviteRole('Check-in Staff · Nhân sự soát vé');
                  setStaffActiveNow(true);
                  setScreen('o-member-add');
                }}
              >
                + Thêm nhân sự
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
                {state.members.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>THÀNH VIÊN</th>
                    <th>EMAIL</th>
                    <th>VAI TRÒ</th>
                    <th>PHẠM VI</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.members.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>{m.name}</td>
                      <td>{m.email}</td>
                      <td>{m.role}</td>
                      <td>{m.scope}</td>
                      <td>
                        <span
                          className={`badge ${
                            m.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {m.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã gửi lời mời'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setScreen(m.name.includes('Khoa') ? 'o-staff-khoa' : 'o-staff-assign')
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Phân quyền →
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

      {/* 2. o-member-add */}
      {activeScreen === 'o-member-add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thêm nhân sự mới vào tổ chức
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Họ và tên nhân sự</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Nguyễn Văn Hoàng"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email tài khoản</label>
                <input
                  className="form-input"
                  placeholder="hoang.nguyen@anhtrangevents.vn"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Vai trò trong tổ chức</label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="Check-in Staff · Nhân sự soát vé">Check-in Staff · Nhân sự soát vé</option>
                  <option value="Event Manager · Quản lý sự kiện">Event Manager · Quản lý sự kiện</option>
                  <option value="Finance · Kế toán đối soát">Finance · Kế toán đối soát</option>
                </select>
              </div>
              <div>
                <label className="form-label">Trạng thái kích hoạt</label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13.5,
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: staffActiveNow ? '#F0F9F4' : '#FFFFFF',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={staffActiveNow}
                    onChange={(e) => setStaffActiveNow(e.target.checked)}
                  />
                  <span>
                    <strong>Kích hoạt và cho phép làm việc ngay</strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Nhân sự được cấp quyền làm việc trực tiếp, sẵn sàng phân công cổng soát vé.
                    </span>
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!inviteName.trim()) {
                      showToast('Vui lòng nhập họ tên nhân sự.', 'warning');
                      return;
                    }
                    const email =
                      inviteEmail.trim() ||
                      `${inviteName.toLowerCase().replace(/\s+/g, '')}@anhtrangevents.vn`;
                    inviteMember({
                      name: inviteName,
                      email,
                      role: inviteRole.split(' · ')[0],
                      scope: 'Toàn bộ sự kiện',
                      status: staffActiveNow ? 'ACTIVE' : 'INVITED',
                    });
                    showToast(
                      `Đã thêm nhân sự "${inviteName}" vào tổ chức (${staffActiveNow ? 'Đang hoạt động' : 'Đã gửi lời mời'}).`,
                      'success',
                    );
                    setScreen('o-members');
                  }}
                >
                  Thêm & kích hoạt nhân sự
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-members')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 3. o-invite-sent */}
      {activeScreen === 'o-invite-sent' && (
        <div
          className="card"
          style={{
            padding: '54px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: '#EAF7F0',
              color: '#18794E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Đã gửi lời mời thành viên
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}>
            Liên kết kích hoạt quyền truy cập đã được gửi tới {inviteEmail} (hiệu lực trong 48 giờ).
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            Invited · {inviteRole.split(' · ')[0]}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('o-members')}>
            Danh sách thành viên
          </button>
        </div>
      )}

      {/* 4. o-staff */}
      {activeScreen === 'o-staff' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-members')}
            >
              ← Thành viên tổ chức
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-staff-assign')}
            >
              + Phân công ca trực
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
                Nhân sự vận hành · Đêm nhạc Mùa Thu
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.staffAssignments.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>NHÂN SỰ</th>
                    <th>SUẤT DIỄN</th>
                    <th>CỔNG PHỤ TRÁCH</th>
                    <th>CA TRỰC</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.staffAssignments.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.staffName}</td>
                      <td>{s.sessionName}</td>
                      <td>{s.gateName}</td>
                      <td>{s.shift}</td>
                      <td>
                        <span className="badge badge-success">Sẵn sàng</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setScreen(
                              s.staffName.includes('Khoa') ? 'o-staff-khoa' : 'o-staff-assign',
                            )
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Đổi ca →
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

      {/* 5. o-staff-assign */}
      {activeScreen === 'o-staff-assign' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phân công cổng
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1. CHỌN NHÂN SỰ */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  👤 Nhân sự phụ trách
                </label>
                <select
                  className="form-select"
                  value={assignMember}
                  onChange={(e) => setAssignMember(e.target.value)}
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={`${m.name} (${m.role})`}>
                      {m.name} ({m.role}) · {m.scope}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. CHỌN SUẤT DIỄN TỪ DATA SỰ KIỆN */}
              <div
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  background: '#F8FAFC',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    🎪 Chọn Sự kiện & Suất diễn trong Data
                  </label>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '2px 8px', borderRadius: 4 }}>
                    {allEventSessions.length} suất diễn sẵn sàng
                  </span>
                </div>
                <select
                  className="form-select"
                  value={selectedSessionKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedSessionKey(key);
                    const chosen = allEventSessions.find((s) => s.id === key);
                    if (chosen) {
                      setAssignSession(chosen.display);
                      if (chosen.gates) {
                        const firstGate = chosen.gates.split(',')[0]?.trim();
                        if (firstGate) setAssignGate(firstGate);
                      }
                      if (chosen.time) {
                        setAssignShift(`18:30 – 22:30 (Trực theo suất: ${chosen.time})`);
                      }
                    }
                  }}
                  style={{ fontWeight: 600 }}
                >
                  {allEventSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.eventName} ➔ {s.sessionName} {s.time ? `(${s.time})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📍 Địa điểm: <strong>{activeSessionObj?.venueName || 'Chưa định'}</strong></span>
                  <span>·</span>
                  <span>⏰ Giờ diễn: <strong>{activeSessionObj?.time || 'Chưa định'}</strong></span>
                </div>
              </div>

              {/* 3. CHỌN CỔNG SOÁT VÉ */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  🚪 Cổng soát vé
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {Array.from(
                    new Set([
                      ...(activeSessionObj?.gates || 'Cổng chính G1, Cổng VIP G2')
                        .split(',')
                        .map((g) => g.trim()),
                      'Cổng chính G1',
                      'Cổng phụ G2',
                      'Cổng VIP',
                      'Cổng Sảnh A',
                      'Cổng Sảnh B',
                    ]),
                  )
                    .filter(Boolean)
                    .map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setAssignGate(g)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 16,
                          border: assignGate === g ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                          background: assignGate === g ? '#FDF0EC' : '#FFFFFF',
                          color: assignGate === g ? 'var(--brand)' : 'var(--ink)',
                          fontWeight: assignGate === g ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {assignGate === g ? '✓ ' : '+ '} {g}
                      </button>
                    ))}
                </div>
                <input
                  className="form-input"
                  value={assignGate}
                  onChange={(e) => setAssignGate(e.target.value)}
                  placeholder="Chọn từ gợi ý trên hoặc tự nhập tên cổng..."
                />
              </div>

              {/* 4. KHUNG GIỜ CA TRỰC (CHỌN GIỜ TRỰC TIẾP QUA PICKER & NÚT GỢI Ý) */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: '#FAF9F6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏰ Chọn khung giờ ca trực
                  </label>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--brand)',
                      background: '#FDF0EC',
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid #F9C3B4',
                    }}
                  >
                    ✓ {assignShift || `${shiftStart} – ${shiftEnd}`}
                  </span>
                </div>

                {/* 2 time inputs: Start and End */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Giờ bắt đầu ca
                    </span>
                    <input
                      type="time"
                      className="form-input"
                      value={shiftStart}
                      onChange={(e) => updateShiftTimes(e.target.value, shiftEnd)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Giờ kết thúc ca
                    </span>
                    <input
                      type="time"
                      className="form-input"
                      value={shiftEnd}
                      onChange={(e) => updateShiftTimes(shiftStart, e.target.value)}
                    />
                  </div>
                </div>

                {/* Quick preset chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Chọn ca nhanh:</span>
                  {[
                    { label: 'Ca chính (18:30 – 22:30)', start: '18:30', end: '22:30' },
                    { label: 'Mở sớm (17:30 – 23:00)', start: '17:30', end: '23:00' },
                    { label: 'Suất tối (19:00 – 22:00)', start: '19:00', end: '22:00' },
                    { label: 'Ca ngày (08:00 – 17:00)', start: '08:00', end: '17:00' },
                  ].map((p) => {
                    const isMatch = shiftStart === p.start && shiftEnd === p.end;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => updateShiftTimes(p.start, p.end, `${p.start} – ${p.end}`)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: isMatch ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                          background: isMatch ? '#FDF0EC' : '#FFFFFF',
                          color: isMatch ? 'var(--brand)' : 'var(--ink)',
                          fontWeight: isMatch ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    assignStaffShift({
                      staffName: assignMember.split(' (')[0],
                      sessionName: assignSession || activeSessionObj?.display || 'Đêm 1',
                      gateName: assignGate,
                      shift: assignShift,
                    });
                    showToast(`Đã phân công ${assignMember.split(' (')[0]} vào ${assignGate} thành công!`, 'success');
                    setScreen('o-staff');
                  }}
                >
                  Lưu phân công
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-staff')}
                >
                  Quay lại danh sách
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={activeSessionObj?.eventName || 'Đêm nhạc Mùa Thu'}
            subtitle={activeSessionObj?.venueName || 'Nhà hát Ánh Trăng'}
            badge={activeSessionObj?.sessionName || 'Đêm 1'}
            image={activeSessionObj?.poster || null}
          />
        </div>
      )}

      {/* 6. o-staff-khoa */}
      {activeScreen === 'o-staff-khoa' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Nhân sự Lê Minh Khoa
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Nhân sự</label>
                <input className="form-input" readOnly value="Lê Minh Khoa · Trưởng nhóm Check-in" />
              </div>
              <div>
                <label className="form-label">Cổng phụ trách</label>
                <input
                  className="form-input"
                  value={khoaGate}
                  onChange={(e) => setKhoaGate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Ca trực</label>
                <input
                  className="form-input"
                  value={khoaShift}
                  onChange={(e) => setKhoaShift(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã cập nhật phân công của Lê Minh Khoa.', 'success');
                    setScreen('o-staff');
                  }}
                >
                  Cập nhật ca trực
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-staff')}
                >
                  Danh sách nhân sự
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard />
        </div>
      )}
    </div>
  );
}
