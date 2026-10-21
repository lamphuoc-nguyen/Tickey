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
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const ADMIN_APPROVAL_SCREENS: FigmaScreenOption[] = [
  { id: 'a-approvals', label: 'Phiếu phê duyệt kép (Dual Control)' },
  { id: 'a-approval-review', label: 'Chi tiết phiếu · AP-014 (Chi trả lớn)' },
  { id: 'a-approval-cancel', label: 'Chi tiết phiếu · AP-015 (Hủy sự kiện)' },
  { id: 'a-approval-hold', label: 'Chi tiết phiếu · AP-016 (Tạm giữ quỹ)' },
  { id: 'a-approval-result', label: 'Đã hoàn tất phê duyệt kép' },
];

export function AdminApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, signDualApproval } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-approvals';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>('ap-1');

  const approvalsList = state?.adminApprovals || [];
  const selectedApproval =
    approvalsList.find((a) => a.id === selectedApprovalId) ||
    approvalsList[0];

  const screenMeta =
    ADMIN_APPROVAL_SCREENS.find((s) => s.id === activeScreen) || ADMIN_APPROVAL_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_APPROVAL_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-approvals */}
      {activeScreen === 'a-approvals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
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
                placeholder="Tìm theo mã phiếu AP-..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => showToast('Đã xuất danh sách phiếu phê duyệt kép.', 'success')}
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
                Danh sách phiếu phê duyệt 2 lớp (Dual Control)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {approvalsList.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ PHIẾU</th>
                    <th>LOẠI NGHIỆP VỤ</th>
                    <th>ĐỐI TƯỢNG</th>
                    <th>ADMIN 1</th>
                    <th>ADMIN 2</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalsList.map((ap) => (
                    <tr key={ap.id}>
                      <td style={{ fontWeight: 700 }}>{ap.code}</td>
                      <td>{ap.type}</td>
                      <td>{ap.target}</td>
                      <td>{ap.firstAdmin}</td>
                      <td>{ap.secondAdmin || 'Chờ ký'}</td>
                      <td>
                        <span
                          className={`badge ${
                            ap.status === 'APPROVED_2_OF_2'
                              ? 'badge-success'
                              : ap.status === 'REJECTED'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {ap.status === 'APPROVED_2_OF_2'
                            ? 'Đã duyệt (2/2)'
                            : ap.status === 'REJECTED'
                              ? 'Đã từ chối'
                              : 'Chờ Admin 2 (1/2)'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApprovalId(ap.id);
                            if (ap.type.includes('Hủy sự kiện')) {
                              setScreen('a-approval-cancel');
                            } else if (ap.type.includes('Tạm giữ')) {
                              setScreen('a-approval-hold');
                            } else {
                              setScreen('a-approval-review');
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Ký duyệt →
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

      {/* 2. a-approval-review (Chi trả / Payout) */}
      {activeScreen === 'a-approval-review' && (
        <div>
          <FigmaNavyContextBanner
            title={selectedApproval?.type || 'Phê duyệt kép'}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={
              selectedApproval?.status === 'APPROVED_2_OF_2'
                ? 'Đã duyệt (2/2)'
                : selectedApproval?.status === 'REJECTED'
                  ? 'Đã từ chối'
                  : 'Chờ Admin thứ 2 (1/2)'
            }
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Mã phiếu & Loại nghiệp vụ',
                value: `${selectedApproval?.code || 'AP-014'} · ${selectedApproval?.type || 'Giải ngân chi trả'}`,
              },
              { label: 'Đối tượng & Số tiền', value: selectedApproval?.target || '64.200.000đ' },
              {
                label: 'Admin 1 khởi tạo',
                value: `${selectedApproval?.firstAdmin || 'admin-ops@tickey.vn'} · Đã ký hợp lệ`,
              },
              {
                label: 'Admin 2 phê duyệt',
                value: selectedApproval?.secondAdmin || 'admin-finance@tickey.vn (Tài khoản hiện tại)',
              },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('BienBanDoiSoat.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedApproval) {
                  signDualApproval(selectedApproval.id, true);
                  showToast(
                    `Đã ký phê duyệt lớp thứ 2 (2/2) cho phiếu ${selectedApproval.code}.`,
                    'success',
                  );
                  setScreen('a-approval-result');
                }
              }}
            >
              Ký phê duyệt lớp 2 (2/2)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (selectedApproval) {
                  signDualApproval(selectedApproval.id, false);
                  showToast(`Đã từ chối phiếu ${selectedApproval.code}.`, 'warning');
                  setScreen('a-approvals');
                }
              }}
            >
              Từ chối phiếu
            </button>
          </div>
        </div>
      )}

      {/* 3. a-approval-cancel (Hủy sự kiện) */}
      {activeScreen === 'a-approval-cancel' && (
        <div>
          <FigmaNavyContextBanner
            title="Hủy sự kiện & Hoàn tiền"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={
              selectedApproval?.status === 'APPROVED_2_OF_2'
                ? 'Đã duyệt hủy show'
                : 'Chờ Admin thứ 2 (1/2)'
            }
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Mã phiếu & Nghiệp vụ',
                value: `${selectedApproval?.code || 'AP-015'} · ${selectedApproval?.type || 'Hủy sự kiện'}`,
              },
              {
                label: 'Sự kiện & Lý do',
                value: selectedApproval?.target || 'Đêm nhạc Mùa Thu · Sự cố bất khả kháng',
              },
              {
                label: 'Admin 1 đã kiểm tra',
                value: `${selectedApproval?.firstAdmin || 'admin-ops@tickey.vn'} · Xác nhận hồ sơ hợp lệ`,
              },
              { label: 'Tác động hệ thống', value: 'Hủy vé & kích hoạt quy trình hoàn tiền tự động' },
            ]}
          />
          <FigmaInfoAlert tone="warning">
            Thao tác hủy sự kiện và hoàn tiền hàng loạt không thể hoàn tác sau khi Admin thứ 2 xác nhận.
          </FigmaInfoAlert>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedApproval) {
                  signDualApproval(selectedApproval.id, true);
                  showToast(`Đã phê duyệt hủy sự kiện ${selectedApproval.code} (2/2).`, 'success');
                  setScreen('a-approval-result');
                }
              }}
            >
              Ký duyệt hủy & hoàn tiền (2/2)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-approvals')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* 4. a-approval-hold (AP-016) */}
      {activeScreen === 'a-approval-hold' && (
        <div>
          <FigmaNavyContextBanner
            title="Sóng Việt Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Chờ Admin thứ 2 (1/2)"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã phiếu & Nghiệp vụ', value: 'AP-016 · Tạm giữ quỹ đối soát (Reserve Hold)' },
              { label: 'Tổ chức & Lý do', value: 'Sóng Việt Events · Tỷ lệ khiếu nại vượt ngưỡng 3%' },
              { label: 'Admin 1 đề xuất', value: 'admin-risk@tickey.vn' },
              { label: 'Thời hạn tạm giữ', value: '14 ngày làm việc để đối chiếu ngân hàng' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                signDualApproval('ap-3', true);
                showToast('Đã xác nhận tạm giữ quỹ rủi ro AP-016 (2/2).', 'success');
                setScreen('a-approval-result');
              }}
            >
              Xác nhận tạm giữ quỹ (2/2)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-approvals')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* 5. a-approval-result */}
      {activeScreen === 'a-approval-result' && (
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
            Đã hoàn tất phê duyệt kép (2/2 Admin)
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14 }}>
            Chữ ký số của 2 quản trị viên độc lập đã được ghi nhận vào sổ cái Audit Log và kích hoạt lệnh thực thi.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            Dual Control Executed · 2/2
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScreen('a-approvals')}
          >
            Danh sách phiếu phê duyệt
          </button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Hồ sơ phê duyệt kép"
        />
      )}
    </div>
  );
}
