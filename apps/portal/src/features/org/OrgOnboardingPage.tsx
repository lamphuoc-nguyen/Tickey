import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Clock, AlertTriangle, XCircle, Building2, Lock, ShieldOff } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaRecordInfoCard,
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const ONBOARDING_SCREENS: FigmaScreenOption[] = [
  { id: 'o-create', label: '1. Thông tin tổ chức' },
  { id: 'o-kyc', label: '2. Hồ sơ xác minh' },
  { id: 'o-kyc-pending', label: '3. Theo dõi xét duyệt' },
  { id: 'o-kyc-info', label: 'Bổ sung thông tin KYC' },
  { id: 'o-org-rejected', label: 'Hồ sơ tổ chức bị từ chối' },
  { id: 'o-songviet-empty', label: 'Tổng quan · Sóng Việt Events' },
  { id: 'o-songviet-venue', label: 'Hồ sơ địa điểm · Sóng Việt' },
  { id: 'o-songviet-layout', label: 'Sơ đồ ghế · Sóng Việt Events' },
  { id: 'o-songviet-event', label: 'Tạo sự kiện · Sóng Việt Events' },
  { id: 'o-access-blocked', label: 'Tài khoản tổ chức tạm ngưng' },
];

export function OrgOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, updateOrgOnboarding, submitOrgKyc } = useMockStore();
  const { showToast } = useToast();

  const orgParam = searchParams.get('org');
  const activeScreen = searchParams.get('screen') || searchParams.get('view') || 'o-create';
  const setScreen = (screen: string) =>
    setSearchParams(orgParam ? { screen, org: orgParam } : { screen });

  const isSongViet = orgParam === 'songviet' || activeScreen.startsWith('o-songviet');
  const songVietKyc = state.adminKycQueue?.find((k) => k.orgName.includes('Sóng Việt'));
  const currentOrgName = isSongViet
    ? 'Sóng Việt Events'
    : state.orgOnboarding.orgName || 'Ánh Trăng Events';
  const currentKycStatus = isSongViet
    ? songVietKyc?.status || 'PENDING'
    : state.orgOnboarding.status;

  const [orgName, setOrgName] = useState(
    isSongViet ? 'Sóng Việt Events' : state.orgOnboarding.orgName || 'Ánh Trăng Events',
  );
  const [taxCode, setTaxCode] = useState(
    isSongViet ? '0318899221' : state.orgOnboarding.taxCode || '0312456789',
  );
  const [email, setEmail] = useState(
    isSongViet ? 'ops@songvietevents.vn' : state.orgOnboarding.email || 'ops@anhtrangevents.vn',
  );
  const [phone, setPhone] = useState(
    isSongViet ? '0912 345 678' : state.orgOnboarding.phone || '0901 234 567',
  );

  const [gpkdFile, setGpkdFile] = useState(state.orgOnboarding.gpkdFile || 'GPKD_AnhTrang_2026.pdf · 2.4 MB');
  const [cccdFile, setCccdFile] = useState(state.orgOnboarding.cccdFile || 'CCCD_Rep_2026.pdf · 1.1 MB');

  const [extraDoc, setExtraDoc] = useState('GPKD_Trang2_BoSung.pdf');
  const [extraNote, setExtraNote] = useState('Đã tải bản scan màu 300dpi có dấu giáp lai.');

  const [svVenueName, setSvVenueName] = useState('Trung tâm Hội nghị Sóng Việt');
  const [svVenueAddr, setSvVenueAddr] = useState('88 Nguyễn Huệ, Quận 1, TP.HCM');
  const [svVenueType, setSvVenueType] = useState('Hội trường đa năng · 600 chỗ');
  const [svVenueDoc, setSvVenueDoc] = useState('HopDongThue_SongViet_2026.pdf');

  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const screenMeta =
    ONBOARDING_SCREENS.find((s) => s.id === activeScreen) || ONBOARDING_SCREENS[0];

  const handleSaveOrgInfo = (goNext: boolean) => {
    updateOrgOnboarding({
      orgName,
      taxCode,
      email,
      phone,
    });
    showToast(
      goNext
        ? 'Đã lưu thông tin tổ chức và chuyển sang bước Hồ sơ xác minh.'
        : 'Đã lưu nháp thông tin tổ chức.',
      'success',
    );
    if (goNext) setScreen('o-kyc');
  };

  const handleSubmitKyc = () => {
    submitOrgKyc(gpkdFile, cccdFile, { orgName, taxCode, email, phone });
    showToast('Đã gửi hồ sơ xác minh KYC tới Admin.', 'success');
    setScreen('o-kyc-pending');
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={ONBOARDING_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-create */}
      {activeScreen === 'o-create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên tổ chức</label>
                <input
                  className="form-input"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Mã số thuế</label>
                <input
                  className="form-input"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email liên hệ</label>
                <input
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Số điện thoại</label>
                <input
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSaveOrgInfo(false)}
                >
                  Lưu nháp
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSaveOrgInfo(true)}
                >
                  Tiếp tục sang KYC
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 2. o-kyc */}
      {activeScreen === 'o-kyc' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tài liệu xác minh tổ chức
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  border: '1.5px dashed var(--border)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  textAlign: 'center',
                  background: '#FAF7F2',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  Giấy phép đăng ký kinh doanh
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{gpkdFile}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    Đổi tệp
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setGpkdFile(`${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPreviewDoc(gpkdFile)}
                  >
                    Xem trước
                  </button>
                </div>
              </div>

              <div
                style={{
                  border: '1.5px dashed var(--border)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  textAlign: 'center',
                  background: '#FAF7F2',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  CCCD/Hộ chiếu người đại diện
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{cccdFile}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    Đổi tệp
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setCccdFile(`${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPreviewDoc(cccdFile)}
                  >
                    Xem trước
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-create')}
                >
                  Quay lại
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSubmitKyc}>
                  Gửi xét duyệt KYC
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Tóm tắt hồ sơ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tổ chức</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{orgName}</div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mã số thuế</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{taxCode}</div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Trạng thái</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Đủ tài liệu bắt buộc</div>
              </div>
            </div>
            <FigmaInfoAlert tone="info">
              Sau khi gửi, Admin sẽ xem xét và phản hồi qua thông báo.
            </FigmaInfoAlert>
          </div>
        </div>
      )}

      {/* 3. o-kyc-pending */}
      {activeScreen === 'o-kyc-pending' && (
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
          {currentKycStatus === 'APPROVED' ? (
            <>
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
                <Building2 size={24} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Hồ sơ KYC đã được Admin phê duyệt thành công!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}>
                Tổ chức {currentOrgName} đã được kích hoạt đầy đủ quyền tạo sự kiện, xuất vé và quyết toán.
              </div>
              <span className="badge badge-success" style={{ marginBottom: 18 }}>
                Đã xác minh (KYC Approved)
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {isSongViet ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setScreen('o-songviet-empty')}
                  >
                    Thiết lập địa điểm đầu tiên →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate('/org/events')}
                  >
                    Bắt đầu tạo sự kiện →
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/org/venues')}
                >
                  Quản lý địa điểm
                </button>
              </div>
            </>
          ) : currentKycStatus === 'NEED_INFO' ? (
            <>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: '#FDF4E7',
                  color: '#C26B13',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Admin yêu cầu bổ sung thông tin hồ sơ
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}>
                {state.orgOnboarding.rejectionReason || 'Vui lòng bổ sung giấy tờ xác minh theo yêu cầu của Admin.'}
              </div>
              <span className="badge badge-warning" style={{ marginBottom: 18 }}>
                Cần bổ sung hồ sơ
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setScreen('o-kyc-info')}
                >
                  Bổ sung tài liệu ngay →
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreviewDoc(gpkdFile)}
                >
                  Xem lại tài liệu đã nộp
                </button>
              </div>
            </>
          ) : currentKycStatus === 'REJECTED' ? (
            <>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: '#FDF2F0',
                  color: '#D34528',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <XCircle size={24} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Hồ sơ KYC đã bị từ chối
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}>
                Lý do: {state.orgOnboarding.rejectionReason || 'Thông tin doanh nghiệp không khớp với cơ sở dữ liệu quốc gia.'}
              </div>
              <span className="badge badge-danger" style={{ marginBottom: 18 }}>
                Hồ sơ bị từ chối
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setScreen('o-kyc')}
                >
                  Nộp lại hồ sơ KYC
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: '#FDF4E7',
                  color: '#C26B13',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Clock size={24} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Hồ sơ KYC đang chờ xét duyệt
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14, lineHeight: 1.5 }}>
                Tổ chức {currentOrgName} đang được Admin đối soát hồ sơ pháp lý. Bạn sẽ nhận thông báo ngay khi hoàn tất.
              </div>
              <span className="badge badge-warning" style={{ marginBottom: 18 }}>
                Đang xét duyệt · SLA 24h
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreviewDoc(gpkdFile)}
                >
                  Xem lại tài liệu đã nộp
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-kyc-info')}
                >
                  Bổ sung thêm tài liệu
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. o-kyc-info */}
      {activeScreen === 'o-kyc-info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Yêu cầu từ Admin
            </div>
            <FigmaInfoAlert tone="warning">
              Vui lòng bổ sung bản sao công chứng GPKD trang 2 rõ dấu mộc.
            </FigmaInfoAlert>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tài liệu bổ sung</label>
                <input
                  className="form-input"
                  value={extraDoc}
                  onChange={(e) => setExtraDoc(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Ghi chú phản hồi</label>
                <input
                  className="form-input"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã gửi tài liệu bổ sung KYC cho Admin.', 'success');
                    setScreen('o-kyc-pending');
                  }}
                >
                  Gửi bổ sung
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-kyc-pending')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. o-org-rejected */}
      {activeScreen === 'o-org-rejected' && (
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
              background: '#FDECEC',
              color: '#C93535',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <XCircle size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Hồ sơ KYC không được phê duyệt
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Mã số thuế không khớp với giấy phép đăng ký kinh doanh đã tải lên. Bạn có thể cập nhật lại hồ sơ và gửi xét duyệt lại.
          </div>
          <span className="badge badge-danger" style={{ marginBottom: 18 }}>
            Đã từ chối
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-create')}
            >
              Cập nhật & gửi lại
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/org/reports')}
            >
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>
      )}

      {/* 6. o-songviet-empty */}
      {activeScreen === 'o-songviet-empty' && (
        <div
          className="card"
          style={{
            padding: '58px 32px',
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
              background: '#FDF0EC',
              color: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Building2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Tổ chức mới chưa có địa điểm & sự kiện
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 500, marginBottom: 18, lineHeight: 1.5 }}>
            Sóng Việt Events đã được duyệt KYC. Hãy thêm địa điểm tổ chức đầu tiên và gửi giấy tờ xác minh địa điểm trước khi tạo sơ đồ ghế.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-songviet-venue')}
            >
              Thêm địa điểm đầu tiên
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-songviet-layout')}
            >
              Xem hướng dẫn
            </button>
          </div>
        </div>
      )}

      {/* 7. o-songviet-venue */}
      {activeScreen === 'o-songviet-venue' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên địa điểm</label>
                <input
                  className="form-input"
                  value={svVenueName}
                  onChange={(e) => setSvVenueName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Địa chỉ</label>
                <input
                  className="form-input"
                  value={svVenueAddr}
                  onChange={(e) => setSvVenueAddr(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Loại hình</label>
                <input
                  className="form-input"
                  value={svVenueType}
                  onChange={(e) => setSvVenueType(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Giấy tờ pháp lý / Hợp đồng thuê</label>
                <input
                  className="form-input"
                  value={svVenueDoc}
                  onChange={(e) => setSvVenueDoc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã gửi hồ sơ địa điểm Sóng Việt chờ Admin xác minh.', 'success');
                    setScreen('o-songviet-layout');
                  }}
                >
                  Gửi xác minh địa điểm
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => showToast('Đã lưu nháp hồ sơ địa điểm Sóng Việt.', 'info')}
                >
                  Lưu nháp
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 8. o-songviet-layout */}
      {activeScreen === 'o-songviet-layout' && (
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
              background: '#FDF4E7',
              color: '#C26B13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Lock size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Chưa thể phát hành sơ đồ ghế
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 500, marginBottom: 14, lineHeight: 1.5 }}>
            Địa điểm Trung tâm Hội nghị Sóng Việt đang chờ Admin xác minh giấy tờ pháp lý. Bạn có thể lưu bản nháp sơ đồ nhưng chỉ được phát hành sau khi địa điểm được duyệt.
          </div>
          <span className="badge badge-warning" style={{ marginBottom: 18 }}>
            Địa điểm chờ xác minh
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-songviet-venue')}
            >
              Xem trạng thái địa điểm
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-songviet-event')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* 9. o-songviet-event */}
      {activeScreen === 'o-songviet-event' && (
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
              background: '#FDF4E7',
              color: '#C26B13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Cần sơ đồ ghế đã phát hành
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 500, marginBottom: 18, lineHeight: 1.5 }}>
            Để tạo sự kiện và cấu hình hạng vé theo ghế, tổ chức cần ít nhất 1 địa điểm đã xác minh và 1 sơ đồ ghế đã phát hành (Published).
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/org/venues?screen=o-venues')}
            >
              Mở Địa điểm & sơ đồ
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-songviet-empty')}
            >
              Quay lại tổng quan
            </button>
          </div>
        </div>
      )}

      {/* 10. o-access-blocked */}
      {activeScreen === 'o-access-blocked' && (
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
              background: '#FDECEC',
              color: '#C93535',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ShieldOff size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Tổ chức đang bị tạm ngưng hoạt động
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, marginBottom: 14, lineHeight: 1.5 }}>
            Quyền mở bán sự kiện mới và yêu cầu rút tiền đang tạm khóa để phục vụ đối soát rủi ro định kỳ. Các sự kiện đang diễn ra vẫn check-in bình thường.
          </div>
          <span className="badge badge-danger" style={{ marginBottom: 18 }}>
            Suspended · Mã HS-902
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/org/reports?screen=o-dispute-response')}
            >
              Gửi giải trình tới Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/org/reports?screen=o-refund-policy')}
            >
              Xem chính sách
            </button>
          </div>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization={activeScreen.startsWith('o-songviet') ? 'Sóng Việt Events' : orgName}
          status="Đã tải lên hợp lệ"
        />
      )}
    </div>
  );
}
