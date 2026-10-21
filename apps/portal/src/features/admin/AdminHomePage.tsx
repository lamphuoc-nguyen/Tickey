import { ArrowRight, Clock, FileText, Search, ShieldCheck, Ticket, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDateTime } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  APPROVAL_SUBJECT,
  useAdminDisputes,
  useAdminEvents,
  useAdminKyc,
  useApprovals,
} from './data/admin-data';

/** Số hiển thị trên thẻ KPI: số bản ghi khi đã tải, … khi đang tải, ! khi lỗi. */
const countLabel = (query: { isPending: boolean; isError: boolean; data?: unknown[] }) => {
  if (query.isPending) return '…';
  if (query.isError) return '!';
  return String((query.data ?? []).length);
};

export function AdminHomePage() {
  const navigate = useNavigate();
  const session = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const kyc = useAdminKyc('SUBMITTED');
  const events = useAdminEvents('PENDING_REVIEW');
  const disputes = useAdminDisputes('OPEN');
  const approvals = useApprovals();

  const userId = session.session?.user.id;

  /** Phiếu đang chờ và tài khoản hiện tại chưa biểu quyết. */
  const myPendingApprovals = useMemo(
    () => (approvals.data ?? []).filter((a) => !(a.votes ?? []).some((v) => v.voterId === userId)),
    [approvals.data, userId],
  );

  const stats = [
    {
      title: 'KYC chờ duyệt',
      count: countLabel(kyc),
      time: 'Dữ liệu trực tiếp',
      icon: Wallet,
      color: '#D9422D',
      path: '/admin/kyc',
    },
    {
      title: 'Sự kiện chờ duyệt',
      count: countLabel(events),
      time: 'Dữ liệu trực tiếp',
      icon: Ticket,
      color: '#D9422D',
      path: '/admin/events',
    },
    {
      title: 'Tranh chấp đang mở',
      count: countLabel(disputes),
      time: 'Dữ liệu trực tiếp',
      icon: Users,
      color: '#D9422D',
      path: '/admin/reports',
    },
    {
      title: 'Phiếu chờ bạn',
      count: approvals.isPending ? '…' : approvals.isError ? '!' : String(myPendingApprovals.length),
      time: 'Dữ liệu trực tiếp',
      icon: Clock,
      color: '#D9422D',
      path: '/admin/approvals',
    },
  ];

  const queueBars = [
    { label: 'KYC', value: kyc.data?.length ?? 0, path: '/admin/kyc' },
    { label: 'Sự kiện', value: events.data?.length ?? 0, path: '/admin/events' },
    { label: 'Tranh chấp', value: disputes.data?.length ?? 0, path: '/admin/reports' },
    { label: 'Duyệt kép', value: myPendingApprovals.length, path: '/admin/approvals' },
  ];
  const maxQueue = Math.max(1, ...queueBars.map((q) => q.value));

  const pendingTasks = [
    ...(kyc.data ?? []).map((k) => ({
      id: `kyc-${k.id}`,
      type: `KYC · ${k.org?.name ?? k.orgId.slice(0, 8)}`,
      detail: `Hồ sơ nộp ${formatDateTime(k.submittedAt)} · ${k.documents.length} tài liệu`,
      status: 'Chờ review',
      statusBadgeClass: 'badge badge-warning',
      path: '/admin/kyc',
    })),
    ...myPendingApprovals.map((a) => {
      const approveVotes = (a.votes ?? []).filter((v) => v.decision === 'APPROVE').length;
      return {
        id: `approval-${a.id}`,
        type: `Duyệt kép · ${APPROVAL_SUBJECT[a.subjectType] ?? a.subjectType}`,
        detail: `Đã có ${approveVotes}/${a.requiredVotes} phiếu duyệt · tạo ${formatDateTime(a.createdAt)}`,
        status: 'Cần phiếu thứ hai',
        statusBadgeClass: 'badge badge-warning',
        path: '/admin/approvals',
      };
    }),
  ];

  const filteredTasks = pendingTasks.filter((t) => {
    const needle = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !needle || t.type.toLowerCase().includes(needle) || t.detail.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const approvalSubjects = [
    ...new Set(myPendingApprovals.map((a) => APPROVAL_SUBJECT[a.subjectType] ?? a.subjectType)),
  ];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Page Header */}
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
          TICKEY / ADMIN
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Tổng quan nền tảng
        </h1>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              onClick={() => navigate(stat.path)}
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>{stat.title}</span>
                <Icon size={20} color={stat.color} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '36px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1,
                    marginBottom: '8px',
                  }}
                >
                  {stat.count}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{stat.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Row: Queue Chart & Two-Man Rule Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: '24px',
          marginBottom: '36px',
        }}
      >
        {/* Queue Chart */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 4px',
              }}
            >
              Hàng đợi đang mở
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Số hồ sơ theo từng khu vực xử lý</span>
          </div>

          <QueryNotice
            loading={kyc.isPending || events.isPending || disputes.isPending || approvals.isPending}
            error={kyc.error ?? events.error ?? disputes.error ?? approvals.error}
          />

          <div
            style={{
              marginTop: '32px',
              position: 'relative',
              height: '160px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              gap: '16px',
            }}
          >
            {queueBars.map((item) => {
              const heightPercent = (item.value / maxQueue) * 100;
              return (
                <div
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{item.value}</span>
                  <div
                    style={{
                      width: '38px',
                      height: `${Math.max(4, heightPercent * 1.2)}px`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                    title={`${item.label}: ${item.value} hồ sơ`}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dark Navy Two-Man Rule Card */}
        <div
          style={{
            backgroundColor: 'var(--navy)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 24px',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '24px',
              }}
            >
              <ShieldCheck size={22} color="#FFFFFF" />
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: '#FFFFFF',
                }}
              >
                Chờ phê duyệt
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '52px',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: '#FFFFFF',
                }}
              >
                {approvals.isPending ? '…' : String(myPendingApprovals.length).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                phiếu cần
                <br />
                người duyệt thứ hai
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
              {approvalSubjects.length ? approvalSubjects.join(' · ') : 'Hủy suất diễn · Chi trả doanh thu'}
            </p>
          </div>

          <button
            onClick={() => navigate('/admin/approvals')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginTop: '24px',
            }}
          >
            <span>Mở hàng đợi</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Action Table Section: "Cần bạn xử lý" */}
      <div style={{ marginBottom: '28px' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
          }}
        >
          Cần bạn xử lý
        </h2>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          {/* Search & Filter Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                width: '320px',
              }}
            >
              <Search size={16} color="var(--muted)" />
              <input
                type="text"
                placeholder="Tìm trong danh sách"
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '190px', fontSize: '13px', padding: '7px 14px' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Chờ review">Chờ review</option>
              <option value="Cần phiếu thứ hai">Cần phiếu thứ hai</option>
            </select>
          </div>

          <QueryNotice
            loading={kyc.isPending || approvals.isPending}
            error={kyc.error ?? approvals.error}
            onRetry={() => {
              void kyc.refetch();
              void approvals.refetch();
            }}
            empty={!filteredTasks.length}
            emptyText="Không có hồ sơ nào cần bạn xử lý."
          />

          {!!filteredTasks.length && (
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Đối tượng</th>
                  <th style={{ width: '45%' }}>Chi tiết</th>
                  <th style={{ width: '20%' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id} onClick={() => navigate(task.path)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={18} color="var(--primary)" />
                        <strong style={{ color: 'var(--text)' }}>{task.type}</strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text)' }}>{task.detail}</td>
                    <td>
                      <span className={task.statusBadgeClass}>{task.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Table Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            {filteredTasks.length} bản ghi · Dữ liệu trực tiếp
          </div>
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div>
        <button
          onClick={() => navigate('/admin/kyc')}
          className="btn btn-primary"
          style={{
            padding: '14px 32px',
            fontSize: '15px',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Xử lý hồ sơ KYC
        </button>
      </div>
    </div>
  );
}
