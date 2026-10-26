import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaRecordInfoCard,
  FigmaEventPreviewCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { errorMessage, formatDateTime, useOrgId } from '../../lib/api';
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  STAFF_ROLES,
  memberName,
  sessionLabel,
  useAssignStaff,
  useMembers,
  useOrgEvents,
  useRevokeAssignment,
  useSetMember,
  useStaffAssignments,
  useVenueGates,
  type StaffAssignment,
} from './data/org-data';

const STAFF_SCREENS: FigmaScreenOption[] = [
  { id: 'o-members', label: 'Thành viên tổ chức' },
  { id: 'o-member-add', label: 'Thêm nhân sự mới' },
  { id: 'o-invite-sent', label: 'Đã thêm thành viên' },
  { id: 'o-staff', label: 'Nhân sự sự kiện' },
  { id: 'o-staff-assign', label: 'Phân công nhân sự cổng' },
  { id: 'o-staff-detail', label: 'Chi tiết phân công' },
];

const ROLE_OPTIONS = [
  { label: 'Nhân sự soát vé', roles: ['SCANNER'] },
  { label: 'Bán vé tại quầy', roles: ['POS'] },
  { label: 'Quản lý cổng', roles: ['GATE_MANAGER'] },
  { label: 'Quản lý sự kiện', roles: ['EVENT_MANAGER'] },
  { label: 'Kế toán đối soát', roles: ['FINANCE'] },
];

// Sessions that can still get staff (assign_staff rejects ENDED / CANCELLED).
const OPEN_SESSION = (status: string) => status !== 'ENDED' && status !== 'CANCELLED';

const roleText = (roles: string[]) => roles.map((role) => ROLE_LABELS[role] ?? role).join(', ');
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const linkButton = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

export function OrgStaffPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const orgId = useOrgId();

  const activeScreen = searchParams.get('screen') || 'o-members';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const members = useMembers(orgId);
  const events = useOrgEvents(orgId);
  const sessions = useMemo(
    () =>
      (events.data ?? []).flatMap((event) =>
        event.sessions.map((session) => ({ event, session, label: sessionLabel(event, session) })),
      ),
    [events.data],
  );
  const assignments = useStaffAssignments(sessions.map(({ session }) => session.id));
  const setMember = useSetMember(orgId);
  const assignStaff = useAssignStaff();
  const revoke = useRevokeAssignment();

  const memberByUser = new Map((members.data ?? []).map((member) => [member.userId, member]));
  const sessionById = new Map(sessions.map((item) => [item.session.id, item]));
  const staffMembers = (members.data ?? []).filter(
    (member) => member.status === 'ACTIVE' && member.roles.some((role) => STAFF_ROLES.includes(role)),
  );

  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(ROLE_OPTIONS[0].label);

  const [assignUserId, setAssignUserId] = useState('');
  const [assignSessionId, setAssignSessionId] = useState('');
  const [assignGateId, setAssignGateId] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['SCAN']);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const openSessions = sessions.filter(({ session }) => OPEN_SESSION(session.status));
  const chosenSession = sessionById.get(assignSessionId) ?? openSessions[0];
  const gates = useVenueGates(chosenSession?.session.venue?.id);
  const chosenUserId = assignUserId || staffMembers[0]?.userId || '';
  const detail = assignments.data.find((assignment) => assignment.id === detailId);

  const shownMembers = (members.data ?? []).filter((member) =>
    `${memberName(member)} ${roleText(member.roles)}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const shownAssignments = [...assignments.data].sort((a, b) => a.validFrom.localeCompare(b.validFrom));

  const openAssign = (userId?: string) => {
    if (userId) setAssignUserId(userId);
    setScreen('o-staff-assign');
  };
  const openDetail = (assignment: StaffAssignment) => {
    setDetailId(assignment.id);
    setScreen('o-staff-detail');
  };

  const addMember = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Vui lòng nhập email tài khoản Tickey của nhân sự.', 'warning');
      return;
    }
    const roles = ROLE_OPTIONS.find((option) => option.label === inviteRole)?.roles ?? ['SCANNER'];
    setMember.mutate(
      { email, roles },
      {
        onSuccess: () => setScreen('o-invite-sent'),
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const saveAssignment = () => {
    if (!chosenUserId || !chosenSession) {
      showToast('Chọn nhân sự và suất diễn trước khi phân công.', 'warning');
      return;
    }
    if (!permissions.length) {
      showToast('Chọn ít nhất một quyền cho ca trực.', 'warning');
      return;
    }
    assignStaff.mutate(
      {
        sessionId: chosenSession.session.id,
        userId: chosenUserId,
        permissions,
        gateId: assignGateId || null,
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
      },
      {
        onSuccess: () => {
          showToast(
            `Đã phân công ${memberName(memberByUser.get(chosenUserId))} vào ${chosenSession.label}.`,
            'success',
          );
          setScreen('o-staff');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const revokeAssignment = (assignment: StaffAssignment) =>
    revoke.mutate(assignment, {
      onSuccess: () => {
        showToast('Đã thu hồi phân công. Nhân sự không thể soát vé cho ca này nữa.', 'success');
        setScreen('o-staff');
      },
      onError: (error) => showToast(errorMessage(error), 'danger'),
    });

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
                  placeholder="Tìm theo tên, vai trò..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-staff')}>
                Nhân sự sự kiện
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setInviteEmail('');
                setInviteRole(ROLE_OPTIONS[0].label);
                setScreen('o-member-add');
              }}
            >
              + Thêm nhân sự
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
                Tất cả danh sách
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shownMembers.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={members.isLoading}
              error={members.error}
              empty={members.isSuccess && !shownMembers.length}
              emptyText="Chưa có thành viên phù hợp."
              onRetry={() => void members.refetch()}
            />
            {!!shownMembers.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>THÀNH VIÊN</th>
                      <th>ĐIỆN THOẠI</th>
                      <th>VAI TRÒ</th>
                      <th>NGÀY THÊM</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownMembers.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700 }}>{memberName(m)}</td>
                        <td>{m.profile?.phone ?? '—'}</td>
                        <td>{roleText(m.roles)}</td>
                        <td>{formatDateTime(m.createdAt)}</td>
                        <td>
                          <span
                            className={`badge ${
                              m.status === 'ACTIVE'
                                ? 'badge-success'
                                : m.status === 'INVITED'
                                  ? 'badge-warning'
                                  : 'badge-danger'
                            }`}
                          >
                            {m.status === 'ACTIVE'
                              ? 'Đang hoạt động'
                              : m.status === 'INVITED'
                                ? 'Đã gửi lời mời'
                                : 'Đã thu hồi'}
                          </span>
                        </td>
                        <td>
                          {m.status === 'ACTIVE' && m.roles.some((role) => STAFF_ROLES.includes(role)) ? (
                            <button type="button" onClick={() => openAssign(m.userId)} style={linkButton}>
                              Phân công ca →
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. o-member-add */}
      {activeScreen === 'o-member-add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}
            >
              Thêm nhân sự mới vào tổ chức
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Email tài khoản Tickey</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="nhansu@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Nhân sự cần đăng ký tài khoản Tickey trước. Việc thêm vào tổ chức không tự cấp quyền soát
                  vé: cần phân công theo từng suất diễn.
                </div>
              </div>
              <div>
                <label className="form-label">Vai trò trong tổ chức</label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={setMember.isPending}
                  onClick={addMember}
                >
                  {setMember.isPending ? 'Đang thêm…' : 'Thêm nhân sự'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-members')}>
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
            Đã thêm thành viên
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}
          >
            {inviteEmail || 'Tài khoản'} đã được thêm vào tổ chức. Phân công ca trực để nhân sự có thể soát
            vé.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            {inviteRole}
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
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-members')}>
              ← Thành viên tổ chức
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openAssign()}>
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
                Nhân sự vận hành · Tất cả suất diễn
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shownAssignments.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={events.isLoading || assignments.isPending}
              error={events.error ?? assignments.error}
              empty={!assignments.isPending && !shownAssignments.length}
              emptyText="Chưa có phân công nào."
              onRetry={() => void (events.error ? events.refetch() : assignments.refetch())}
            />
            {!!shownAssignments.length && (
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
                    {shownAssignments.map((s) => {
                      const timeZone = sessionById.get(s.sessionId)?.session.venue?.timezone;
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{memberName(memberByUser.get(s.userId))}</td>
                          <td>{sessionById.get(s.sessionId)?.label ?? 'Suất diễn'}</td>
                          <td>{s.gate?.name ?? 'Mọi cổng'}</td>
                          <td>
                            {formatDateTime(s.validFrom, timeZone)} – {formatDateTime(s.validUntil, timeZone)}
                          </td>
                          <td>
                            <span
                              className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}
                            >
                              {s.status === 'ACTIVE' ? 'Sẵn sàng' : 'Đã thu hồi'}
                            </span>
                          </td>
                          <td>
                            <button type="button" onClick={() => openDetail(s)} style={linkButton}>
                              Chi tiết →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. o-staff-assign */}
      {activeScreen === 'o-staff-assign' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}
            >
              Thông tin chi tiết · Phân công cổng
            </div>
            <QueryNotice
              loading={members.isLoading || events.isLoading}
              error={members.error ?? events.error}
              empty={members.isSuccess && events.isSuccess && (!staffMembers.length || !openSessions.length)}
              emptyText={
                !staffMembers.length
                  ? 'Chưa có nhân sự vai trò Soát vé / POS / Quản lý cổng. Thêm nhân sự trước.'
                  : 'Chưa có suất diễn nào có thể phân công.'
              }
            />
            {!!staffMembers.length && !!openSessions.length && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    👤 Nhân sự phụ trách
                  </label>
                  <select
                    className="form-select"
                    value={chosenUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                  >
                    {staffMembers.map((m) => (
                      <option key={m.id} value={m.userId}>
                        {memberName(m)} ({roleText(m.roles)})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    background: '#F8FAFC',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                      🎪 Sự kiện & Suất diễn
                    </label>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#4F46E5',
                        background: '#EEF2FF',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {openSessions.length} suất diễn
                    </span>
                  </div>
                  <select
                    className="form-select"
                    value={chosenSession?.session.id ?? ''}
                    onChange={(e) => {
                      setAssignSessionId(e.target.value);
                      setAssignGateId('');
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    {openSessions.map(({ session, label }) => (
                      <option key={session.id} value={session.id}>
                        {label} ({formatDateTime(session.startsAt, session.venue?.timezone)})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    📍 Địa điểm: <strong>{chosenSession?.session.venue?.name ?? 'Chưa định'}</strong> · ⏰ Mở
                    cửa:{' '}
                    <strong>
                      {formatDateTime(
                        chosenSession?.session.doorsOpenAt,
                        chosenSession?.session.venue?.timezone,
                      )}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    🚪 Cổng soát vé
                  </label>
                  <select
                    className="form-select"
                    value={assignGateId}
                    onChange={(e) => setAssignGateId(e.target.value)}
                  >
                    <option value="">Mọi cổng của suất diễn</option>
                    {(gates.data ?? [])
                      .filter((gate) => gate.status === 'ACTIVE')
                      .map((gate) => (
                        <option key={gate.id} value={gate.id}>
                          {gate.code} · {gate.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    🔑 Quyền trong ca
                  </label>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {Object.entries(PERMISSION_LABELS).map(([permission, label]) => (
                      <label
                        key={permission}
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(permission)}
                          onChange={(e) =>
                            setPermissions((current) =>
                              e.target.checked
                                ? [...current, permission]
                                : current.filter((p) => p !== permission),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: '#FAF9F6',
                  }}
                >
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    ⏰ Khung giờ ca trực
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <span
                        style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}
                      >
                        Bắt đầu
                      </span>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={validFrom}
                        onChange={(e) => setValidFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <span
                        style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}
                      >
                        Kết thúc
                      </span>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Để trống: từ 2 giờ trước giờ mở cửa đến 1 giờ sau khi suất diễn kết thúc.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={assignStaff.isPending}
                    onClick={saveAssignment}
                  >
                    {assignStaff.isPending ? 'Đang lưu…' : 'Lưu phân công'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-staff')}>
                    Quay lại danh sách
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaEventPreviewCard
            title={chosenSession?.event.title ?? 'Chọn suất diễn'}
            subtitle={chosenSession?.session.venue?.name ?? ''}
            badge={chosenSession?.session.title ?? 'Suất diễn'}
            image={chosenSession?.event.coverImageUrl ?? null}
          />
        </div>
      )}

      {/* 6. o-staff-detail */}
      {activeScreen === 'o-staff-detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            {!detail ? (
              <QueryNotice
                loading={assignments.isPending}
                empty
                emptyText="Chọn một phân công trong danh sách Nhân sự sự kiện."
              />
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15.5,
                    fontWeight: 700,
                    marginBottom: 16,
                  }}
                >
                  Phân công · {memberName(memberByUser.get(detail.userId))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['Suất diễn', sessionById.get(detail.sessionId)?.label ?? 'Suất diễn'],
                    [
                      'Cổng phụ trách',
                      detail.gate ? `${detail.gate.code} · ${detail.gate.name}` : 'Mọi cổng',
                    ],
                    ['Quyền', detail.permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(', ')],
                    ['Ca trực', `${formatDateTime(detail.validFrom)} – ${formatDateTime(detail.validUntil)}`],
                    ['Trạng thái', detail.status === 'ACTIVE' ? 'Sẵn sàng' : 'Đã thu hồi'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" readOnly value={value} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    {detail.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={revoke.isPending}
                        onClick={() => revokeAssignment(detail)}
                      >
                        {revoke.isPending ? 'Đang thu hồi…' : 'Thu hồi phân công'}
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-staff')}>
                      Danh sách nhân sự
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <FigmaEventPreviewCard
            title={detail ? sessionById.get(detail.sessionId)?.event.title : undefined}
            subtitle={detail ? (sessionById.get(detail.sessionId)?.session.venue?.name ?? '') : undefined}
            image={detail ? (sessionById.get(detail.sessionId)?.event.coverImageUrl ?? null) : null}
          />
        </div>
      )}
    </div>
  );
}
