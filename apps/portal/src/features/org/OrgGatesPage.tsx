import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Smartphone } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { errorMessage, formatDateTime, useOrgId } from '../../lib/api';
import {
  memberName,
  sessionLabel,
  useDevices,
  useGateZones,
  useLayoutZones,
  useMembers,
  useOrgEvents,
  useOrgVenues,
  useRevokeDevice,
  useSaveGate,
  useSetGateZones,
  useVenueGates,
  type Gate,
  type GateDevice,
} from './data/org-data';

const GATE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-gates', label: 'Cổng soát vé (Gates)' },
  { id: 'o-gate-create', label: 'Tạo cổng soát vé mới' },
  { id: 'o-gate-edit', label: 'Cấu hình cổng' },
  { id: 'o-devices', label: 'Thiết bị quét vé (Devices)' },
  { id: 'o-device-add', label: 'Đăng ký thiết bị mới' },
  { id: 'o-device-revoke', label: 'Thu hồi phiên thiết bị' },
];

const linkButton = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

export function OrgGatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const orgId = useOrgId();

  const activeScreen = searchParams.get('screen') || 'o-gates';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const venues = useOrgVenues(orgId);
  const [venueId, setVenueId] = useState('');
  const chosenVenueId = venueId || venues.data?.[0]?.id || '';
  const gates = useVenueGates(chosenVenueId);
  const events = useOrgEvents(orgId);
  const devices = useDevices(orgId);
  const members = useMembers(orgId);
  const saveGate = useSaveGate();
  const setGateZones = useSetGateZones();
  const revokeDevice = useRevokeDevice(orgId);

  const [search, setSearch] = useState('');
  const [editingGate, setEditingGate] = useState<Gate | null>(null);
  const [gateCode, setGateCode] = useState('');
  const [gateName, setGateName] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<GateDevice | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Sessions held at the chosen venue that can still change their gate rules.
  const venueSessions = useMemo(
    () =>
      (events.data ?? []).flatMap((event) =>
        event.sessions
          .filter((s) => s.venue?.id === chosenVenueId && s.status !== 'ENDED' && s.status !== 'CANCELLED')
          .map((session) => ({ session, label: sessionLabel(event, session) })),
      ),
    [events.data, chosenVenueId],
  );
  const [ruleSessionId, setRuleSessionId] = useState('');
  const ruleSession = venueSessions.find((s) => s.session.id === ruleSessionId) ?? venueSessions[0];
  const zones = useLayoutZones(ruleSession?.session.layoutVersionId);
  const gateZones = useGateZones(ruleSession?.session.id);
  // Unsaved checkbox edits for one gate + Session; otherwise the saved rules.
  const ruleKey = `${editingGate?.id}:${ruleSession?.session.id}`;
  const [draft, setDraft] = useState<{ key: string; zones: string[] } | null>(null);
  const allowedZones =
    draft?.key === ruleKey
      ? draft.zones
      : (gateZones.data ?? []).filter((r) => r.gateId === editingGate?.id).map((r) => r.zoneId);
  const setAllowedZones = (update: (current: string[]) => string[]) =>
    setDraft({ key: ruleKey, zones: update(allowedZones) });

  const memberByUser = new Map((members.data ?? []).map((m) => [m.userId, m]));
  const shownGates = (gates.data ?? []).filter((g) =>
    `${g.code} ${g.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openCreate = () => {
    setEditingGate(null);
    setGateCode('');
    setGateName('');
    setScreen('o-gate-create');
  };
  const openEdit = (gate: Gate) => {
    setEditingGate(gate);
    setGateCode(gate.code);
    setGateName(gate.name);
    setScreen('o-gate-edit');
  };

  const submitGate = (status?: string) => {
    if (!chosenVenueId) {
      showToast('Tạo địa điểm trước khi tạo cổng.', 'warning');
      return;
    }
    if (!gateCode.trim() || !gateName.trim()) {
      showToast('Vui lòng nhập mã và tên cổng.', 'warning');
      return;
    }
    saveGate.mutate(
      { id: editingGate?.id, venueId: chosenVenueId, code: gateCode, name: gateName, status },
      {
        onSuccess: () => {
          showToast(
            status === 'ARCHIVED'
              ? `Đã ngừng sử dụng cổng ${gateCode.toUpperCase()}.`
              : `Đã lưu cổng ${gateCode.toUpperCase()} · ${gateName}.`,
            'success',
          );
          setScreen('o-gates');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const saveZoneRules = () => {
    if (!editingGate || !ruleSession) return;
    // The RPC replaces the whole Session mapping: keep the other gates' rules as they are.
    const others = (gateZones.data ?? []).filter((r) => r.gateId !== editingGate.id);
    const byGate = new Map<string, string[]>();
    for (const rule of others) byGate.set(rule.gateId, [...(byGate.get(rule.gateId) ?? []), rule.zoneId]);
    if (allowedZones.length) byGate.set(editingGate.id, allowedZones);
    setGateZones.mutate(
      {
        sessionId: ruleSession.session.id,
        config: [...byGate].map(([gateId, zoneIds]) => ({ gateId, zoneIds })),
      },
      {
        onSuccess: () =>
          showToast(`Đã lưu khu vực được qua cổng ${editingGate.code} cho ${ruleSession.label}.`, 'success'),
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    if (!revokeReason.trim()) {
      showToast('Vui lòng nhập lý do thu hồi.', 'warning');
      return;
    }
    revokeDevice.mutate(
      { id: revokeTarget.id, reason: revokeReason.trim() },
      {
        onSuccess: () => {
          showToast(`Đã thu hồi thiết bị ${revokeTarget.name}. Thiết bị không thể soát vé nữa.`, 'success');
          setScreen('o-devices');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const screenMeta = GATE_SCREENS.find((s) => s.id === activeScreen) || GATE_SCREENS[0];

  const venuePicker = (
    <select
      className="form-select"
      style={{ width: 260 }}
      value={chosenVenueId}
      onChange={(e) => setVenueId(e.target.value)}
    >
      {(venues.data ?? []).map((v) => (
        <option key={v.id} value={v.id}>
          📍 {v.name}
        </option>
      ))}
    </select>
  );

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
              {venuePicker}
              <input
                className="form-input"
                style={{ width: 240 }}
                placeholder="Tìm theo mã, tên cổng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-devices')}>
                Thiết bị quét vé
              </button>
            </div>
            <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!chosenVenueId}>
              + Tạo cổng mới
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
                Cổng của địa điểm
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shownGates.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={venues.isLoading || (!!chosenVenueId && gates.isLoading)}
              error={venues.error ?? gates.error}
              empty={venues.isSuccess && (!chosenVenueId || (gates.isSuccess && !shownGates.length))}
              emptyText={
                chosenVenueId
                  ? 'Địa điểm chưa có cổng soát vé.'
                  : 'Tổ chức chưa có địa điểm. Tạo địa điểm trước.'
              }
              onRetry={() => void (venues.error ? venues.refetch() : gates.refetch())}
            />
            {!!shownGates.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ CỔNG</th>
                      <th>TÊN CỔNG</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownGates.map((g) => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 700 }}>{g.code}</td>
                        <td>{g.name}</td>
                        <td>
                          <span
                            className={`badge ${g.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}
                          >
                            {g.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng sử dụng'}
                          </span>
                        </td>
                        <td>
                          <button type="button" onClick={() => openEdit(g)} style={linkButton}>
                            Cấu hình →
                          </button>
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

      {/* 2. o-gate-create & o-gate-edit */}
      {(activeScreen === 'o-gate-create' || activeScreen === 'o-gate-edit') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15.5,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                {editingGate ? `Cấu hình chi tiết · Cổng ${editingGate.code}` : 'Tạo mới cổng soát vé'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Địa điểm</label>
                  {editingGate ? (
                    <input
                      className="form-input"
                      readOnly
                      value={venues.data?.find((v) => v.id === chosenVenueId)?.name ?? ''}
                    />
                  ) : (
                    venuePicker
                  )}
                </div>
                <div>
                  <label className="form-label">Mã cổng (duy nhất trong địa điểm)</label>
                  <input
                    className="form-input"
                    placeholder="Ví dụ: G1, VIP, DONG"
                    value={gateCode}
                    onChange={(e) => setGateCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Tên cổng soát vé</label>
                  <input
                    className="form-input"
                    placeholder="Ví dụ: Cổng chính · Sảnh A"
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saveGate.isPending}
                    onClick={() => submitGate(editingGate ? 'ACTIVE' : undefined)}
                  >
                    {saveGate.isPending ? 'Đang lưu…' : editingGate ? 'Lưu cấu hình cổng' : 'Tạo cổng mới'}
                  </button>
                  {editingGate?.status === 'ACTIVE' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saveGate.isPending}
                      onClick={() => submitGate('ARCHIVED')}
                    >
                      Ngừng sử dụng cổng
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-gates')}>
                    Quay lại
                  </button>
                </div>
              </div>
            </div>

            {editingGate && (
              <div className="card" style={{ padding: 22 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15.5,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Khu vực được qua cổng {editingGate.code}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                  Theo từng suất diễn. Cổng chưa cấu hình khu vực thì nhận vé mọi khu vực; vé sai khu vực bị
                  báo WRONG_ZONE khi quét.
                </div>
                <QueryNotice
                  loading={events.isLoading}
                  error={events.error}
                  empty={events.isSuccess && !venueSessions.length}
                  emptyText="Chưa có suất diễn sắp tới tại địa điểm này."
                />
                {!!venueSessions.length && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <select
                      className="form-select"
                      value={ruleSession?.session.id ?? ''}
                      onChange={(e) => setRuleSessionId(e.target.value)}
                    >
                      {venueSessions.map(({ session, label }) => (
                        <option key={session.id} value={session.id}>
                          {label} ({formatDateTime(session.startsAt, session.venue?.timezone)})
                        </option>
                      ))}
                    </select>
                    <QueryNotice
                      loading={zones.isLoading || gateZones.isLoading}
                      error={zones.error ?? gateZones.error}
                    />
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {(zones.data ?? []).map((zone) => (
                        <label
                          key={zone.id}
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
                            checked={allowedZones.includes(zone.id)}
                            onChange={(e) =>
                              setAllowedZones((current) =>
                                e.target.checked
                                  ? [...current, zone.id]
                                  : current.filter((z) => z !== zone.id),
                              )
                            }
                          />
                          {zone.name} ({zone.kind === 'SEATED' ? 'ngồi' : 'đứng'})
                        </label>
                      ))}
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={setGateZones.isPending || !zones.data}
                        onClick={saveZoneRules}
                      >
                        {setGateZones.isPending ? 'Đang lưu…' : 'Lưu khu vực cho suất này'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 3. o-devices */}
      {activeScreen === 'o-devices' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-gates')}>
              ← Cổng soát vé
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('o-device-add')}>
              + Đăng ký thiết bị
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
                Thiết bị đã đăng ký
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{devices.data?.length ?? 0} bản ghi</div>
            </div>
            <QueryNotice
              loading={devices.isLoading}
              error={devices.error}
              empty={devices.isSuccess && !devices.data.length}
              emptyText="Chưa có thiết bị nào. Thiết bị được đăng ký khi nhân sự đăng nhập app Staff."
              onRetry={() => void devices.refetch()}
            />
            {!!devices.data?.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>THIẾT BỊ</th>
                      <th>NỀN TẢNG</th>
                      <th>ĐĂNG KÝ BỞI</th>
                      <th>HOẠT ĐỘNG GẦN NHẤT</th>
                      <th>ĐỒNG BỘ GẦN NHẤT</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.data.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 700 }}>{d.name}</td>
                        <td>{d.platform === 'IOS' ? 'iOS' : 'Android'}</td>
                        <td>{memberName(memberByUser.get(d.registeredBy))}</td>
                        <td>{formatDateTime(d.lastSeenAt)}</td>
                        <td>{formatDateTime(d.lastSyncAt)}</td>
                        <td>
                          <span
                            className={`badge ${d.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}
                          >
                            {d.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã thu hồi'}
                          </span>
                        </td>
                        <td>
                          {d.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              style={linkButton}
                              onClick={() => {
                                setRevokeTarget(d);
                                setRevokeReason('');
                                setScreen('o-device-revoke');
                              }}
                            >
                              Thu hồi →
                            </button>
                          ) : (
                            <span
                              style={{ fontSize: 12, color: 'var(--muted)' }}
                              title={d.revokeReason ?? ''}
                            >
                              {formatDateTime(d.revokedAt)}
                            </span>
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

      {/* 4. o-device-add */}
      {activeScreen === 'o-device-add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'var(--font-display)',
                fontSize: 15.5,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              <Smartphone size={18} /> Thiết bị được đăng ký từ app Staff
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
              <li>Thêm nhân sự vào tổ chức với vai trò Soát vé, Bán vé tại quầy hoặc Quản lý cổng.</li>
              <li>Phân công nhân sự vào suất diễn (trang Nhân sự).</li>
              <li>Nhân sự đăng nhập app Tickey trên điện thoại: thiết bị tự đăng ký vào tổ chức.</li>
              <li>Thiết bị xuất hiện ở danh sách này; mất máy thì thu hồi để chặn soát vé.</li>
            </ol>
            <div style={{ marginTop: 16 }}>
              <FigmaInfoAlert tone="info">
                Chỉ nhân sự cổng mới đăng ký được thiết bị, để mỗi lượt quét gắn với đúng người và đúng máy.
              </FigmaInfoAlert>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => setScreen('o-devices')}
            >
              Danh sách thiết bị
            </button>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. o-device-revoke */}
      {activeScreen === 'o-device-revoke' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            {!revokeTarget ? (
              <QueryNotice empty emptyText="Chọn thiết bị cần thu hồi trong danh sách thiết bị." />
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
                  Thu hồi thiết bị · {revokeTarget.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <FigmaInfoAlert tone="warning">
                    Thiết bị bị thu hồi không thể soát vé, tải manifest hay đồng bộ nữa (DEVICE_REVOKED).
                    Không thể hoàn tác: nhân sự cần đăng ký thiết bị khác.
                  </FigmaInfoAlert>
                  <div>
                    <label className="form-label">Lý do thu hồi</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Ví dụ: Mất máy, nhân sự nghỉ việc..."
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={revokeDevice.isPending}
                      onClick={confirmRevoke}
                    >
                      {revokeDevice.isPending ? 'Đang thu hồi…' : 'Thu hồi thiết bị'}
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
              </>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}
    </div>
  );
}
