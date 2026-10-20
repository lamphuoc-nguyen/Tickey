import { useState, type FormEvent } from 'react';
import { Plus, ShieldCheck, Trash2, Edit3, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import { useMockStore, type StaffItem } from '../../lib/mock-store';

export function OrgStaffPage() {
  const staffList = useMockStore((state) => state.staffList);
  const addStaff = useMockStore((state) => state.addStaff);
  const removeStaff = useMockStore((state) => state.removeStaff);
  const updateStaff = useMockStore((state) => state.updateStaff);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Nhân viên soát vé');
  const [inviteAssignment, setInviteAssignment] = useState('Cổng G1 · Đêm nhạc Mùa Thu');

  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editAssignment, setEditAssignment] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<StaffItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    addStaff({
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      assignment: inviteAssignment,
      status: 'Đã gửi lời mời',
    });

    setShowInviteModal(false);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('Nhân viên soát vé');
    setInviteAssignment('Cổng G1 · Đêm nhạc Mùa Thu');
    showToast(`Đã gửi lời mời kích hoạt thành công đến ${inviteName} (${inviteEmail})!`);
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    updateStaff(editingStaff.id, {
      role: editRole,
      assignment: editAssignment,
      status: editStatus,
    });

    showToast(`Đã cập nhật ca trực và quyền hạn cho ${editingStaff.name}!`);
    setEditingStaff(null);
  };

  const handleDeleteStaff = (stf: StaffItem) => {
    removeStaff(stf.id);
    setDeleteConfirm(null);
    showToast(`Đã hủy quyền truy cập của nhân viên ${stf.name}!`);
  };

  const openEditModal = (stf: StaffItem) => {
    setEditingStaff(stf);
    setEditRole(stf.role);
    setEditAssignment(stf.assignment);
    setEditStatus(stf.status);
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
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Quản lý đội ngũ nhân sự vận hành sự kiện, phân luồng cửa vào và cấp tài khoản ứng dụng Mobile Staff.
          </p>
        </div>

        <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Mời nhân viên mới</span>
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

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
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>
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
                      {stf.name ? stf.name.slice(0, 2).toUpperCase() : 'NV'}
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
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => openEditModal(stf)}
                    >
                      <Edit3 size={13} style={{ marginRight: '4px' }} />
                      Phân công ca
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', padding: '6px 8px', color: 'var(--danger, #dc2626)' }}
                      title="Xóa nhân viên"
                      onClick={() => setDeleteConfirm(stf)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            color: 'var(--muted)',
            backgroundColor: 'var(--bg)',
          }}
        >
          Tổng cộng {staffList.length} nhân sự trong ban vận hành
        </div>
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
              maxWidth: '480px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Mời nhân viên mới
              </h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Người được mời sẽ nhận email kích hoạt và đăng nhập ứng dụng Mobile Staff để soát vé. Dữ liệu sẽ được lưu cố định vào hệ thống.
            </p>

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Họ và tên nhân viên *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Lê Minh Khoa"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Email đăng nhập ứng dụng *
                </label>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Vai trò phân quyền
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Nhân viên soát vé">Nhân viên soát vé (Scan QR cổng)</option>
                  <option value="Thu ngân quầy POS">Thu ngân quầy POS (Bán vé tại chỗ)</option>
                  <option value="Quản lý ca trực">Quản lý ca trực (Supervisor)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Phân công ca trực ban đầu
                </label>
                <select
                  value={inviteAssignment}
                  onChange={(e) => setInviteAssignment(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Cổng G1 · Đêm nhạc Mùa Thu">Cổng G1 · Sảnh Mặt Tiền (Đêm nhạc Mùa Thu)</option>
                  <option value="Cổng G2 · Đêm nhạc Mùa Thu">Cổng G2 · Lối Vào Tầng 2 (Đêm nhạc Mùa Thu)</option>
                  <option value="Quầy vé sảnh A">Quầy vé sảnh A · Bán vé POS</option>
                  <option value="Hỗ trợ check-in luân phiên">Hỗ trợ check-in luân phiên</option>
                </select>
              </div>

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
                  <UserCheck size={16} />
                  Gửi lời mời & Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingStaff && (
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
              maxWidth: '480px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Phân công ca & Quyền hạn: {editingStaff.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '18px' }}>
              Mã NV: <strong>{editingStaff.id}</strong> · Email: {editingStaff.email}
            </p>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Vai trò
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Nhân viên soát vé">Nhân viên soát vé (Scan QR cổng)</option>
                  <option value="Thu ngân quầy POS">Thu ngân quầy POS (Bán vé tại chỗ)</option>
                  <option value="Quản lý ca trực">Quản lý ca trực (Supervisor)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Cổng / Vị trí trực
                </label>
                <select
                  value={editAssignment}
                  onChange={(e) => setEditAssignment(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Cổng G1 · Đêm nhạc Mùa Thu">Cổng G1 · Sảnh Mặt Tiền (Đêm nhạc Mùa Thu)</option>
                  <option value="Cổng G2 · Đêm nhạc Mùa Thu">Cổng G2 · Lối Vào Tầng 2 (Đêm nhạc Mùa Thu)</option>
                  <option value="Quầy vé sảnh A">Quầy vé sảnh A · Bán vé POS</option>
                  <option value="Hỗ trợ check-in luân phiên">Hỗ trợ check-in luân phiên</option>
                  <option value="Chưa phân công ca">Chưa phân công ca</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Trạng thái làm việc
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Đang hoạt động">Đang hoạt động</option>
                  <option value="Đã gửi lời mời">Đã gửi lời mời (Chờ xác nhận)</option>
                  <option value="Tạm nghỉ">Tạm nghỉ</option>
                </select>
              </div>

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
                  onClick={() => setEditingStaff(null)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Cập nhật phân công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', color: 'var(--danger, #dc2626)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Xác nhận xóa nhân sự</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Bạn có chắc chắn muốn xóa nhân viên <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) khỏi hệ thống? Người này sẽ bị thu hồi quyền truy cập ứng dụng soát vé ngay lập tức.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ backgroundColor: 'var(--danger, #dc2626)', color: '#fff', border: 'none' }}
                onClick={() => handleDeleteStaff(deleteConfirm)}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
