import {
  Building2,
  CheckCircle2,
  Eye,
  FileCheck,
  Search,
} from 'lucide-react';
import { useState } from 'react';

interface KycItem {
  id: string;
  orgName: string;
  taxCode: string;
  representative: string;
  phone: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'NEED_INFO' | 'REJECTED';
  businessType: string;
  address: string;
  bankAccount: string;
}

export function AdminKycPage() {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'NEED_INFO' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKyc, setSelectedKyc] = useState<KycItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [kycList, setKycList] = useState<KycItem[]>([
    {
      id: 'KYC-001',
      orgName: 'Sóng Việt Events',
      taxCode: '0314892810',
      representative: 'Nguyễn Văn Hưng',
      phone: '0903 123 456',
      submittedAt: '18/10/2026 14:30',
      status: 'PENDING',
      businessType: 'Công ty Cổ phần Sự kiện & Truyền thông',
      address: 'Tầng 8, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
      bankAccount: '0071001234567 · Vietcombank TP.HCM',
    },
    {
      id: 'KYC-002',
      orgName: 'Âm Nhạc Mới Productions',
      taxCode: '0108923411',
      representative: 'Trần Thị Mai',
      phone: '0912 345 678',
      submittedAt: '19/10/2026 09:15',
      status: 'PENDING',
      businessType: 'Công ty TNHH Giải trí & Nghệ thuật',
      address: 'Số 45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
      bankAccount: '19034567890123 · Techcombank Thăng Long',
    },
    {
      id: 'KYC-003',
      orgName: 'Saigon Live Concerts',
      taxCode: '0309918234',
      representative: 'Lê Quốc Tuấn',
      phone: '0988 765 432',
      submittedAt: '17/10/2026 16:40',
      status: 'PENDING',
      businessType: 'Hộ kinh doanh biểu diễn nghệ thuật',
      address: '120 Nguyễn Thị Minh Khai, Q.3, TP. Hồ Chí Minh',
      bankAccount: '1029384756 · MB Bank Sài Gòn',
    },
    {
      id: 'KYC-004',
      orgName: 'Ánh Trăng Events',
      taxCode: '0315998822',
      representative: 'Phạm Minh Quang',
      phone: '0933 888 999',
      submittedAt: '10/10/2026 10:00',
      status: 'APPROVED',
      businessType: 'Công ty TNHH Tổ chức Sự kiện Ánh Trăng',
      address: '280 Nam Kỳ Khởi Nghĩa, Q.3, TP. Hồ Chí Minh',
      bankAccount: '0071009876543 · Vietcombank Nam Sài Gòn',
    },
  ]);

  const filtered = kycList.filter((item) => {
    if (activeTab !== 'ALL' && item.status !== activeTab) return false;
    if (
      searchTerm &&
      !item.orgName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !item.taxCode.includes(searchTerm)
    ) {
      return false;
    }
    return true;
  });

  const handleApprove = (id: string) => {
    setKycList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'APPROVED' } : k))
    );
    setSelectedKyc(null);
    setActionSuccess('Đã phê duyệt hồ sơ KYC thành công! Tổ chức đã được kích hoạt trạng thái ACTIVE.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleRequestInfo = (id: string) => {
    setKycList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'NEED_INFO' } : k))
    );
    setSelectedKyc(null);
    setActionSuccess('Đã gửi thông báo yêu cầu bổ sung giấy tờ tới email tổ chức.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleReject = (id: string) => {
    setKycList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'REJECTED' } : k))
    );
    setSelectedKyc(null);
    setActionSuccess('Đã từ chối hồ sơ KYC. Lý do đã được ghi nhận vào nhật ký kiểm toán.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          TICKEY / ADMIN / KYC
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Hồ sơ tổ chức & KYC
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
              Xét duyệt thông tin pháp lý, mã số thuế và tài khoản ngân hàng của đơn vị tổ chức sự kiện.
            </p>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs & Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`btn ${activeTab === 'PENDING' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Chờ xét duyệt ({kycList.filter((k) => k.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`btn ${activeTab === 'APPROVED' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Đã phê duyệt ({kycList.filter((k) => k.status === 'APPROVED').length})
          </button>
          <button
            onClick={() => setActiveTab('NEED_INFO')}
            className={`btn ${activeTab === 'NEED_INFO' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Cần bổ sung ({kycList.filter((k) => k.status === 'NEED_INFO').length})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`btn ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Tất cả hồ sơ
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            width: '280px',
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Tìm theo tên tổ chức, MST…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* KYC Table */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflowX: 'auto',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="table" style={{ width: '100%', minWidth: '960px', margin: 0 }}>
          <thead>
            <tr>
              <th style={{ minWidth: '220px' }}>Tổ chức</th>
              <th style={{ whiteSpace: 'nowrap' }}>Mã số thuế</th>
              <th style={{ minWidth: '180px' }}>Người đại diện & SĐT</th>
              <th style={{ whiteSpace: 'nowrap' }}>Ngày gửi</th>
              <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '140px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  Không tìm thấy hồ sơ nào trong mục này.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--primary-tint)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          flexShrink: 0,
                        }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text)', display: 'block' }}>{item.orgName}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.id}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.taxCode}</span>
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 500 }}>{item.representative}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{item.phone}</div>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--muted)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{item.submittedAt}</td>
                  <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {item.status === 'PENDING' && <span className="badge badge-warning">Chờ review</span>}
                    {item.status === 'APPROVED' && <span className="badge badge-success">Đã duyệt</span>}
                    {item.status === 'NEED_INFO' && <span className="badge badge-info">Cần bổ sung</span>}
                    {item.status === 'REJECTED' && <span className="badge badge-danger">Từ chối</span>}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => setSelectedKyc(item)}
                      className="btn btn-outline"
                      style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Eye size={14} style={{ marginRight: '6px' }} />
                      Xem xét hồ sơ
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Review Modal (a-kyc-review) */}
      {selectedKyc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  REVIEW HỒ SƠ KYC · {selectedKyc.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedKyc.orgName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedKyc(null)}
                className="btn-ghost"
                style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Document Details Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Mã số thuế</div>
                  <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{selectedKyc.taxCode}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Loại hình</div>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedKyc.businessType}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Địa chỉ trụ sở chính</div>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedKyc.address}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Người đại diện</div>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedKyc.representative}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{selectedKyc.phone}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Tài khoản đối soát</div>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedKyc.bankAccount}</strong>
                </div>
              </div>

              {/* Uploaded Documents Attachment list */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                  Tài liệu đính kèm đã kiểm tra
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} color="var(--success)" />
                      <span>Giấy phép đăng ký kinh doanh (GPKD.pdf)</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
                      Xem trước
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} color="var(--success)" />
                      <span>CCCD mặt trước & sau người đại diện pháp luật</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
                      Xem trước
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => handleReject(selectedKyc.id)}
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '13px' }}
              >
                Từ chối hồ sơ
              </button>
              <button
                onClick={() => handleRequestInfo(selectedKyc.id)}
                className="btn btn-outline"
                style={{ fontSize: '13px' }}
              >
                Yêu cầu bổ sung
              </button>
              <button
                onClick={() => handleApprove(selectedKyc.id)}
                className="btn btn-primary"
                style={{ fontSize: '13px' }}
              >
                Phê duyệt KYC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
