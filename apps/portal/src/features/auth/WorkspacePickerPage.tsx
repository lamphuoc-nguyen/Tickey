import { ApiError, type Workspace } from '@event/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { repositories } from '../../lib/repositories';
import { supabase } from '../../lib/supabase';
import { useMockStore } from '../../lib/mock-store';

const homeOf: Record<Workspace['kind'], string> = {
  ORG: '/org',
  ADMIN: '/admin',
  STAFF: '/',
  CUSTOMER: '/',
};

export function WorkspacePickerPage() {
  const navigate = useNavigate();
  const { state, updateOrgOnboarding } = useMockStore();

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
  });

  const select = useMutation({
    mutationFn: (w: Workspace) => repositories.workspace.setActiveWorkspace(w.kind, w.orgId),
    onSuccess: (_data, w) => navigate(homeOf[w.kind]),
  });

  const songVietOrg = state.adminOrgs?.find((o) => o.name.includes('Sóng Việt'));
  const songVietKyc = state.adminKycQueue?.find((k) => k.orgName.includes('Sóng Việt'));
  const isSongVietApproved =
    songVietOrg?.status === 'ACTIVE' || songVietKyc?.status === 'APPROVED';

  const portalWorkspaces =
    workspaces.data?.filter((w) => w.kind === 'ORG' || w.kind === 'ADMIN') ?? [];

  const adminWs: Workspace = {
    kind: 'ADMIN',
    orgId: 'admin-platform',
    orgName: 'Admin nền tảng',
    orgStatus: 'ACTIVE',
    roles: ['Quản trị viên hệ thống'],
    requiresMfa: false,
  };

  // Collect all unique orgs dynamically from state.adminOrgs, state.adminKycQueue, and state.orgOnboarding
  const rawOrgMap = new Map<string, { id: string; name: string; isApproved: boolean }>();

  // 1. Initial base orgs
  rawOrgMap.set('Ánh Trăng Events', { id: 'demo-org-1', name: 'Ánh Trăng Events', isApproved: true });
  rawOrgMap.set('Sóng Việt Events', {
    id: 'demo-org-2',
    name: 'Sóng Việt Events',
    isApproved: isSongVietApproved,
  });

  // 2. Add from state.adminOrgs
  (state.adminOrgs || []).forEach((o) => {
    const kyc = state.adminKycQueue?.find((k) => k.orgName.toLowerCase() === o.name.toLowerCase());
    const isApproved = o.status === 'ACTIVE' || kyc?.status === 'APPROVED';
    rawOrgMap.set(o.name, {
      id: o.id,
      name: o.name,
      isApproved,
    });
  });

  // 3. Add from state.adminKycQueue
  (state.adminKycQueue || []).forEach((k) => {
    if (!rawOrgMap.has(k.orgName)) {
      rawOrgMap.set(k.orgName, {
        id: `org-${k.id}`,
        name: k.orgName,
        isApproved: k.status === 'APPROVED',
      });
    } else if (k.status === 'APPROVED') {
      const existing = rawOrgMap.get(k.orgName)!;
      rawOrgMap.set(k.orgName, { ...existing, isApproved: true });
    }
  });

  // 4. Add from state.orgOnboarding
  if (state.orgOnboarding?.orgName) {
    const onbName = state.orgOnboarding.orgName;
    const isApproved = state.orgOnboarding.status === 'APPROVED';
    if (!rawOrgMap.has(onbName)) {
      rawOrgMap.set(onbName, {
        id: 'org-onboarding',
        name: onbName,
        isApproved,
      });
    } else if (isApproved) {
      const existing = rawOrgMap.get(onbName)!;
      rawOrgMap.set(onbName, { ...existing, isApproved: true });
    }
  }

  // Convert to dynamic workspaces
  const dynamicOrgWorkspaces: Workspace[] = Array.from(rawOrgMap.values()).map((item) => ({
    kind: 'ORG',
    orgId: item.id,
    orgName: item.name,
    orgStatus: item.isApproved ? 'ACTIVE' : 'PENDING',
    roles: ['Organization · Owner'],
    requiresMfa: false,
  }));

  const demoWorkspaces: Workspace[] = [
    ...dynamicOrgWorkspaces.filter((w) => (w.orgName || '').includes('Ánh Trăng')),
    adminWs,
    ...dynamicOrgWorkspaces.filter((w) => !(w.orgName || '').includes('Ánh Trăng')),
  ];

  const displayedWorkspaces =
    portalWorkspaces.length > 0 ? portalWorkspaces : demoWorkspaces;

  const handleSelect = (w: Workspace) => {
    if (w.kind === 'ADMIN') {
      navigate('/admin');
      return;
    }
    // Update active orgName so the portal views the selected org
    if (w.orgName) {
      updateOrgOnboarding({
        orgName: w.orgName,
        status: w.orgStatus === 'ACTIVE' ? 'APPROVED' : 'PENDING',
      });
    }

    if (w.orgName?.includes('Sóng Việt')) {
      if (w.orgStatus === 'PENDING') {
        navigate('/org/onboarding?screen=o-kyc-pending&org=songviet');
      } else {
        navigate('/org/onboarding?screen=o-songviet-empty&org=songviet');
      }
      return;
    }
    if (w.orgStatus === 'PENDING') {
      navigate('/org/onboarding?screen=o-kyc-pending');
      return;
    }
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
            const orgName = w.kind === 'ADMIN' ? 'Admin nền tảng' : w.orgName || 'Tổ chức không tên';
            const roleName = w.roles.length > 0 ? w.roles[0] : 'Owner';
            const isVerified = w.orgStatus === 'ACTIVE';
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
                    : isVerified && w.kind === 'ORG'
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
