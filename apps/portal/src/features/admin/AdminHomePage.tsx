import {
  ArrowRight,
  Clock,
  FileText,
  Search,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function AdminHomePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const stats = [
    {
      title: 'KYC chờ duyệt',
      count: '6',
      time: 'Cập nhật lúc 10:42',
      icon: Wallet,
      color: '#D9422D',
      path: '/admin/kyc',
    },
    {
      title: 'Sự kiện chờ duyệt',
      count: '4',
      time: 'Cập nhật lúc 10:42',
      icon: Ticket,
      color: '#D9422D',
      path: '/admin/events',
    },
    {
      title: 'Tranh chấp đang mở',
      count: '3',
      time: 'Cập nhật lúc 10:42',
      icon: Users,
      color: '#D9422D',
      path: '/admin/reports',
    },
    {
      title: 'Phiếu chờ bạn',
      count: '2',
      time: 'Cập nhật lúc 10:42',
      icon: Clock,
      color: '#D9422D',
      path: '/admin/approvals',
    },
  ];

  const chartData = [
    { day: '01', value: 45 },
    { day: '02', value: 68 },
    { day: '03', value: 52 },
    { day: '04', value: 85 },
    { day: '05', value: 92 },
    { day: '06', value: 80 },
    { day: '07', value: 118, active: true },
  ];

  const pendingTasks = [
    {
      id: 'task-1',
      type: 'KYC · Sóng Việt Events',
      detail: 'Đã nộp giấy tờ GPKD & CCCD người đại diện',
      status: 'Chờ review',
      statusBadgeClass: 'badge badge-warning',
      path: '/admin/kyc',
    },
    {
      id: 'task-2',
      type: 'Payout · Ánh Trăng Events',
      detail: 'Phiếu đầu đã duyệt (320.000.000đ) · Cần người duyệt thứ hai',
      status: 'Cần phiếu thứ hai',
      statusBadgeClass: 'badge badge-warning',
      path: '/admin/approvals',
    },
  ];

  const filteredTasks = pendingTasks.filter((t) => {
    const matchesSearch =
      t.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.detail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>
                  {stat.title}
                </span>
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

      {/* Middle Row: Weekly Requests Chart & Two-Man Rule Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: '24px',
          marginBottom: '36px',
        }}
      >
        {/* Weekly Chart */}
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
              Yêu cầu được xử lý trong tuần
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>01/10 - 07/10/2026</span>
          </div>

          {/* Bar Chart Visualization */}
          <div
            style={{
              marginTop: '32px',
              position: 'relative',
              height: '160px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Horizontal Grid lines */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #F0ECE6',
                }}
              >
                <span style={{ fontSize: '11px', color: '#9CA3AF', width: '24px' }}>120</span>
                <div style={{ flex: 1 }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #F0ECE6',
                }}
              >
                <span style={{ fontSize: '11px', color: '#9CA3AF', width: '24px' }}>80</span>
                <div style={{ flex: 1 }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #F0ECE6',
                }}
              >
                <span style={{ fontSize: '11px', color: '#9CA3AF', width: '24px' }}>40</span>
                <div style={{ flex: 1 }} />
              </div>
            </div>

            {/* Bars */}
            <div
              style={{
                position: 'absolute',
                left: '36px',
                right: '12px',
                bottom: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              {chartData.map((item) => {
                const heightPercent = (item.value / 120) * 100;
                return (
                  <div
                    key={item.day}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: `${(heightPercent * 120) / 100}px`,
                        backgroundColor: item.active ? 'var(--primary)' : '#FADBD5',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                      title={`Ngày ${item.day}: ${item.value} yêu cầu`}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
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
                02
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                phiếu cần
                <br />
                người duyệt thứ hai
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
              Hủy suất diễn · Chi trả doanh thu
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

          {/* Table */}
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
                <tr
                  key={task.id}
                  onClick={() => navigate(task.path)}
                  style={{ cursor: 'pointer' }}
                >
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

          {/* Table Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            {filteredTasks.length} bản ghi · Dữ liệu minh họa
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
