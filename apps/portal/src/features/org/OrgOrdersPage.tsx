import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search, Upload } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal, type DocumentPreviewItem } from '../../components/common/DocumentPreviewModal';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaDocumentRow,
  FigmaEventPreviewCard,
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { errorMessage, formatDateTime, formatVnd, useOrgId } from '../../lib/api';
import { useOrgEvents, useOrganization } from './data/org-data';
import { TICKET_KIND, inventoryOf, useSessionSeats, useTicketTypes } from './data/event-data';
import {
  BOOKING_STATUS,
  BOOKING_TYPE,
  PAYMENT_STATUS,
  TICKET_STATUS,
  buyerEmail,
  buyerName,
  orderSeats,
  useIssueCompTickets,
  useOrgCompTickets,
  useOrgOrder,
  useOrgOrders,
} from './data/order-data';
import {
  checkCompSeats,
  parseCompCsv,
  type CompCsvIssue,
  type CompCsvRow,
  type CompSeat,
} from './orders/comp-csv';

const ORDER_SCREENS: FigmaScreenOption[] = [
  { id: 'o-orders', label: 'Đơn vé khách hàng' },
  { id: 'o-order-detail', label: 'Chi tiết đơn vé' },
  { id: 'o-comp', label: 'Danh sách vé mời (COMP)' },
  { id: 'o-comp-create', label: 'Phát hành vé mời lẻ' },
  { id: 'o-comp-import', label: 'Nhập danh sách COMP từ CSV' },
  { id: 'o-comp-import-review', label: 'Kiểm tra danh sách CSV' },
  { id: 'o-comp-import-confirm', label: 'Xác nhận phát hành hàng loạt' },
  { id: 'o-comp-result', label: 'Đã phát hành vé mời COMP' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.entries(BOOKING_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại đơn' },
  ...Object.entries(BOOKING_TYPE).map(([value, label]) => ({ value, label })),
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Idempotency key của issue_comp_tickets: tối thiểu 8 ký tự và khác nhau cho mỗi lần phát. */
const newIdempotencyKey = () =>
  `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const csvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  return /[";,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Xuất CSV ngay trong trình duyệt, không cần endpoint riêng. */
function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  const meta = BOOKING_STATUS[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge-tint">{BOOKING_TYPE[type] ?? type}</span>;
}

export function OrgOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const orgId = useOrgId();
  const organization = useOrganization(orgId);

  const activeScreen = searchParams.get('screen') || 'o-orders';
  const orderId = searchParams.get('id');
  const setScreen = (screen: string, extra: Record<string, string> = {}) =>
    setSearchParams({ screen, ...extra });

  const orgName = organization.data?.name ?? 'Tổ chức';

  /* ---------------------------------------------------------------- đơn vé */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const orders = useOrgOrders(orgId, {
    status: status || undefined,
    type: type || undefined,
    q: search || undefined,
  });

  const order = useOrgOrder(orgId, orderId);
  const orderDetail = order.data;
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);

  /* ------------------------------------------------------------------ COMP */
  const events = useOrgEvents(orgId);
  const sessions = (events.data ?? []).flatMap((event) =>
    event.sessions.map((session) => ({ event, session })),
  );
  const [compSessionId, setCompSessionId] = useState('');
  const [compTypeId, setCompTypeId] = useState('');
  const [compSeatId, setCompSeatId] = useState('');
  const [compName, setCompName] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compSessionFilter, setCompSessionFilter] = useState('');
  const compTickets = useOrgCompTickets(orgId, compSessionFilter || undefined);

  const selectedSessionId =
    compSessionId || sessions.find((item) => item.session.id === compSessionFilter)?.session.id || '';
  const selectedSession = sessions.find((item) => item.session.id === selectedSessionId) ?? null;

  const ticketTypes = useTicketTypes(selectedSessionId);
  const compTypes = (ticketTypes.data ?? []).filter(
    (type_) => type_.kind === 'COMP' && type_.status === 'ACTIVE',
  );
  const selectedTypeId = compTypes.some((type_) => type_.id === compTypeId)
    ? compTypeId
    : (compTypes[0]?.id ?? '');
  const compType = compTypes.find((type_) => type_.id === selectedTypeId) ?? null;

  // Vé COMP chỉ phát được cho ghế thuộc khu vực của hạng vé (điều kiện của create_booking).
  const compZoneIds = new Set(compType?.zones.map((zone) => zone.zoneId) ?? []);
  const seats = useSessionSeats(selectedSessionId);
  const seatList: CompSeat[] = (seats.data ?? []).map((seat) => ({
    code: seat.seat.seatCode,
    free: seat.status === 'AVAILABLE',
    allowed: compZoneIds.has(seat.zoneId),
  }));
  const freeSeats = seatList.filter((seat) => seat.free && seat.allowed);
  const selectedSeatId = freeSeats.some((seat) => seat.code === compSeatId) ? compSeatId : '';
  const seatByCode = new Map((seats.data ?? []).map((seat) => [seat.seat.seatCode, seat]));

  const issue = useIssueCompTickets(orgId, selectedSessionId);
  const [issued, setIssued] = useState<{ count: number; session: string; type: string } | null>(null);

  /* ------------------------------------------------------------------- CSV */
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRows, setCsvRows] = useState<CompCsvRow[]>([]);
  const [csvIssues, setCsvIssues] = useState<CompCsvIssue[]>([]);

  const seatIssues = checkCompSeats(csvRows, seatList);
  const allCsvIssues = [...csvIssues, ...seatIssues];

  const screenMeta = ORDER_SCREENS.find((screen) => screen.id === activeScreen) || ORDER_SCREENS[0];

  /* --------------------------------------------------------------- hành động */
  const exportOrders = () => {
    const rows = (orders.data ?? []).map((row) => [
      row.code,
      buyerName(row),
      buyerEmail(row),
      row.session?.event?.title ?? '',
      row.session?.title ?? '',
      orderSeats(row)
        .map((line) => line.seat)
        .join(', '),
      row.totalAmount,
      BOOKING_STATUS[row.status]?.label ?? row.status,
      BOOKING_TYPE[row.bookingType] ?? row.bookingType,
      formatDateTime(row.createdAt),
    ]);
    downloadCsv('don-ve.csv', [
      [
        'Ma don',
        'Khach hang',
        'Email',
        'Su kien',
        'Suat dien',
        'Ghe',
        'Tong tien',
        'Trang thai',
        'Loai don',
        'Ngay tao',
      ],
      ...rows,
    ]);
    showToast(`Đã xuất ${rows.length} đơn vé ra CSV.`, 'success');
  };

  const downloadCsvTemplate = () =>
    downloadCsv('DanhSach_KhachMoi_COMP.csv', [
      ['HoTen', 'Email', 'MaGhe', 'DonVi'],
      ['Đặng Quốc Khánh', 'khanh.dang@sponsor.vn', 'G05', 'Nhà tài trợ'],
      ['Võ Bích Ngọc', 'ngoc.vo@press.vn', 'G06', 'Báo chí'],
    ]);

  const onPickCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseCompCsv(text);
    setCsvFileName(file.name);
    setCsvRows(parsed.rows);
    setCsvIssues(parsed.issues);
    setScreen('o-comp-import-review');
  };

  const submitSingleComp = () => {
    if (!selectedSessionId || !selectedTypeId) {
      showToast('Chọn suất diễn và hạng vé COMP trước khi phát hành.', 'warning');
      return;
    }
    if (!selectedSeatId) {
      showToast('Chọn ghế còn trống thuộc khu vực của hạng vé COMP.', 'warning');
      return;
    }
    if (!compName.trim()) {
      showToast('Nhập họ tên khách mời.', 'warning');
      return;
    }
    if (!EMAIL_PATTERN.test(compEmail.trim())) {
      showToast('Email nhận vé không hợp lệ.', 'warning');
      return;
    }
    const seat = seatByCode.get(selectedSeatId);
    issue.mutate(
      {
        ticketTypeId: selectedTypeId,
        recipients: [
          {
            email: compEmail.trim().toLowerCase(),
            name: compName.trim(),
            phone: compPhone.trim() || null,
            seatId: seat?.seatId ?? null,
          },
        ],
        idempotencyKey: newIdempotencyKey(),
      },
      {
        onSuccess: (result) => {
          setIssued({
            count: result.bookings?.length ?? 1,
            session: selectedSession?.session.title ?? selectedSession?.event.title ?? '',
            type: compType?.name ?? '',
          });
          setCompName('');
          setCompEmail('');
          setCompPhone('');
          setCompSeatId('');
          showToast('Đã phát hành vé mời COMP.', 'success');
          setScreen('o-comp-result');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const submitBulkComp = () => {
    if (!selectedSessionId || !selectedTypeId) {
      showToast('Chọn suất diễn và hạng vé COMP trước khi phát hành.', 'warning');
      return;
    }
    if (!csvRows.length) {
      showToast('Tệp CSV chưa có dòng hợp lệ nào.', 'warning');
      return;
    }
    const recipients = csvRows.map((row) => {
      const seat = seatByCode.get(row.seatCode);
      return {
        email: row.email,
        name: row.name,
        phone: null,
        seatId: seat?.seatId ?? null,
      };
    });
    issue.mutate(
      { ticketTypeId: selectedTypeId, recipients, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: (result) => {
          setIssued({
            count: result.bookings?.length ?? recipients.length,
            session: selectedSession?.session.title ?? selectedSession?.event.title ?? '',
            type: compType?.name ?? '',
          });
          showToast(`Đã phát hành ${result.bookings?.length ?? recipients.length} vé COMP.`, 'success');
          setScreen('o-comp-result');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const compQuota = compType ? inventoryOf(compType) : null;

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={ORDER_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-orders */}
      {activeScreen === 'o-orders' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <form
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
              }}
            >
              <div style={{ position: 'relative', width: 300 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Tìm theo tên, mã, email..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                Tìm
              </button>
              <select
                className="form-select"
                style={{ width: 170 }}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: 160 }}
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-comp')}>
                Vé mời (COMP)
              </button>
            </form>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={exportOrders}
                disabled={!orders.data?.length}
              >
                Xuất CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-comp-create')}
              >
                + Phát hành COMP
              </button>
            </div>
          </div>

          <QueryNotice
            loading={orders.isPending}
            error={orders.error}
            onRetry={() => void orders.refetch()}
            empty={!orders.isPending && !orders.error && !orders.data?.length}
            emptyText="Chưa có đơn vé nào trong tổ chức này."
          />

          {!!orders.data?.length && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                  Tất cả danh sách
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{orders.data.length} bản ghi</div>
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ ĐƠN</th>
                      <th>KHÁCH HÀNG</th>
                      <th>LOẠI</th>
                      <th>SUẤT DIỄN</th>
                      <th>GHẾ / HẠNG</th>
                      <th>TỔNG TIỀN</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.code}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{buyerName(row)}</div>
                          {buyerEmail(row) && (
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{buyerEmail(row)}</div>
                          )}
                        </td>
                        <td>
                          <TypeBadge type={row.bookingType} />
                        </td>
                        <td>
                          <div>{row.session?.event?.title ?? '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                            {row.session?.title ?? '—'} ·{' '}
                            {formatDateTime(row.session?.startsAt)}
                          </div>
                        </td>
                        <td>
                          <div>{orderSeats(row).map((line) => line.seat).join(', ') || '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                            {[...new Set(orderSeats(row).map((line) => line.ticketType))].join(', ')}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatVnd(row.totalAmount)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setScreen('o-order-detail', { id: row.id })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Chi tiết →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. o-order-detail */}
      {activeScreen === 'o-order-detail' && (
        <div>
          <FigmaNavyContextBanner
            title={orgName}
            subtitle={`Hồ sơ đang xem · ${order.data?.code ?? 'Đơn vé'}`}
            badge={order.data ? (BOOKING_STATUS[order.data.status]?.label ?? order.data.status) : '—'}
            image={organization.data?.logoUrl}
          />
          <QueryNotice
            loading={order.isPending}
            error={order.error}
            onRetry={() => void order.refetch()}
            empty={!order.isPending && !order.error && !order.data}
            emptyText="Không tìm thấy đơn vé này trong tổ chức."
          />
          {orderDetail && (
            <>
              <FigmaContextGrid
                items={[
                  {
                    label: 'Mã đơn & Khách hàng',
                    value: `${orderDetail.code} · ${buyerName(orderDetail)} (${buyerEmail(orderDetail) || 'không có email'})`,
                  },
                  {
                    label: 'Sự kiện & Suất diễn',
                    value: `${orderDetail.session?.event?.title ?? '—'} · ${orderDetail.session?.title ?? '—'} (${formatDateTime(orderDetail.session?.startsAt)})`,
                  },
                  {
                    label: 'Ghế & Hạng vé',
                    value: orderSeats(orderDetail)
                      .map((line) => `${line.seat} · ${line.ticketType}`)
                      .join(', ') || '—',
                  },
                  {
                    label: 'Thanh toán & Check-in',
                    value: `${formatVnd(orderDetail.totalAmount)} · ${
                      orderDetail.payments.length
                        ? orderDetail.payments
                            .map((payment) => PAYMENT_STATUS[payment.status] ?? payment.status)
                            .join(', ')
                        : 'Chưa có phiếu thanh toán'
                    }`,
                  },
                ]}
              />
              {orderDetail.flagged && (
                <FigmaInfoAlert tone="warning">
                  Đơn vé đang bị gắn cờ: {orderDetail.flagReason || 'không có lý do ghi kèm'}.
                </FigmaInfoAlert>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  Vé đã bán · {orderDetail.itemCount} vé
                </div>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>GHẾ</th>
                        <th>HẠNG VÉ</th>
                        <th>SỐ LƯỢNG</th>
                        <th>ĐƠN GIÁ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderSeats(orderDetail).map((line, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: 700 }}>{line.seat}</td>
                          <td>{line.ticketType}</td>
                          <td>{line.quantity}</td>
                          <td>{formatVnd(line.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!!orderDetail.payments.length && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    Thanh toán
                  </div>
                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>CỔNG</th>
                          <th>SỐ TIỀN</th>
                          <th>TRẠNG THÁI</th>
                          <th>THỜI ĐIỂM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetail.payments.map((payment, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: 700 }}>{payment.gateway}</td>
                            <td>{formatVnd(payment.amount)}</td>
                            <td>
                              <span className="badge badge-info">
                                {PAYMENT_STATUS[payment.status] ?? payment.status}
                              </span>
                            </td>
                            <td>{formatDateTime(payment.paidAt ?? payment.initiatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!!orderDetail.tickets?.length && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    Vé đã phát
                  </div>
                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>MÃ VÉ</th>
                          <th>NGƯỜI GIỮ</th>
                          <th>GHẾ</th>
                          <th>HẠNG VÉ</th>
                          <th>TRẠNG THÁI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetail.tickets.map((ticket) => (
                          <tr key={ticket.id}>
                            <td style={{ fontWeight: 700 }}>{ticket.id.slice(0, 8).toUpperCase()}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{ticket.holderName ?? '—'}</div>
                              {ticket.holderEmail && (
                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                  {ticket.holderEmail}
                                </div>
                              )}
                            </td>
                            <td>{ticket.seat?.seatCode ?? '—'}</td>
                            <td>{ticket.ticketType?.name ?? '—'}</td>
                            <td>
                              <span className="badge badge-info">
                                {TICKET_STATUS[ticket.status] ?? ticket.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <FigmaDocumentRow
                title="Vé điện tử của đơn"
                subtitle="Kiểm tra ghế và mã vé trước khi gửi lại cho khách"
                buttonLabel="Xem chi tiết vé"
                onView={() =>
                  setPreviewDoc({
                    title: `Vé điện tử ${orderDetail.code}`.trim(),
                    code: orderDetail.code,
                    issuer: orgName,
                    date: formatDateTime(orderDetail.createdAt),
                    statusLabel: BOOKING_STATUS[orderDetail.status]?.label ?? '',
                    summary: `${buyerName(orderDetail)} · ${orderDetail.session?.event?.title ?? ''}`,
                    fields: [
                      { label: 'Mã đơn', value: orderDetail.code },
                      { label: 'Khách hàng', value: buyerName(orderDetail) },
                      { label: 'Email', value: buyerEmail(orderDetail) || '—' },
                      {
                        label: 'Suất diễn',
                        value: `${orderDetail.session?.event?.title ?? '—'} · ${orderDetail.session?.title ?? '—'}`,
                      },
                      {
                        label: 'Ghế',
                        value:
                          orderSeats(orderDetail)
                            .map((line) => line.seat)
                            .join(', ') || '—',
                      },
                      { label: 'Tổng tiền', value: formatVnd(orderDetail.totalAmount) },
                    ],
                  })
                }
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-orders')}
                >
                  Quay lại danh sách đơn
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. o-comp */}
      {activeScreen === 'o-comp' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-orders')}>
              ← Đơn vé thương mại
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                className="form-select"
                style={{ width: 240 }}
                value={compSessionFilter}
                onChange={(event) => setCompSessionFilter(event.target.value)}
              >
                <option value="">Tất cả suất diễn</option>
                {sessions.map(({ event, session }) => (
                  <option key={session.id} value={session.id}>
                    {event.title} · {session.title ?? 'Suất diễn'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-comp-import')}
              >
                Nhập CSV hàng loạt
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-comp-create')}
              >
                + Phát hành vé mời lẻ
              </button>
            </div>
          </div>

          <QueryNotice
            loading={compTickets.isPending}
            error={compTickets.error}
            onRetry={() => void compTickets.refetch()}
            empty={!compTickets.isPending && !compTickets.error && !compTickets.data?.length}
            emptyText="Chưa phát hành vé mời nào trong tổ chức này."
          />

          {!!compTickets.data?.length && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                  Danh sách vé mời nội bộ (COMP)
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {compTickets.data.length} bản ghi
                </div>
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ COMP</th>
                      <th>KHÁCH MỜI</th>
                      <th>EMAIL NHẬN VÉ</th>
                      <th>SUẤT DIỄN</th>
                      <th>GHẾ</th>
                      <th>TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compTickets.data.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.code}</td>
                        <td>{buyerName(row)}</td>
                        <td>{buyerEmail(row) || '—'}</td>
                        <td>
                          <div>{row.session?.event?.title ?? '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                            {row.session?.title ?? '—'}
                          </div>
                        </td>
                        <td>
                          {orderSeats(row)
                            .map((line) => line.seat)
                            .join(', ') || '—'}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. o-comp-create */}
      {activeScreen === 'o-comp-create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phát hành vé COMP
            </div>

            {events.isPending && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Đang tải dữ liệu…</div>}
            {events.error && <FigmaInfoAlert tone="danger">{errorMessage(events.error)}</FigmaInfoAlert>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Suất diễn</label>
                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={(event) => {
                    setCompSessionId(event.target.value);
                    setCompTypeId('');
                    setCompSeatId('');
                  }}
                >
                  <option value="">Chọn suất diễn…</option>
                  {sessions.map(({ event, session }) => (
                    <option key={session.id} value={session.id}>
                      {event.title} · {session.title ?? 'Suất diễn'} ({formatDateTime(session.startsAt)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Hạng vé COMP</label>
                <select
                  className="form-select"
                  value={selectedTypeId}
                  onChange={(event) => {
                    setCompTypeId(event.target.value);
                    setCompSeatId('');
                  }}
                  disabled={!selectedSessionId}
                >
                  <option value="">
                    {selectedSessionId ? 'Chọn hạng vé COMP…' : 'Chọn suất diễn trước'}
                  </option>
                  {compTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · còn {inventoryOf(item).quota - inventoryOf(item).sold - inventoryOf(item).locked} vé
                    </option>
                  ))}
                </select>
                {!!selectedSessionId && !compTypes.length && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Suất diễn này chưa có hạng vé COMP nào đang hoạt động.
                  </div>
                )}
              </div>

              {!!compType && compZoneIds.size === 0 && (
                <FigmaInfoAlert tone="warning">
                  Hạng vé “{compType.name}” chưa gán khu vực nên chưa thể phát vé có ghế. Gán khu vực cho hạng vé
                  trước khi phát hành.
                </FigmaInfoAlert>
              )}

              <div>
                <label className="form-label">Ghế chỉ định</label>
                <select
                  className="form-select"
                  value={selectedSeatId}
                  onChange={(event) => setCompSeatId(event.target.value)}
                  disabled={!freeSeats.length}
                >
                  <option value="">
                    {freeSeats.length
                      ? 'Chọn ghế còn trống…'
                      : 'Không còn ghế trống trong khu vực của hạng vé'}
                  </option>
                  {freeSeats.map((seat) => (
                    <option key={seat.code} value={seat.code}>
                      {seat.code}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {freeSeats.length} ghế còn trống
                  {compQuota
                    ? ` · quota còn ${compQuota.quota - compQuota.sold - compQuota.locked} vé`
                    : ''}
                </div>
              </div>

              <div>
                <label className="form-label">Họ tên khách mời</label>
                <input
                  className="form-input"
                  value={compName}
                  onChange={(event) => setCompName(event.target.value)}
                  placeholder="Nguyễn Hoàng Yến"
                />
              </div>
              <div>
                <label className="form-label">Email nhận vé QR</label>
                <input
                  className="form-input"
                  value={compEmail}
                  onChange={(event) => setCompEmail(event.target.value)}
                  placeholder="yen.nguyen@partner.vn"
                />
              </div>
              <div>
                <label className="form-label">Số điện thoại (không bắt buộc)</label>
                <input
                  className="form-input"
                  value={compPhone}
                  onChange={(event) => setCompPhone(event.target.value)}
                  placeholder="0901234567"
                />
              </div>

              {issue.isError && <FigmaInfoAlert tone="danger">{errorMessage(issue.error)}</FigmaInfoAlert>}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submitSingleComp}
                  disabled={issue.isPending}
                >
                  {issue.isPending ? 'Đang phát hành…' : 'Phát hành & gửi vé'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-comp-import')}
                >
                  Nhập từ CSV
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={selectedSession?.event.title ?? 'Chọn suất diễn để xem sự kiện'}
            subtitle={selectedSession?.session.title ?? 'Ban tổ chức'}
            badge={selectedSession ? (compType?.name ?? TICKET_KIND.COMP) : 'Chưa chọn'}
            image={selectedSession?.event.coverImageUrl}
          />
        </div>
      )}

      {/* 5. o-comp-import */}
      {activeScreen === 'o-comp-import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tải lên tệp CSV khách mời COMP
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              <div>
                <label className="form-label">Suất diễn</label>
                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={(event) => {
                    setCompSessionId(event.target.value);
                    setCompTypeId('');
                  }}
                >
                  <option value="">Chọn suất diễn…</option>
                  {sessions.map(({ event, session }) => (
                    <option key={session.id} value={session.id}>
                      {event.title} · {session.title ?? 'Suất diễn'} ({formatDateTime(session.startsAt)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Hạng vé COMP</label>
                <select
                  className="form-select"
                  value={selectedTypeId}
                  onChange={(event) => setCompTypeId(event.target.value)}
                  disabled={!selectedSessionId}
                >
                  <option value="">
                    {selectedSessionId ? 'Chọn hạng vé COMP…' : 'Chọn suất diễn trước'}
                  </option>
                  {compTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · còn {inventoryOf(item).quota - inventoryOf(item).sold - inventoryOf(item).locked} vé
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
                padding: '24px 20px',
                textAlign: 'center',
                background: '#FAF7F2',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Tệp mẫu CSV (HoTen, Email, MaGhe, DonVi)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                {csvFileName || 'Chưa chọn tệp nào'} · Mỗi dòng là một khách mời và một ghế
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} style={{ marginRight: 6 }} />
                Chọn tệp CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void onPickCsv(file);
                  }}
                />
              </label>
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsvTemplate}>
                  Tải tệp mẫu
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-comp')}
              >
                Quay lại
              </button>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={selectedSession?.event.title ?? 'Chọn suất diễn để xem sự kiện'}
            subtitle={selectedSession?.session.title ?? 'Ban tổ chức'}
            badge={compType ? compType.name : 'Chưa chọn hạng vé'}
            image={selectedSession?.event.coverImageUrl}
          />
        </div>
      )}

      {/* 6. o-comp-import-review */}
      {activeScreen === 'o-comp-import-review' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
              Kết quả kiểm tra tệp CSV · {csvRows.length} dòng hợp lệ
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setScreen('o-comp-import-confirm')}
                disabled={!csvRows.length || !!allCsvIssues.length}
              >
                Tiếp tục xác nhận
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('o-comp-import')}
              >
                Tải lại tệp
              </button>
            </div>
          </div>

          {!!allCsvIssues.length && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <FigmaInfoAlert tone="danger">
                Có {allCsvIssues.length} lỗi cần sửa trong tệp CSV. Sửa tệp rồi tải lại để tiếp tục.
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {allCsvIssues.slice(0, 8).map((issue, index) => (
                    <li key={index}>
                      {issue.line ? `Dòng ${issue.line}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </FigmaInfoAlert>
            </div>
          )}

          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>DÒNG</th>
                  <th>KHÁCH MỜI</th>
                  <th>EMAIL</th>
                  <th>GHẾ CHỈ ĐỊNH</th>
                  <th>ĐƠN VỊ</th>
                  <th>KIỂM TRA GHẾ</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row) => {
                  const seat = seatByCode.get(row.seatCode);
                  const free = seat?.status === 'AVAILABLE';
                  const allowed = seat ? compZoneIds.has(seat.zoneId) : false;
                  const ok = free && allowed;
                  return (
                    <tr key={row.line}>
                      <td>#{row.line}</td>
                      <td style={{ fontWeight: 700 }}>{row.name}</td>
                      <td>{row.email}</td>
                      <td>{row.seatCode}</td>
                      <td>{row.note || '—'}</td>
                      <td>
                        <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                          {ok ? 'Hợp lệ · Trống' : !seat ? 'Không có trong sơ đồ' : !allowed ? 'Sai khu vực vé' : 'Đã có người giữ'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. o-comp-import-confirm */}
      {activeScreen === 'o-comp-import-confirm' && (
        <div>
          <FigmaNavyContextBanner
            title={orgName}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Sẵn sàng phát hành"
            image={organization.data?.logoUrl}
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Sự kiện & Suất diễn',
                value: `${selectedSession?.event.title ?? '—'} · ${selectedSession?.session.title ?? '—'} (${formatDateTime(selectedSession?.session.startsAt)})`,
              },
              {
                label: 'Số lượng phát hành',
                value: `${csvRows.length} vé mời COMP · ${csvRows.map((row) => row.seatCode).join(', ')}`,
              },
              {
                label: 'Quota COMP còn lại',
                value: compQuota
                  ? `Còn ${compQuota.quota - compQuota.sold - compQuota.locked} / ${compQuota.quota} vé ${
                      compType?.name ?? ''
                    }`
                  : 'Chưa chọn hạng vé COMP',
              },
              {
                label: 'Phương thức gửi',
                value: 'Gửi email kèm mã QR định danh từng ghế',
              },
            ]}
          />
          {issue.isError && <FigmaInfoAlert tone="danger">{errorMessage(issue.error)}</FigmaInfoAlert>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitBulkComp}
              disabled={issue.isPending}
            >
              {issue.isPending
                ? 'Đang phát hành…'
                : `Xác nhận phát hành ${csvRows.length} vé COMP`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-comp-import-review')}
            >
              Quay lại kiểm tra
            </button>
          </div>
        </div>
      )}

      {/* 8. o-comp-result */}
      {activeScreen === 'o-comp-result' && (
        <div
          className="card"
          style={{
            padding: '54px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: '#EAF7F0',
              color: '#18794E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Đã phát hành vé mời COMP thành công
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Hệ thống đã khóa ghế tương ứng trên sơ đồ và gửi vé điện tử QR đến email của từng khách mời.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            {issued ? `${issued.count} vé · ${issued.type || 'COMP'} · ${issued.session}` : 'Issued · COMP'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('o-comp')}>
              Xem danh sách COMP
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-orders')}>
              Đơn vé khách hàng
            </button>
          </div>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          isOpen
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          organization={orgName}
          status={previewDoc.statusLabel}
        />
      )}
    </div>
  );
}
