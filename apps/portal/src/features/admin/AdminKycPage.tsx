import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Building2, Search } from 'lucide-react';
import { errorMessage, formatDateTime } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import { ConfirmButton } from '../../components/common/ConfirmButton';
import { KYC_DOC_TYPES } from '../org/data/org-data';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaRecordInfoCard,
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import {
  ADMIN_KYC_STATUS,
  ADMIN_ORG_STATUS,
  kycDocumentUrl,
  useAdminKyc,
  useAdminOrgs,
  useRequestOrgStatusChange,
  useReviewKyc,
  type AdminKycSubmission,
  type AdminOrg,
} from './data/admin-data';

const ADMIN_KYC_SCREENS: FigmaScreenOption[] = [
  { id: 'a-kyc', label: 'Hồ sơ KYC tổ chức' },
  { id: 'a-kyc-review', label: 'Chi tiết & xét duyệt KYC' },
  { id: 'a-kyc-info', label: 'Yêu cầu bổ sung KYC' },
  { id: 'a-kyc-reject', label: 'Từ chối hồ sơ KYC' },
  { id: 'a-orgs', label: 'Danh sách tổ chức (Tenants)' },
  { id: 'a-org-status', label: 'Cập nhật trạng thái tổ chức' },
];

const ORG_STATUS_CHANGE_ACTIONS = [
  { value: 'SUSPEND', label: 'Tạm ngưng mở bán (Suspend)' },
  { value: 'UNSUSPEND', label: 'Cho hoạt động lại (Unsuspend)' },
  { value: 'TERMINATE', label: 'Chấm dứt tổ chức (Terminate)' },
];

function StatusBadge({ map, status }: { map: Record<string, { label: string; badge: string }>; status: string }) {
  const meta = map[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

export function AdminKycPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // "tab=venues" is a legacy alias with no backing queue: it lands on the Org list.
  const tabParam = searchParams.get('tab');
  const activeScreen = searchParams.get('screen') || (tabParam === 'venues' ? 'a-orgs' : 'a-kyc');
  // The selected submission / Org lives in the URL so reloads and Back keep the review open.
  const selectedKycId = searchParams.get('kyc');
  const selectedOrgId = searchParams.get('org');
  const go = (screen: string, ids: { kyc?: string | null; org?: string | null } = {}) => {
    const next: Record<string, string> = { screen };
    const kycId = ids.kyc === undefined ? selectedKycId : ids.kyc;
    const orgId = ids.org === undefined ? selectedOrgId : ids.org;
    if (kycId) next.kyc = kycId;
    if (orgId) next.org = orgId;
    setSearchParams(next);
  };
  const setScreen = (screen: string) => go(screen);

  const [search, setSearch] = useState('');

  const [infoNote, setInfoNote] = useState('Vui lòng bổ sung bản scan GPKD trang 2 có dấu mộc rõ nét.');
  const [rejectReason, setRejectReason] = useState('');
  const [orgAction, setOrgAction] = useState('SUSPEND');
  const [orgStatusReason, setOrgStatusReason] = useState('');

  const kyc = useAdminKyc();
  const orgs = useAdminOrgs(undefined, search);
  const reviewKyc = useReviewKyc();
  const requestStatusChange = useRequestOrgStatusChange();

  const submissions = kyc.data ?? [];
  const filteredKyc = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = kyc.data ?? [];
    if (!needle) return all;
    return all.filter((s) =>
      (s.org?.name ?? '').toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle),
    );
  }, [kyc.data, search]);

  const selectedKyc: AdminKycSubmission | undefined =
    submissions.find((s) => s.id === selectedKycId) ?? undefined;
  const selectedOrg: AdminOrg | undefined =
    (orgs.data ?? []).find((o) => o.id === selectedOrgId) ?? undefined;

  const screenMeta = ADMIN_KYC_SCREENS.find((s) => s.id === activeScreen) || ADMIN_KYC_SCREENS[0];

  const runReview = (decision: string, note?: string) => {
    if (!selectedKyc) return;
    reviewKyc.mutate(
      { id: selectedKyc.id, decision, note },
      {
        onSuccess: () => {
          const label = ADMIN_KYC_STATUS[decision]?.label ?? decision;
          showToast(`Đã cập nhật hồ sơ KYC của ${selectedKyc.org?.name ?? 'tổ chức'}: ${label}.`, 'success');
          go('a-kyc', { kyc: null });
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_KYC_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-kyc — KYC queue */}
      {activeScreen === 'a-kyc' && (
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
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Tìm theo tên tổ chức..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-orgs')}>
                Danh sách tổ chức
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
                Tất cả hồ sơ KYC
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredKyc.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={kyc.isPending}
              error={kyc.error}
              onRetry={() => kyc.refetch()}
              empty={kyc.isSuccess && !submissions.length}
              emptyText="Chưa có hồ sơ KYC nào."
            />
            {!!filteredKyc.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>TỔ CHỨC</th>
                      <th>PHÁP LÝ</th>
                      <th>TÀI LIỆU</th>
                      <th>NGÀY NỘP</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKyc.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.org?.name ?? s.orgId}</td>
                        <td>{(s.legalInfo?.legalName as string | undefined) ?? '—'}</td>
                        <td>{s.documents.length} tệp</td>
                        <td>{formatDateTime(s.submittedAt)}</td>
                        <td>
                          <StatusBadge map={ADMIN_KYC_STATUS} status={s.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => go('a-kyc-review', { kyc: s.id })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Xét duyệt →
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

      {/* 2. a-kyc-review */}
      {activeScreen === 'a-kyc-review' && (
        <div>
          <QueryNotice
            loading={kyc.isPending}
            error={kyc.error}
            onRetry={() => kyc.refetch()}
            empty={!selectedKyc}
            emptyText="Chọn một hồ sơ KYC từ danh sách."
          />
          {selectedKyc && (
            <>
              <FigmaNavyContextBanner
                title={selectedKyc.org?.name ?? selectedKyc.orgId}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge={ADMIN_KYC_STATUS[selectedKyc.status]?.label ?? selectedKyc.status}
              />
              <FigmaContextGrid
                items={[
                  {
                    label: 'Pháp nhân',
                    value: (selectedKyc.legalInfo?.legalName as string | undefined) ?? selectedKyc.org?.name ?? '—',
                  },
                  { label: 'Trạng thái hồ sơ', value: ADMIN_KYC_STATUS[selectedKyc.status]?.label ?? selectedKyc.status },
                  { label: 'Ngày nộp', value: formatDateTime(selectedKyc.submittedAt) },
                  { label: 'Tài liệu đính kèm', value: `${selectedKyc.documents.length} tệp` },
                ]}
              />
              <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Tài liệu xác minh
                </div>
                {selectedKyc.documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{KYC_DOC_TYPES[doc.docType] ?? doc.docType}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{doc.storagePath}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ alignSelf: 'center' }}
                      onClick={() => {
                        // Open the tab synchronously so the popup blocker allows it, then point it at the signed link.
                        const tab = window.open('', '_blank');
                        if (tab) tab.opener = null;
                        kycDocumentUrl(doc.storagePath).then(
                          (url) => {
                            if (tab) tab.location.href = url;
                            else window.location.assign(url);
                          },
                          () => {
                            tab?.close();
                            showToast('Không mở được tệp. Tệp có thể chưa có trong kho lưu trữ.', 'danger');
                          },
                        );
                      }}
                    >
                      Xem tệp
                    </button>
                  </div>
                ))}
                <FigmaInfoAlert tone="info">
                  Tài liệu nằm trong kho riêng tư (kyc-private); chỉ KYC_REVIEWER truy cập được.
                </FigmaInfoAlert>
              </div>
              {selectedKyc.status === 'SUBMITTED' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <ConfirmButton
                    pending={reviewKyc.isPending}
                    message={`Phê duyệt KYC cho ${selectedKyc.org?.name ?? 'tổ chức'}?`}
                    confirmLabel="Xác nhận phê duyệt"
                    onConfirm={() => runReview('APPROVED')}
                  >
                    Phê duyệt KYC
                  </ConfirmButton>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-kyc-info')}>
                    Yêu cầu bổ sung
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-kyc-reject')}>
                    Từ chối hồ sơ
                  </button>
                </div>
              ) : (
                <FigmaInfoAlert tone="info">
                  Hồ sơ đã ở trạng thái {ADMIN_KYC_STATUS[selectedKyc.status]?.label ?? selectedKyc.status}
                  {selectedKyc.reviewNote ? ` · ${selectedKyc.reviewNote}` : ''}.
                </FigmaInfoAlert>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. a-kyc-info */}
      {activeScreen === 'a-kyc-info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Yêu cầu bổ sung KYC
            </div>
            <QueryNotice loading={!selectedKyc} onRetry={() => setScreen('a-kyc')} />
            {selectedKyc && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Tổ chức nhận yêu cầu</label>
                  <input className="form-input" readOnly value={selectedKyc.org?.name ?? selectedKyc.orgId} />
                </div>
                <div>
                  <label className="form-label">Nội dung cần bổ sung (bắt buộc)</label>
                  <input className="form-input" value={infoNote} onChange={(e) => setInfoNote(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <ConfirmButton
                    disabled={!infoNote.trim()}
                    pending={reviewKyc.isPending}
                    message={`Gửi yêu cầu bổ sung cho ${selectedKyc.org?.name ?? 'tổ chức'}?`}
                    confirmLabel="Gửi"
                    onConfirm={() => runReview('NEEDS_INFO', infoNote.trim())}
                  >
                    Gửi yêu cầu bổ sung
                  </ConfirmButton>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-kyc-review')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 4. a-kyc-reject */}
      {activeScreen === 'a-kyc-reject' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Từ chối hồ sơ KYC
            </div>
            <QueryNotice loading={!selectedKyc} onRetry={() => setScreen('a-kyc')} />
            {selectedKyc && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Tổ chức</label>
                  <input className="form-input" readOnly value={selectedKyc.org?.name ?? selectedKyc.orgId} />
                </div>
                <div>
                  <label className="form-label">Lý do từ chối (bắt buộc, ghi vào Audit Log)</label>
                  <input
                    className="form-input"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Mã số thuế không khớp giấy chứng nhận đăng ký doanh nghiệp."
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <ConfirmButton
                    disabled={!rejectReason.trim()}
                    pending={reviewKyc.isPending}
                    message={`Từ chối hồ sơ KYC của ${selectedKyc.org?.name ?? 'tổ chức'}?`}
                    confirmLabel="Từ chối"
                    onConfirm={() => runReview('REJECTED', rejectReason.trim())}
                  >
                    Xác nhận từ chối
                  </ConfirmButton>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-kyc-review')}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. a-orgs */}
      {activeScreen === 'a-orgs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 320 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
              />
              <input
                className="form-input"
                style={{ paddingLeft: 34 }}
                placeholder="Tìm theo tên tổ chức..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-kyc')}>
              ← Hồ sơ KYC
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
                Danh sách tổ chức trên nền tảng
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(orgs.data ?? []).length} bản ghi</div>
            </div>
            <QueryNotice
              loading={orgs.isPending}
              error={orgs.error}
              onRetry={() => orgs.refetch()}
              empty={orgs.isSuccess && !(orgs.data ?? []).length}
              emptyText="Không có tổ chức nào khớp."
            />
            {!!(orgs.data ?? []).length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>TỔ CHỨC</th>
                      <th>LOẠI HÌNH</th>
                      <th>NGÀY TẠO</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orgs.data ?? []).map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 700 }}>{o.name}</td>
                        <td>{o.businessType}</td>
                        <td>{formatDateTime(o.createdAt)}</td>
                        <td>
                          <StatusBadge map={ADMIN_ORG_STATUS} status={o.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => go('a-org-status', { org: o.id })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Đổi trạng thái →
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

      {/* 6. a-org-status — opens a two-person approval */}
      {activeScreen === 'a-org-status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Yêu cầu đổi trạng thái tổ chức
            </div>
            <QueryNotice loading={!selectedOrg} onRetry={() => setScreen('a-orgs')} />
            {selectedOrg && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Tổ chức</label>
                  <input className="form-input" readOnly value={selectedOrg.name} />
                </div>
                <div>
                  <label className="form-label">Hành động</label>
                  <select
                    className="form-input"
                    value={orgAction}
                    onChange={(e) => setOrgAction(e.target.value)}
                  >
                    {ORG_STATUS_CHANGE_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Lý do</label>
                  <input
                    className="form-input"
                    value={orgStatusReason}
                    onChange={(e) => setOrgStatusReason(e.target.value)}
                    placeholder="Tạm ngưng mở bán mới để rà soát tỷ lệ hoàn vé định kỳ."
                  />
                </div>
                <FigmaInfoAlert tone="warning">
                  Thay đổi trạng thái nhạy cảm mở một phiếu phê duyệt hai người; chỉ có hiệu lực khi được Admin thứ hai
                  thông qua.
                </FigmaInfoAlert>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={requestStatusChange.isPending || !orgStatusReason.trim()}
                    onClick={() =>
                      requestStatusChange.mutate(
                        { id: selectedOrg.id, action: orgAction, reason: orgStatusReason.trim() },
                        {
                          onSuccess: () =>
                            showToast('Đã mở phiếu phê duyệt đổi trạng thái tổ chức.', 'success'),
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Mở phiếu phê duyệt
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-orgs')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard icon="shield" />
        </div>
      )}

      {/* Fallback for a stale screen id */}
      {!ADMIN_KYC_SCREENS.some((s) => s.id === activeScreen) && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
            <Building2 size={18} /> Màn hình không tồn tại.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => setScreen('a-kyc')}
          >
            Về hồ sơ KYC
          </button>
        </div>
      )}
    </div>
  );
}
