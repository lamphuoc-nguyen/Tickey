import { useState, type FormEvent } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';

export function OrgStaffPage() {
  const [staffList, setStaffList] = useState([
    {
      id: 'STF-01',
      name: 'Lê Minh Khoa',
      email: 'khoa.le@dev.local',
      role: 'Nhân viên soát vé',
      assignment: 'Cổng G1 · Đêm nhạc Mùa Thu',
      status: 'Đang hoạt động',
    },
    {
      id: 'STF-02',
      name: 'Nguyễn Văn An',
      email: 'an.nguyen@dev.local',
      role: 'Thu ngân quầy POS',
      assignment: 'Quầy vé sảnh A',
      status: 'Đang hoạt động',
    },
    {
      id: 'STF-03',
      name: 'Trần Thị Bích',
      email: 'bich.tran@dev.local',
      role: 'Nhân viên soát vé',
      assignment: 'Cổng G2 · Đêm nhạc Mùa Thu',
      status: 'Đã gửi lời mời',
    },
  ]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Nhân viên soát vé');

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setStaffList([
      ...staffList,
      {
        id: `STF-0${staffList.length + 1}`,
        name: inviteName || 'Nhân viên mới',
        email: inviteEmail,
        role: inviteRole,
        assignment: 'Chưa phân công ca',
        status: 'Đã gửi lời mời',
      },
    ]);

    setShowInviteModal(false);
    setInviteEmail('');
    setInviteName('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <span className="tag-overline">NHÂN SỰ & PHÂN CÔNG</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Nhân viên soát vé & Quầy POS
          </h1>
        </div>

        <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Mời nhân viên mới</span>
        </button>
      </div>

      {/* Staff Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Họ tên & Email
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Vai trò
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Phân công hiện tại
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Trạng thái
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((stf) => (
              <tr key={stf.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-container)',
                        color: 'var(--primary-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {stf.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{stf.name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{stf.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text)',
                      fontWeight: 500,
                    }}
                  >
                    <ShieldCheck size={14} color="var(--primary)" />
                    {stf.role}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--muted)' }}>
                  {stf.assignment}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span
                    className={`badge ${stf.status === 'Đang hoạt động' ? 'badge-success' : 'badge-warning'}`}
                  >
                    {stf.status}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '13px', padding: '6px 10px', color: 'var(--primary)' }}
                    onClick={() => alert(`Cập nhật quyền và phân công cho ${stf.name}`)}
                  >
                    Phân công ca
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              Mời nhân viên mới
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Người được mời sẽ nhận email kích hoạt và đăng nhập ứng dụng Mobile Staff để soát vé.
            </p>

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                Họ và tên
                <input
                  type="text"
                  placeholder="Ví dụ: Lê Minh Khoa"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </label>

              <label>
                Vai trò phân quyền
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="Nhân viên soát vé">Nhân viên soát vé (Scan QR cổng)</option>
                  <option value="Thu ngân quầy POS">Thu ngân quầy POS (Bán vé tại chỗ)</option>
                  <option value="Quản lý ca trực">Quản lý ca trực (Supervisor)</option>
                </select>
              </label>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Gửi lời mời
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
