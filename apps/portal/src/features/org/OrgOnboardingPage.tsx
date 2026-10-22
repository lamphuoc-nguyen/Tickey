import { useState } from 'react';
import { ApiError } from '@event/core';
import { useNavigate, useSearchParams } from 'react-router';
import { Clock, AlertTriangle, XCircle, Building2, ShieldOff, Upload } from 'lucide-react';
import { api, errorMessage, formatDateTime, useOrgId } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaRecordInfoCard,
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import {
  BUSINESS_TYPES,
  KYC_DOC_TYPES,
  KYC_REQUIRED_DOC_TYPES,
  KYC_STATUS,
  ORG_STATUS,
  orgSlug,
  useCreateOrganization,
  useOrgKyc,
  useOrganization,
  useSubmitKyc,
  type KycSubmission,
} from './data/org-data';

const ONBOARDING_SCREENS: FigmaScreenOption[] = [
  { id: 'o-create', label: '1. Thông tin tổ chức' },
  { id: 'o-kyc', label: '2. Hồ sơ xác minh' },
  { id: 'o-kyc-pending', label: '3. Theo dõi xét duyệt' },
  { id: 'o-kyc-info', label: 'Bổ sung thông tin KYC' },
  { id: 'o-org-rejected', label: 'Hồ sơ tổ chức bị từ chối' },
];

/** One upload slot per required / optional KYC document type. */
interface DocSlot {
  docType: string;
  file: File | null;
  uploading: boolean;
  storagePath: string | null;
  error: string | null;
}

/** Same limits as POST /api/uploads, checked first so the user gets a specific message. */
const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const emptySlots = (): DocSlot[] =>
  ['BUSINESS_LICENSE', 'ID_CARD_FRONT', 'ID_CARD_BACK', 'OTHER'].map((docType) => ({
    docType,
    file: null,
    uploading: false,
    storagePath: null,
    error: null,
  }));

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/** Step 1 without an Org workspace: create a DRAFT Org (caller becomes OWNER) and switch to it. */
function CreateOrgForm({ onCreated, onNeedsMfa }: { onCreated: () => void; onNeedsMfa: () => void }) {
  const navigate = useNavigate();
  const create = useCreateOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [businessType, setBusinessType] = useState('COMPANY');

  const finalSlug = slugEdited ? slug : orgSlug(name);
  const slugValid = /^[a-z0-9-]{3,60}$/.test(finalSlug);
  const error = create.error;
  const slugTaken = error instanceof ApiError && error.details.field === 'p_slug' && error.details.reason === 'taken';

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>
        Đăng ký tổ chức mới
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Bạn sẽ là Chủ tổ chức. Sau khi tạo, tiếp tục nộp hồ sơ xác minh để được duyệt bán vé.
      </div>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { name: name.trim(), slug: finalSlug, businessType },
            { onSuccess: ({ needsMfa }) => (needsMfa ? onNeedsMfa() : onCreated()) },
          );
        }}
      >
        <div>
          <label className="form-label">Tên tổ chức</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Công ty Âm Sắc"
            required
          />
        </div>
        <div>
          <label className="form-label">Đường dẫn (slug)</label>
          <input
            className="form-input"
            value={finalSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="cong-ty-am-sac"
          />
          <div style={{ fontSize: 12, color: slugTaken || (finalSlug && !slugValid) ? '#B42318' : 'var(--muted)', marginTop: 6 }}>
            {slugTaken
              ? 'Đường dẫn này đã có tổ chức khác dùng. Hãy chọn đường dẫn khác.'
              : '3–60 ký tự: chữ thường không dấu, số và dấu gạch ngang.'}
          </div>
        </div>
        <div>
          <label className="form-label">Loại hình</label>
          <select className="form-input" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {Object.entries(BUSINESS_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && !slugTaken && <div style={{ fontSize: 12, color: '#B42318' }}>{errorMessage(error)}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={create.isPending || !name.trim() || !slugValid}
          >
            {create.isPending ? 'Đang tạo…' : 'Tạo tổ chức'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/workspaces')}>
            Chọn workspace khác
          </button>
        </div>
      </form>
    </div>
  );
}

export function OrgOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = useOrgId();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-create';
  // Screens render only for an Org workspace; the header still shows which step was asked for.
  const screen = orgId ? activeScreen : null;
  const setScreen = (next: string) => setSearchParams({ screen: next });

  const org = useOrganization(orgId);
  const kyc = useOrgKyc(orgId);
  const submitKyc = useSubmitKyc(orgId);

  const [slots, setSlots] = useState<DocSlot[]>(emptySlots);
  const [identityNumber, setIdentityNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [representative, setRepresentative] = useState('');

  const submissions = kyc.data ?? [];
  const latest: KycSubmission | undefined = submissions[0];
  const orgStatus = org.data?.status ?? 'DRAFT';
  const orgMeta = ORG_STATUS[orgStatus] ?? { label: orgStatus, badge: 'badge-info' };

  const pickFile = async (docType: string, file: File) => {
    if (!orgId) return;
    const invalid = !UPLOAD_TYPES.includes(file.type)
      ? 'Chỉ nhận tệp PDF, JPG, PNG hoặc WEBP.'
      : file.size === 0 || file.size > UPLOAD_MAX_BYTES
        ? 'Tệp phải lớn hơn 0 và không quá 10 MB.'
        : null;
    // A new pick replaces the old upload, so a failed retry never leaves the previous path behind.
    setSlots((prev) =>
      prev.map((s) =>
        s.docType === docType
          ? { ...s, file, storagePath: null, uploading: !invalid, error: invalid }
          : s,
      ),
    );
    if (invalid) return;
    try {
      const uploaded = await api.upload(file, 'KYC', orgId);
      setSlots((prev) =>
        prev.map((s) =>
          s.docType === docType ? { ...s, uploading: false, storagePath: uploaded.path } : s,
        ),
      );
    } catch (error) {
      setSlots((prev) =>
        prev.map((s) => (s.docType === docType ? { ...s, uploading: false, error: errorMessage(error) } : s)),
      );
    }
  };

  const requiredMissing = KYC_REQUIRED_DOC_TYPES.some(
    (docType) => !slots.find((s) => s.docType === docType && s.storagePath),
  );
  const uploading = slots.some((s) => s.uploading);

  const handleSubmit = () => {
    const documents = slots
      .filter((s) => s.storagePath)
      .map((s) => ({ docType: s.docType, storagePath: s.storagePath as string }));
    submitKyc.mutate(
      {
        legalInfo: {
          legal_name: legalName.trim(),
          address: address.trim(),
          representative: representative.trim(),
          contact_email: org.data?.contactEmail ?? '',
          contact_phone: org.data?.contactPhone ?? '',
        },
        identityNumber: identityNumber.trim(),
        documents,
      },
      {
        onSuccess: (created) => {
          showToast('Đã gửi hồ sơ xác minh KYC tới Admin.', 'success');
          setSearchParams({ screen: 'o-kyc-pending' });
          if (created?.id) setSlots(emptySlots());
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const screenMeta = ONBOARDING_SCREENS.find((s) => s.id === activeScreen) || ONBOARDING_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={ONBOARDING_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* Without an Org workspace the org queries stay disabled (pending forever): offer to create one instead. */}
      {!orgId && (
        <CreateOrgForm
          onCreated={() => {
            showToast('Đã tạo tổ chức. Tiếp tục nộp hồ sơ xác minh.', 'success');
            setScreen('o-kyc');
          }}
          onNeedsMfa={() => {
            showToast('Đã tạo tổ chức. Chủ tổ chức cần bật 2FA trước khi vào workspace.', 'success');
            navigate('/mfa-setup');
          }}
        />
      )}

      {org.isError && (
        <QueryNotice loading={false} error={org.error} onRetry={() => org.refetch()} />
      )}

      {/* 1. o-create — org info recorded at creation, read-only here. */}
      {screen === 'o-create' && !org.isError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
                Thông tin tổ chức
              </div>
              <span className={`badge ${orgMeta.badge}`}>{orgMeta.label}</span>
            </div>
            <QueryNotice
              loading={org.isPending}
              error={org.error}
              onRetry={() => org.refetch()}
              empty={!org.data}
              emptyText="Không tìm thấy tổ chức của workspace đang hoạt động."
            />
            {org.data && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <InfoRow label="Tên tổ chức" value={org.data.name} />
                  <InfoRow label="Slug" value={org.data.slug} />
                  <InfoRow label="Loại hình" value={BUSINESS_TYPES[org.data.businessType] ?? org.data.businessType} />
                  <InfoRow label="Mã số thuế" value={org.data.taxCode || '—'} />
                  <InfoRow label="Email liên hệ" value={org.data.contactEmail || '—'} />
                  <InfoRow label="Số điện thoại" value={org.data.contactPhone || '—'} />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setScreen('o-kyc')}
                    disabled={orgStatus === 'PENDING_REVIEW' || orgStatus === 'APPROVED'}
                  >
                    Tiếp tục sang KYC
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate('/org')}>
                    Về tổng quan
                  </button>
                </div>
                {orgStatus === 'PENDING_REVIEW' && (
                  <div style={{ marginTop: 14 }}>
                    <FigmaInfoAlert tone="info">
                      Hồ sơ xác minh đang chờ Admin xét duyệt. Theo dõi trạng thái tại bước 3.
                    </FigmaInfoAlert>
                  </div>
                )}
              </>
            )}
          </div>
          <FigmaRecordInfoCard
            title="Thông tin tổ chức đã ghi nhận"
            description="Tên, mã số thuế và thông tin liên hệ được lưu cùng tổ chức khi tạo workspace và dùng cho hồ sơ xác minh."
          />
        </div>
      )}

      {/* 2. o-kyc — upload documents and submit the dossier. */}
      {screen === 'o-kyc' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tài liệu xác minh tổ chức
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {slots.map((slot) => (
                <div
                  key={slot.docType}
                  style={{
                    border: '1.5px dashed var(--border)',
                    borderRadius: 12,
                    padding: '18px 20px',
                    background: '#FAF7F2',
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                    {KYC_DOC_TYPES[slot.docType]}
                    {KYC_REQUIRED_DOC_TYPES.includes(slot.docType) && (
                      <span style={{ color: 'var(--brand)', marginLeft: 4 }}>*</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                    {slot.storagePath
                      ? slot.file?.name || 'Đã tải lên'
                      : 'PDF, JPG, PNG hoặc WEBP · tối đa 10 MB'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      {slot.uploading ? 'Đang tải…' : slot.storagePath ? 'Đổi tệp' : 'Chọn tệp'}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        disabled={slot.uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void pickFile(slot.docType, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {slot.storagePath && (
                      <span className="badge badge-success" style={{ alignSelf: 'center' }}>
                        Đã tải lên
                      </span>
                    )}
                  </div>
                  {slot.error && (
                    <div style={{ fontSize: 12, color: '#B42318', marginTop: 8 }}>{slot.error}</div>
                  )}
                </div>
              ))}

              <div>
                <label className="form-label">Số CCCD/MST người đại diện</label>
                <input
                  className="form-input"
                  value={identityNumber}
                  onChange={(e) => setIdentityNumber(e.target.value)}
                  placeholder="Nhập số định danh để đối chiếu"
                />
              </div>
              <div>
                <label className="form-label">Tên pháp lý</label>
                <input
                  className="form-input"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={org.data?.legalName || org.data?.name || ''}
                />
              </div>
              <div>
                <label className="form-label">Địa chỉ trụ sở</label>
                <input
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Người đại diện theo pháp luật</label>
                <input
                  className="form-input"
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-create')}>
                  Quay lại
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitKyc.isPending || uploading || requiredMissing}
                >
                  {submitKyc.isPending ? 'Đang gửi…' : 'Gửi xét duyệt KYC'}
                </button>
              </div>
              {requiredMissing && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Cần tải lên Giấy phép đăng ký kinh doanh và mặt trước CCCD/Hộ chiếu người đại diện.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Tóm tắt hồ sơ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <InfoRow label="Tổ chức" value={org.data?.name || '—'} />
              <InfoRow label="Mã số thuế" value={org.data?.taxCode || '—'} />
              <InfoRow
                label="Tài liệu bắt buộc"
                value={requiredMissing ? 'Chưa đủ' : 'Đủ tài liệu bắt buộc'}
              />
            </div>
            <FigmaInfoAlert tone="info">
              Sau khi gửi, Admin sẽ xem xét và phản hồi qua thông báo.
            </FigmaInfoAlert>
          </div>
        </div>
      )}

      {/* 3. o-kyc-pending — status of the latest submission. */}
      {screen === 'o-kyc-pending' && (
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
          <QueryNotice
            loading={kyc.isPending || org.isPending}
            error={kyc.error || org.error}
            onRetry={() => {
              void kyc.refetch();
              void org.refetch();
            }}
          />
          {!kyc.isPending && !kyc.error && !org.isPending && !org.error && (
            <>
              {orgStatus === 'APPROVED' ? (
                <>
                  <div style={iconBox('#EAF7F0', '#18794E')}>
                    <Building2 size={24} />
                  </div>
                  <div style={titleStyle}>Hồ sơ KYC đã được Admin phê duyệt thành công!</div>
                  <div style={descStyle}>
                    {org.data?.name} đã được kích hoạt đầy đủ quyền tạo sự kiện, xuất vé và quyết toán.
                  </div>
                  <span className="badge badge-success" style={{ marginBottom: 18 }}>
                    Đã xác minh (KYC Approved)
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={() => navigate('/org/events')}>
                      Bắt đầu tạo sự kiện →
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/org/venues')}>
                      Quản lý địa điểm
                    </button>
                  </div>
                </>
              ) : orgStatus === 'NEEDS_INFO' ? (
                <>
                  <div style={iconBox('#FDF4E7', '#C26B13')}>
                    <AlertTriangle size={24} />
                  </div>
                  <div style={titleStyle}>Admin yêu cầu bổ sung thông tin hồ sơ</div>
                  <div style={descStyle}>
                    {latest?.reviewNote || org.data?.statusReason || 'Vui lòng bổ sung giấy tờ xác minh theo yêu cầu của Admin.'}
                  </div>
                  <span className="badge badge-warning" style={{ marginBottom: 18 }}>
                    Cần bổ sung hồ sơ
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={() => setScreen('o-kyc-info')}>
                      Bổ sung tài liệu ngay →
                    </button>
                  </div>
                </>
              ) : orgStatus === 'REJECTED' ? (
                <>
                  <div style={iconBox('#FDF2F0', '#D34528')}>
                    <XCircle size={24} />
                  </div>
                  <div style={titleStyle}>Hồ sơ KYC đã bị từ chối</div>
                  <div style={descStyle}>
                    Lý do: {latest?.reviewNote || org.data?.statusReason || 'Thông tin doanh nghiệp không khớp với cơ sở dữ liệu quốc gia.'}
                  </div>
                  <span className="badge badge-danger" style={{ marginBottom: 18 }}>
                    Hồ sơ bị từ chối
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={() => setScreen('o-org-rejected')}>
                      Xem chi tiết & nộp lại
                    </button>
                  </div>
                </>
              ) : orgStatus === 'SUSPENDED' ? (
                <>
                  <div style={iconBox('#FDECEC', '#C93535')}>
                    <ShieldOff size={24} />
                  </div>
                  <div style={titleStyle}>Tổ chức đang bị tạm ngưng hoạt động</div>
                  <div style={descStyle}>
                    {org.data?.statusReason ||
                      'Quyền mở bán sự kiện mới và yêu cầu rút tiền đang tạm khóa để phục vụ đối soát. Liên hệ Admin để được hỗ trợ.'}
                  </div>
                  <span className="badge badge-danger" style={{ marginBottom: 18 }}>
                    Tạm ngưng · {orgStatus}
                  </span>
                </>
              ) : (
                <>
                  <div style={iconBox('#FDF4E7', '#C26B13')}>
                    <Clock size={24} />
                  </div>
                  <div style={titleStyle}>Hồ sơ KYC đang chờ xét duyệt</div>
                  <div style={descStyle}>
                    {org.data?.name} đang được Admin đối soát hồ sơ pháp lý. Bạn sẽ nhận thông báo ngay khi hoàn tất.
                  </div>
                  <span className="badge badge-warning" style={{ marginBottom: 18 }}>
                    {latest ? `${KYC_STATUS[latest.status]?.label ?? latest.status} · gửi ${formatDateTime(latest.submittedAt)}` : 'Chưa gửi hồ sơ'}
                  </span>
                  {!latest && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" className="btn btn-primary" onClick={() => setScreen('o-kyc')}>
                        Gửi hồ sơ KYC
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* 4. o-kyc-info — resubmit when the Admin asked for more information. */}
      {screen === 'o-kyc-info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Yêu cầu từ Admin
            </div>
            <FigmaInfoAlert tone="warning">
              {latest?.reviewNote || org.data?.statusReason || 'Vui lòng bổ sung tài liệu xác minh theo yêu cầu của Admin.'}
            </FigmaInfoAlert>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              {slots.map((slot) => (
                <div key={slot.docType}>
                  <label className="form-label">{KYC_DOC_TYPES[slot.docType]}</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      {slot.uploading ? 'Đang tải…' : slot.storagePath ? 'Đổi tệp' : 'Chọn tệp'}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        disabled={slot.uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void pickFile(slot.docType, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {slot.storagePath ? slot.file?.name || 'Đã tải lên' : 'Chưa chọn tệp'}
                    </span>
                  </div>
                  {slot.error && <div style={{ fontSize: 12, color: '#B42318', marginTop: 6 }}>{slot.error}</div>}
                </div>
              ))}
              <div>
                <label className="form-label">Số CCCD/MST người đại diện</label>
                <input
                  className="form-input"
                  value={identityNumber}
                  onChange={(e) => setIdentityNumber(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitKyc.isPending || uploading || requiredMissing}
                >
                  {submitKyc.isPending ? 'Đang gửi…' : 'Gửi bổ sung'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-kyc-pending')}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard
            title="Hồ sơ bổ sung"
            description="Tài liệu mới sẽ thay thế hồ sơ đã nộp và đưa tổ chức trở lại trạng thái chờ xét duyệt."
          />
        </div>
      )}

      {/* 5. o-org-rejected — rejected dossier with a resubmit path. */}
      {screen === 'o-org-rejected' && (
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
          <div style={iconBox('#FDECEC', '#C93535')}>
            <XCircle size={24} />
          </div>
          <div style={titleStyle}>Hồ sơ KYC không được phê duyệt</div>
          <div style={{ ...descStyle, maxWidth: 480 }}>
            {latest?.reviewNote || org.data?.statusReason || 'Hồ sơ chưa đáp ứng yêu cầu xác minh. Bạn có thể cập nhật lại hồ sơ và gửi xét duyệt lại.'}
          </div>
          <span className="badge badge-danger" style={{ marginBottom: 18 }}>
            Đã từ chối
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('o-kyc-info')}>
              Cập nhật & gửi lại
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/org/reports')}>
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>
      )}

      {/* Submitted-document history, when there is one. */}
      {(screen === 'o-kyc-pending' || screen === 'o-org-rejected') && submissions.length > 0 && (
        <div className="card" style={{ padding: 22, marginTop: 18 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
            Lịch sử hồ sơ đã nộp
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {submissions.map((submission) => {
              const meta = KYC_STATUS[submission.status] ?? { label: submission.status, badge: 'badge-info' };
              return (
                <div
                  key={submission.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      Gửi {formatDateTime(submission.submittedAt)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {submission.documents.length} tài liệu
                      {submission.reviewedAt ? ` · xét duyệt ${formatDateTime(submission.reviewedAt)}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${meta.badge}`}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {slots.some((s) => s.storagePath) && screen === 'o-kyc' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          <Upload size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Tài liệu được tải lên kho bảo mật của tổ chức trước khi gửi xét duyệt.
        </div>
      )}
    </div>
  );
}

const iconBox = (bg: string, color: string) =>
  ({
    width: 48,
    height: 48,
    borderRadius: 14,
    background: bg,
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  }) as const;

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 6,
} as const;

const descStyle = {
  fontSize: 13,
  color: 'var(--muted)',
  maxWidth: 460,
  marginBottom: 14,
  lineHeight: 1.5,
} as const;
