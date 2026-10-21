import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaDocumentRow,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const ADMIN_KYC_SCREENS: FigmaScreenOption[] = [
  { id: 'a-kyc', label: 'Hồ sơ KYC tổ chức' },
  { id: 'a-kyc-review', label: 'Chi tiết KYC · Sóng Việt Events' },
  { id: 'a-kyc-info', label: 'Yêu cầu bổ sung KYC' },
  { id: 'a-kyc-reject', label: 'Từ chối hồ sơ KYC' },
  { id: 'a-kyc-outcome', label: 'Đã phê duyệt KYC' },
  { id: 'a-orgs', label: 'Danh sách tổ chức (Tenants)' },
  { id: 'a-org-status', label: 'Cập nhật trạng thái tổ chức' },
  { id: 'a-org-result', label: 'Đã cập nhật trạng thái tổ chức' },
  { id: 'a-venue-verifications', label: 'Xác minh địa điểm' },
  { id: 'a-venue-review', label: 'Xem xét địa điểm · Sân khấu Bến Sông' },
  { id: 'a-venue-outcome', label: 'Đã xác minh địa điểm' },
];

export function AdminKycPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, reviewAdminKyc, updateAdminOrgStatus, reviewAdminVenue } = useMockStore();
  const { showToast } = useToast();

  const tabParam = searchParams.get('tab');
  const defaultScreen = tabParam === 'venues' ? 'a-venue-verifications' : 'a-kyc';
  const activeScreen = searchParams.get('screen') || defaultScreen;
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const [selectedKycId, setSelectedKycId] = useState<string>('kyc-1');
  const [selectedVenueQueueId, setSelectedVenueQueueId] = useState<string>('vq-1');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('org-1');

  const kycQueue = state?.adminKycQueue || [];
  const venueQueue = state?.adminVenueQueue || [];
  const orgsList = state?.adminOrgs || [];

  const selectedKyc =
    kycQueue.find((k) => k.id === selectedKycId) || kycQueue[0];
  const selectedVenueQueue =
    venueQueue.find((v) => v.id === selectedVenueQueueId) || venueQueue[0];
  const selectedOrg =
    orgsList.find((o) => o.id === selectedOrgId) || orgsList[0];

  const [kycInfoNote, setKycInfoNote] = useState(
    'Vui lòng bổ sung bản scan màu GPKD trang 2 có dấu mộc tròn rõ nét.',
  );
  const [kycRejectReason, setKycRejectReason] = useState(
    'Mã số thuế trên đơn đăng ký không khớp với Giấy chứng nhận đăng ký doanh nghiệp.',
  );

  const [orgTargetStatus, setOrgTargetStatus] = useState<'ACTIVE' | 'SUSPENDED'>('SUSPENDED');
  const [orgStatusReason, setOrgStatusReason] = useState(
    'Tạm ngưng mở bán mới để rà soát tỷ lệ hoàn vé định kỳ.',
  );

  const screenMeta = ADMIN_KYC_SCREENS.find((s) => s.id === activeScreen) || ADMIN_KYC_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_KYC_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-kyc */}
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
                  placeholder="Tìm theo tên tổ chức, MST..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-orgs')}
              >
                Danh sách tổ chức
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-venue-verifications')}
              >
                Xác minh địa điểm
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => showToast('Đã xuất danh sách KYC ra CSV.', 'success')}
            >
              Xuất CSV
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
                Tất cả danh sách hồ sơ KYC
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {kycQueue.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>TỔ CHỨC</th>
                    <th>MÃ SỐ THUẾ</th>
                    <th>TÀI LIỆU</th>
                    <th>NGÀY NỘP</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {kycQueue.map((k) => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 700 }}>{k.orgName}</td>
                      <td>{k.taxCode}</td>
                      <td>{k.docsCount} tệp PDF</td>
                      <td>{k.submittedAt}</td>
                      <td>
                        <span
                          className={`badge ${
                            k.status === 'APPROVED'
                              ? 'badge-success'
                              : k.status === 'REJECTED'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {k.status === 'PENDING'
                            ? 'Chờ duyệt'
                            : k.status === 'APPROVED'
                              ? 'Đã duyệt'
                              : k.status === 'NEED_INFO'
                                ? 'Chờ bổ sung'
                                : 'Từ chối'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKycId(k.id);
                            setScreen('a-kyc-review');
                          }}
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
          </div>
        </div>
      )}

      {/* 2. a-kyc-review */}
      {activeScreen === 'a-kyc-review' && (
        <div>
          <FigmaNavyContextBanner
            title={selectedKyc?.orgName || 'Tổ chức'}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={selectedKyc?.status === 'APPROVED' ? 'Đã duyệt' : 'Chờ xét duyệt KYC'}
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Pháp nhân & Mã số thuế',
                value: `${selectedKyc?.orgName || 'Tổ chức'} · MST ${selectedKyc?.taxCode || '0312456789'}`,
              },
              { label: 'Người đại diện pháp luật', value: 'Đại diện hợp pháp · Đã đính kèm CCCD' },
              {
                label: 'Trạng thái hiện tại',
                value:
                  selectedKyc?.status === 'APPROVED'
                    ? 'Đã duyệt (Approved)'
                    : selectedKyc?.status === 'NEED_INFO'
                      ? 'Cần bổ sung thông tin'
                      : selectedKyc?.status === 'REJECTED'
                        ? 'Đã từ chối'
                        : 'Chờ kiểm tra',
              },
              { label: 'Tài liệu đính kèm', value: `${selectedKyc?.docsCount || 2} tệp: GPKD_Scan.pdf · CCCD_Rep.pdf` },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('GPKD_Scan.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedKyc) {
                  reviewAdminKyc(selectedKyc.id, 'APPROVED');
                  showToast(`Đã phê duyệt hồ sơ KYC của ${selectedKyc.orgName}.`, 'success');
                  setScreen('a-kyc-outcome');
                }
              }}
            >
              Phê duyệt KYC
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-kyc-info')}
            >
              Yêu cầu bổ sung
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-kyc-reject')}
            >
              Từ chối hồ sơ
            </button>
          </div>
        </div>
      )}

      {/* 3. a-kyc-info */}
      {activeScreen === 'a-kyc-info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Yêu cầu bổ sung KYC
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tổ chức nhận yêu cầu</label>
                <input
                  className="form-input"
                  readOnly
                  value={`${selectedKyc?.orgName || 'Tổ chức'} (MST ${selectedKyc?.taxCode || ''})`}
                />
              </div>
              <div>
                <label className="form-label">Nội dung cần bổ sung</label>
                <input
                  className="form-input"
                  value={kycInfoNote}
                  onChange={(e) => setKycInfoNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedKyc) {
                      reviewAdminKyc(selectedKyc.id, 'NEED_INFO', kycInfoNote);
                      showToast(`Đã gửi yêu cầu bổ sung tài liệu cho ${selectedKyc.orgName}.`, 'info');
                      setScreen('a-kyc');
                    }
                  }}
                >
                  Gửi yêu cầu bổ sung
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-kyc-review')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 4. a-kyc-reject */}
      {activeScreen === 'a-kyc-reject' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Từ chối hồ sơ KYC
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tổ chức</label>
                <input className="form-input" readOnly value={selectedKyc?.orgName || 'Tổ chức'} />
              </div>
              <div>
                <label className="form-label">Lý do từ chối (Ghi vào Audit Log)</label>
                <input
                  className="form-input"
                  value={kycRejectReason}
                  onChange={(e) => setKycRejectReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedKyc) {
                      reviewAdminKyc(selectedKyc.id, 'REJECTED', kycRejectReason);
                      showToast(`Đã từ chối hồ sơ KYC của ${selectedKyc.orgName}.`, 'warning');
                      setScreen('a-kyc');
                    }
                  }}
                >
                  Xác nhận từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-kyc-review')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. a-kyc-outcome */}
      {activeScreen === 'a-kyc-outcome' && (
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
            Đã phê duyệt hồ sơ KYC tổ chức
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Tổ chức Sóng Việt Events đã được mở khóa toàn bộ chức năng vận hành và tạo địa điểm tổ chức.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            KYC Approved
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-kyc')}
            >
              Danh sách KYC
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-orgs')}
            >
              Xem danh sách tổ chức
            </button>
          </div>
        </div>
      )}

      {/* 6. a-orgs */}
      {activeScreen === 'a-orgs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-kyc')}
            >
              ← Hồ sơ KYC
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-venue-verifications')}
            >
              Xác minh địa điểm
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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.adminOrgs.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>TỔ CHỨC</th>
                    <th>MÃ SỐ THUẾ</th>
                    <th>SỰ KIỆN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.adminOrgs.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700 }}>{o.name}</td>
                      <td>{o.taxCode}</td>
                      <td>{o.eventsCount} sự kiện</td>
                      <td>
                        <span
                          className={`badge ${
                            o.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {o.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrgId(o.id);
                            setScreen('a-org-status');
                          }}
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
          </div>
        </div>
      )}

      {/* 7. a-org-status */}
      {activeScreen === 'a-org-status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Trạng thái tổ chức
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tổ chức</label>
                <input className="form-input" readOnly value={selectedOrg?.name || 'Tổ chức'} />
              </div>
              <div>
                <label className="form-label">Trạng thái mới</label>
                <select
                  className="form-input"
                  value={orgTargetStatus}
                  onChange={(e) => setOrgTargetStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
                >
                  <option value="ACTIVE">Đang hoạt động (Active)</option>
                  <option value="SUSPENDED">Tạm ngưng mở bán (Suspended)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Lý do điều chỉnh</label>
                <input
                  className="form-input"
                  value={orgStatusReason}
                  onChange={(e) => setOrgStatusReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedOrg) {
                      updateAdminOrgStatus(selectedOrg.id, orgTargetStatus);
                      showToast(`Đã cập nhật trạng thái của ${selectedOrg.name}.`, 'success');
                      setScreen('a-org-result');
                    }
                  }}
                >
                  Lưu thay đổi
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-orgs')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard icon="shield" />
        </div>
      )}

      {/* 8. a-org-result */}
      {activeScreen === 'a-org-result' && (
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
            Đã cập nhật trạng thái hoạt động của tổ chức
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14 }}>
            Thay đổi đã có hiệu lực tức thì và được ghi vào Lịch sử thao tác (Audit Log).
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-orgs')}>
            Danh sách tổ chức
          </button>
        </div>
      )}

      {/* 9. a-venue-verifications */}
      {activeScreen === 'a-venue-verifications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-kyc')}
            >
              ← Hồ sơ KYC tổ chức
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
                Hồ sơ xác minh địa điểm tổ chức
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.adminVenueQueue.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ĐỊA ĐIỂM</th>
                    <th>TỔ CHỨC</th>
                    <th>THÀNH PHỐ</th>
                    <th>TÀI LIỆU</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.adminVenueQueue.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 700 }}>{v.venueName}</td>
                      <td>{v.orgName}</td>
                      <td>{v.city}</td>
                      <td>{v.docName}</td>
                      <td>
                        <span
                          className={`badge ${
                            v.status === 'VERIFIED' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {v.status === 'VERIFIED' ? 'Đã xác minh' : 'Chờ xác minh'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVenueQueueId(v.id);
                            setScreen('a-venue-review');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Kiểm tra →
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

      {/* 10. a-venue-review */}
      {activeScreen === 'a-venue-review' && (
        <div>
          <FigmaNavyContextBanner
            title={selectedVenueQueue?.orgName || 'Tổ chức'}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={selectedVenueQueue?.status === 'VERIFIED' ? 'Đã xác minh' : 'Chờ xác minh địa điểm'}
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Tên địa điểm',
                value: `${selectedVenueQueue?.venueName || 'Địa điểm'} · ${selectedVenueQueue?.city || 'TP.HCM'}`,
              },
              { label: 'Loại hình & Sức chứa', value: 'Không gian tổ chức · Sơ đồ và sức chứa quản lý riêng' },
              { label: 'Tổ chức sở hữu', value: `${selectedVenueQueue?.orgName || 'Ánh Trăng Events'}` },
              { label: 'Hợp đồng / Giấy phép mặt bằng', value: `${selectedVenueQueue?.docName || 'giay-phep.pdf'}` },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc(selectedVenueQueue?.docName || 'giay-phep.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedVenueQueue) {
                  reviewAdminVenue(selectedVenueQueue.id, true);
                  showToast(`Đã xác minh địa điểm ${selectedVenueQueue.venueName}.`, 'success');
                  setScreen('a-venue-outcome');
                }
              }}
            >
              Xác minh địa điểm
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (selectedVenueQueue) {
                  reviewAdminVenue(selectedVenueQueue.id, false);
                  showToast('Đã yêu cầu bổ sung giấy tờ địa điểm.', 'warning');
                  setScreen('a-venue-verifications');
                }
              }}
            >
              Yêu cầu bổ sung giấy tờ
            </button>
          </div>
        </div>
      )}

      {/* 11. a-venue-outcome */}
      {activeScreen === 'a-venue-outcome' && (
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
            Đã xác minh địa điểm {selectedVenueQueue?.venueName || 'tổ chức'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14 }}>
            Tổ chức đã có thể phát hành (Publish) các phiên bản sơ đồ chỗ ngồi gắn với {selectedVenueQueue?.venueName || 'địa điểm này'}.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            Venue Verified
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScreen('a-venue-verifications')}
          >
            Danh sách xác minh địa điểm
          </button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Sóng Việt Events"
          status="Hồ sơ pháp lý"
        />
      )}
    </div>
  );
}
