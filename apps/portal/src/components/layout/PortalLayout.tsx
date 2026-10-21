import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  Calendar,
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  ScanLine,
  Ticket,
  Users,
  Wallet,
  Building2,
  Bell,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  Clock,
  ShieldAlert,
  FileCheck2,
} from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { TickeyLogo } from '../common/TickeyLogo';
import { ToastViewport } from '../common/ToastProvider';
import { api, formatDateTime } from '../../lib/api';
import { repositories } from '../../lib/repositories';
import { useSession } from '../../lib/use-session';
import { supabase } from '../../lib/supabase';

interface PortalLayoutProps {
  children?: ReactNode;
}

interface PortalNotification {
  id: string;
  title: string;
  createdAt: string;
  readAt: string | null;
  data: Record<string, unknown> | null;
}

const ONBOARDING_STEP_SCREENS = new Set([
  'o-create',
  'o-kyc',
  'o-kyc-pending',
  'o-kyc-info',
  'o-org-rejected',
  'o-songviet-venue',
]);

export function PortalLayout({ children }: PortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, workspace } = useSession();
  const queryClient = useQueryClient();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Name / roles of the active workspace (the JWT carries only kind + org id).
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
    enabled: !!session,
  });
  const activeWorkspace = workspaces.data?.find(
    (w) => w.kind === workspace.kind && (w.orgId ?? null) === (workspace.orgId ?? null),
  );

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<PortalNotification[]>('/api/notifications?limit=10'),
    enabled: !!session,
  });
  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.put('/api/notifications/read', { ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const notifications = (notificationsQuery.data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    time: formatDateTime(n.createdAt),
    path: typeof n.data?.path === 'string' ? n.data.path : null,
    unread: !n.readAt,
  }));

  const isAdmin = location.pathname.startsWith('/admin');
  const currentScreen = searchParams.get('screen') || '';
  const isOnboardingRoute = location.pathname.startsWith('/org/onboarding');
  const isOnboardingStepSidebar =
    isOnboardingRoute && (!currentScreen || ONBOARDING_STEP_SCREENS.has(currentScreen));

  const workspaceTitle = isAdmin ? 'TICKEY ADMIN' : (activeWorkspace?.orgName ?? 'Tổ chức');
  const roleName = isAdmin
    ? 'Quản trị nền tảng'
    : isOnboardingStepSidebar
      ? 'Đang thiết lập tổ chức'
      : (activeWorkspace?.roles.join(', ') ?? 'Thành viên tổ chức');
  const topContext = isAdmin ? 'Quản trị nền tảng' : 'Không gian tổ chức';
  const userInitials = (session?.user?.email?.slice(0, 2) || 'TK').toUpperCase();

  const orgNavItems = [
    { label: 'Tổng quan', path: '/org', icon: LayoutDashboard },
    { label: 'Sự kiện', path: '/org/events', icon: Calendar },
    { label: 'Địa điểm & sơ đồ', path: '/org/venues', icon: MapPin },
    { label: 'Nhân sự', path: '/org/staff', icon: Users },
    { label: 'Cổng & thiết bị', path: '/org/gates', icon: ScanLine },
    { label: 'Đơn vé & COMP', path: '/org/orders', icon: Ticket },
    { label: 'Tài chính', path: '/org/finance', icon: Wallet },
    { label: 'Phản ánh', path: '/org/reports', icon: MessageSquare },
  ];

  const adminNavItems = [
    { label: 'Tổng quan', path: '/admin', icon: LayoutDashboard },
    { label: 'Tổ chức & KYC', path: '/admin/kyc', icon: Building2 },
    { label: 'Sự kiện', path: '/admin/events', icon: Calendar },
    { label: 'Phiếu phê duyệt', path: '/admin/approvals', icon: ShieldCheck },
    { label: 'Phản ánh & hỗ trợ', path: '/admin/reports', icon: MessageSquare },
    { label: 'Hoàn tiền & chi trả', path: '/admin/payouts', icon: Wallet },
    { label: 'Đối soát', path: '/admin/reconciliation', icon: BarChart3 },
    { label: 'Lịch sử thao tác', path: '/admin/audit', icon: Clock },
  ];

  const currentNavItems = isAdmin ? adminNavItems : orgNavItems;

  const activeOnboardingStep =
    currentScreen === 'o-create' || !currentScreen
      ? 1
      : currentScreen === 'o-kyc' || currentScreen === 'o-songviet-venue'
        ? 2
        : 3;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // the next user must not see this account's cached org data
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 10,
        }}
      >
        <div>
          {/* Logo Header */}
          <div style={{ padding: '24px 20px 16px' }}>
            <TickeyLogo size="md" />
          </div>

          {/* Workspace Switcher Card */}
          <div style={{ padding: '0 16px 20px' }}>
            <button
              onClick={() => navigate('/workspaces')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s ease',
              }}
              title="Bấm để đổi workspace"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: isAdmin ? 'var(--info-bg)' : 'var(--primary-tint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isAdmin ? 'var(--info)' : 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  {isAdmin ? <ShieldAlert size={18} /> : <Building2 size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {workspaceTitle}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {roleName}
                  </div>
                </div>
              </div>
              <ChevronDown size={15} color="var(--muted)" style={{ flexShrink: 0, marginLeft: '6px' }} />
            </button>
          </div>

          {/* Navigation Links or 3-Step Onboarding Sidebar */}
          {!isAdmin && isOnboardingStepSidebar ? (
            <div style={{ padding: '0 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { step: 1, label: '1. Thông tin tổ chức', screen: 'o-create' },
                  { step: 2, label: '2. Hồ sơ xác minh', screen: 'o-kyc' },
                  { step: 3, label: '3. Theo dõi xét duyệt', screen: 'o-kyc-pending' },
                ].map((item) => {
                  const isActive = activeOnboardingStep === item.step;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => navigate(`/org/onboarding?screen=${item.screen}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 13.5,
                        fontWeight: isActive ? 700 : 500,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: isActive ? 'var(--primary)' : 'var(--text)',
                        backgroundColor: isActive ? 'var(--primary-tint)' : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isActive ? 'var(--primary)' : 'var(--border)',
                          flexShrink: 0,
                        }}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--muted)',
                  lineHeight: 1.5,
                  margin: '16px 8px 0',
                }}
              >
                Chức năng vận hành được mở sau khi hồ sơ được phê duyệt.
              </p>
              <button
                type="button"
                onClick={() => navigate('/org')}
                style={{
                  marginTop: 12,
                  marginLeft: 8,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  cursor: 'pointer',
                }}
              >
                ← Quay lại Tổng quan
              </button>
            </div>
          ) : (
            <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/org' || item.path === '/admin'
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 500,
                      textDecoration: 'none',
                      color: isActive ? 'var(--primary)' : 'var(--text)',
                      backgroundColor: isActive ? 'var(--primary-tint)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--muted)'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Bottom Sidebar Action Widget */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isAdmin ? (
            <button
              onClick={() => navigate('/admin/kyc?screen=a-venue-verifications')}
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '13px', padding: '10px' }}
            >
              Xác minh địa điểm
            </button>
          ) : (
            <div
              onClick={() => navigate('/org/reports')}
              style={{
                backgroundColor: 'var(--navy)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: 'pointer',
              }}
              title="Mở Trung tâm hỗ trợ & Khiếu nại"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="#FFFFFF" />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Cần trợ giúp?</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Trung tâm hỗ trợ Tickey →
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '64px',
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 36px',
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>{topContext}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setUserMenuOpen(false);
                }}
                className="btn-ghost"
                style={{
                  position: 'relative',
                  padding: '8px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Thông báo"
              >
                <Bell size={19} color="var(--text)" />
                {notifications.some((n) => n.unread) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                )}
              </button>

              {notifOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    width: '320px',
                    padding: '10px',
                    zIndex: 25,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px 10px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <strong style={{ fontSize: '13px' }}>Thông báo hệ thống</strong>
                    <button
                      type="button"
                      onClick={() => {
                        const unread = notifications.filter((n) => n.unread).map((n) => n.id);
                        if (unread.length) markRead.mutate(unread);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginTop: '6px',
                    }}
                  >
                    {!notifications.length && (
                      <div style={{ padding: '10px', fontSize: '13px', color: 'var(--muted)' }}>
                        Chưa có thông báo.
                      </div>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (n.unread) markRead.mutate([n.id]);
                          setNotifOpen(false);
                          if (n.path) navigate(n.path);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          backgroundColor: n.unread ? 'var(--primary-tint)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: n.unread ? 700 : 500,
                            color: 'var(--text)',
                          }}
                        >
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {n.time}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar with dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isAdmin ? 'var(--info-bg)' : 'var(--primary-container)',
                    color: isAdmin ? 'var(--info)' : 'var(--primary-text)',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {userInitials}
                </div>
                <ChevronDown size={14} color="var(--muted)" />
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    width: '230px',
                    padding: '8px',
                    zIndex: 20,
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {session?.user?.email || 'admin-a@dev.local'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{roleName}</div>
                  </div>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate(isAdmin ? '/org' : '/admin');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>{isAdmin ? 'Đổi sang Org Portal' : 'Đổi sang Admin Portal'}</span>
                  </button>

                  {!isAdmin && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/org/onboarding?screen=o-create');
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                      }}
                    >
                      <FileCheck2 size={14} />
                      <span>Thiết lập & KYC tổ chức</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/workspaces');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                    }}
                  >
                    <Building2 size={14} />
                    <span>Chọn Workspace</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--danger)',
                    }}
                  >
                    <LogOut size={14} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content View */}
        <main style={{ padding: '28px 36px 56px', flex: 1 }}>{children ?? <Outlet />}</main>
        <ToastViewport />
      </div>
    </div>
  );
}
