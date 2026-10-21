import { ApiError, type Workspace } from '@event/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { errorMessage } from '../../lib/api';
import { repositories } from '../../lib/repositories';
import { supabase } from '../../lib/supabase';

const ORG_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Chưa nộp hồ sơ',
  PENDING_REVIEW: 'Chờ duyệt',
  NEEDS_INFO: 'Cần bổ sung hồ sơ',
  APPROVED: 'Đã xác minh',
  REJECTED: 'Bị từ chối',
  SUSPENDED: 'Tạm ngưng',
  TERMINATED: 'Đã chấm dứt',
};

// An Org that cannot sell yet goes to onboarding (KYC); an approved one to its dashboard.
const destination = (w: Workspace) =>
  w.kind === 'ADMIN' ? '/admin' : w.orgStatus === 'APPROVED' ? '/org' : '/org/onboarding';

export function WorkspacePickerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
  });

  // set_active_workspace + token refresh: every API call after this carries the chosen Org / Admin scope.
  const select = useMutation({
    mutationFn: (w: Workspace) => repositories.workspace.setActiveWorkspace(w.kind, w.orgId),
    onSuccess: (_data, w) => {
      queryClient.clear();
      navigate(destination(w));
    },
  });

  const portalWorkspaces = workspaces.data?.filter((w) => w.kind === 'ORG' || w.kind === 'ADMIN') ?? [];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
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

        {/* Loading / Error / Empty */}
        {workspaces.isPending && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
            Đang tải danh sách tổ chức…
          </div>
        )}

        {(workspaces.isError || (workspaces.isSuccess && !portalWorkspaces.length)) && (
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
              gap: 12,
            }}
          >
            <span>
              {workspaces.isError
                ? errorMessage(workspaces.error)
                : 'Tài khoản chưa thuộc tổ chức nào. Đăng ký tổ chức mới để bắt đầu bán vé.'}
            </span>
            {workspaces.isError && (
              <button type="button" className="btn btn-secondary" onClick={() => void workspaces.refetch()}>
                Thử lại
              </button>
            )}
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
          {portalWorkspaces.map((w, index) => {
            const orgName = w.kind === 'ADMIN' ? 'Admin nền tảng' : w.orgName || 'Tổ chức không tên';
            const roleName = w.roles.length > 0 ? w.roles.join(', ') : 'Thành viên';
            const isVerified = w.kind === 'ADMIN' || w.orgStatus === 'APPROVED';
            const isPrimary = isVerified && w.kind === 'ORG';

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

                    {w.kind === 'ORG' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Xác minh</span>
                        <strong style={{ color: isVerified ? 'var(--text)' : 'var(--warning)' }}>
                          {ORG_STATUS_LABELS[w.orgStatus ?? ''] ?? w.orgStatus ?? '—'}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => select.mutate(w)}
                  disabled={select.isPending}
                  className={`btn ${isPrimary ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {select.isPending ? 'Đang vào…' : `Vào ${orgName}`}
                </button>
              </div>
            );
          })}
        </div>

        {select.error && (
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
            {select.error instanceof ApiError && select.error.code === 'MFA_REQUIRED' ? (
              <>
                Cần xác thực bảo mật 2 bước (TOTP) trước khi vào workspace này.{' '}
                <a href="/mfa-setup" style={{ color: 'inherit', fontWeight: 700 }}>
                  Thiết lập / nhập mã 2FA →
                </a>
              </>
            ) : (
              errorMessage(select.error)
            )}
          </div>
        )}

        {/* Action Button Below & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/org/onboarding')}
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
