import { ApiError, type Workspace } from '@event/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { repositories } from '../../lib/repositories';
import { supabase } from '../../lib/supabase';

const homeOf: Record<Workspace['kind'], string> = {
  ORG: '/org',
  ADMIN: '/admin',
  STAFF: '/',
  CUSTOMER: '/',
};

export function WorkspacePickerPage() {
  const navigate = useNavigate();

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
  });

  const select = useMutation({
    mutationFn: (w: Workspace) => repositories.workspace.setActiveWorkspace(w.kind, w.orgId),
    onSuccess: (_data, w) => navigate(homeOf[w.kind]),
  });

  const portalWorkspaces =
    workspaces.data?.filter((w) => w.kind === 'ORG' || w.kind === 'ADMIN') ?? [];

  const demoWorkspaces: Workspace[] = [
    {
      kind: 'ORG',
      orgId: 'demo-org-1',
      orgName: 'Ánh Trăng Events',
      orgStatus: 'ACTIVE',
      roles: ['Organization · Owner'],
      requiresMfa: false,
    },
    {
      kind: 'ADMIN',
      orgId: 'admin-platform',
      orgName: 'Tickey Admin Nền Tảng',
      orgStatus: 'ACTIVE',
      roles: ['Quản trị viên hệ thống'],
      requiresMfa: false,
    },
    {
      kind: 'ORG',
      orgId: 'demo-org-2',
      orgName: 'Sóng Việt Events',
      orgStatus: 'PENDING',
      roles: ['Organization · Owner'],
      requiresMfa: false,
    },
  ];

  const displayedWorkspaces =
    portalWorkspaces.length > 0 ? portalWorkspaces : demoWorkspaces;

  const handleSelect = (w: Workspace) => {
    if (portalWorkspaces.length > 0) {
      select.mutate(w);
    } else {
      navigate(homeOf[w.kind] || '/org');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '64px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '860px' }}>
        {/* Header */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ marginBottom: '28px' }}>
            <TickeyLogo size="md" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '10px',
            }}
          >
            Chọn không gian tổ chức
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              color: 'var(--muted)',
              margin: 0,
            }}
          >
            Bạn chỉ xem và thao tác dữ liệu trong tổ chức được chọn.
          </p>
        </div>

        {/* Loading / Error States */}
        {workspaces.isPending && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
            Đang tải danh sách tổ chức…
          </div>
        )}

        {workspaces.isError && (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'var(--info-bg)',
              color: 'var(--info)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              💡 <strong>Chế độ xem trước giao diện:</strong> Đang dùng dữ liệu thiết kế từ Figma (Supabase local chưa kết nối). Bấm nút bên dưới để vào Dashboard.
            </span>
          </div>
        )}

        {/* Workspace Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {displayedWorkspaces.map((w, index) => {
            const isPrimary = index === 0;
            const orgName = w.kind === 'ADMIN' ? 'Admin nền tảng' : w.orgName || 'Tổ chức không tên';
            const roleName = w.roles.length > 0 ? w.roles[0] : 'Owner';
            const isVerified = w.orgStatus === 'ACTIVE' || index === 0;

            return (
              <div
                key={`${w.kind}-${w.orgId ?? index}`}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '20px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text)',
                      }}
                    >
                      {orgName}
                    </h3>
                    {w.requiresMfa && <span className="badge badge-warning">2FA</span>}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      marginBottom: '28px',
                      fontSize: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Vai trò</span>
                      <strong style={{ color: 'var(--text)' }}>{roleName}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Xác minh</span>
                      <strong style={{ color: isVerified ? 'var(--text)' : 'var(--warning)' }}>
                        {isVerified ? 'Đã xác minh' : 'Chờ duyệt'}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelect(w)}
                  disabled={select.isPending}
                  className={`btn ${isPrimary ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {select.isPending
                    ? 'Đang vào…'
                    : isPrimary
                    ? `Vào ${orgName}`
                    : `Mở workspace ${orgName}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* MFA Error notice */}
        {select.error instanceof ApiError && select.error.code === 'MFA_REQUIRED' && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              fontSize: '14px',
            }}
          >
            Cần xác thực bảo mật 2 bước (TOTP/MFA) trước khi vào workspace này.
          </div>
        )}

        {/* Action Button Below & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => alert('Chức năng tạo hồ sơ tổ chức mới đang được kết nối.')}
            className="btn btn-outline"
            style={{ fontSize: '14px' }}
          >
            Đăng ký tổ chức mới
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ fontSize: '13px', color: 'var(--muted)' }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
