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
} from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { TickeyLogo } from '../common/TickeyLogo';
import { useSession } from '../../lib/use-session';
import { supabase } from '../../lib/supabase';

interface PortalLayoutProps {
  children?: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');

  const workspaceTitle = isAdmin ? 'TICKEY ADMIN' : 'Ánh Trăng Events';
  const roleName = isAdmin ? 'Quản trị nền tảng' : 'Organization · Owner';
  const topContext = isAdmin ? 'Quản trị nền tảng' : 'Không gian tổ chức';
  const userInitials = isAdmin ? 'AD' : (session?.user?.email?.slice(0, 2) || 'AT').toUpperCase();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

          {/* Navigation Links */}
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
        </div>

        {/* Bottom Sidebar Action Widget */}
        <div style={{ padding: '16px' }}>
          {isAdmin ? (
            <button
              onClick={() => alert('Mở danh sách hồ sơ xác minh địa điểm (a-venue-verifications)')}
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '13px', padding: '10px' }}
            >
              Xác minh địa điểm
            </button>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--navy)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="#FFFFFF" />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Cần trợ giúp?</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Trung tâm hỗ trợ Tickey
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
          <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
            {topContext}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <button
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
            </button>

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
                    width: '210px',
                    padding: '8px',
                    zIndex: 20,
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{session?.user?.email || 'admin-a@dev.local'}</div>
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
        <main style={{ padding: '36px 40px 60px', flex: 1 }}>{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
