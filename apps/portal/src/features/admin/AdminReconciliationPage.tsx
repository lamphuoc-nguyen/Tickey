import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { errorMessage, formatDateTime, formatVnd } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { SETTLEMENT_STATUS } from '../org/data/finance-data';
import {
  GATEWAY_MATCH_STATUS,
  GATEWAY_TXN_TYPE,
  useAdminOrgs,
  useAdminSettlements,
  useGatewayStatements,
  useImportGatewayStatement,
  useRecomputeSettlement,
  type AdminSettlement,
  type GatewayStatementLine,
} from './data/admin-data';

const ADMIN_RECON_SCREENS: FigmaScreenOption[] = [
  { id: 'a-settlements', label: 'Kỳ đối soát toàn nền tảng' },
  { id: 'a-settlement-detail', label: 'Chi tiết kỳ đối soát' },
  { id: 'a-reconciliation', label: 'Đối chiếu cổng thanh toán (Gateway)' },
  { id: 'a-reconciliation-import', label: 'Tải lên sao kê cổng thanh toán' },
];

const SETTLEMENT_FILTERS = [
  { value: 'OPEN', label: 'Đang tích lũy' },
  { value: 'ON_HOLD', label: 'Tạm giữ (tranh chấp)' },
  { value: 'READY', label: 'Sẵn sàng chi trả' },
  { value: 'PAID_OUT', label: 'Đã chi trả' },
  { value: 'CLOSED', label: 'Đã chốt sổ' },
];

const GATEWAY_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'MATCHED', label: 'Khớp' },
  { value: 'MISSING_IN_SYSTEM', label: 'Thiếu ở hệ thống' },
  { value: 'AMOUNT_MISMATCH', label: 'Sai lệch số tiền' },
  { value: 'UNMATCHED', label: 'Chưa đối chiếu' },
];

const TXN_TYPES = ['PAYMENT', 'REFUND', 'PAYOUT', 'CHARGEBACK'];

interface ParsedLine {
  txnType: string;
  gatewayTxnId: string;
  amount: number;
  raw: Record<string, string>;
}

/** Tách một dòng CSV có hỗ trợ dấu ngoặc kép cơ bản. */
function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (quoted) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Sao kê CSV tối thiểu: cột `txn_type, gateway_txn_id, amount` (có hoặc không có dòng tiêu đề).
 * Các cột còn lại được giữ nguyên trong `raw`.
 */
function parseStatementCsv(text: string): { lines: ParsedLine[]; errors: string[] } {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (!rows.length) return { lines: [], errors: ['Tệp sao kê rỗng.'] };

  const first = splitCsvRow(rows[0]);
  const hasHeader = !/^\d+$/.test((first[2] ?? '').replace(/[^\d]/g, ''));
  const header = hasHeader ? first.map((h) => h.toLowerCase()) : ['txn_type', 'gateway_txn_id', 'amount'];
  const body = hasHeader ? rows.slice(1) : rows;

  const lines: ParsedLine[] = [];
  body.forEach((row, index) => {
    const cells = splitCsvRow(row);
    if (cells.every((cell) => !cell)) return;
    const txnType = (cells[0] ?? '').toUpperCase();
    const gatewayTxnId = cells[1] ?? '';
    const amount = Number((cells[2] ?? '').replace(/[^\d-]/g, ''));
    if (!TXN_TYPES.includes(txnType)) {
      errors.push(`Dòng ${index + (hasHeader ? 2 : 1)}: loại giao dịch "${cells[0] ?? ''}" không hợp lệ.`);
      return;
    }
    if (!gatewayTxnId) {
      errors.push(`Dòng ${index + (hasHeader ? 2 : 1)}: thiếu mã giao dịch cổng.`);
      return;
    }
    if (!Number.isFinite(amount) || amount === 0) {
      errors.push(`Dòng ${index + (hasHeader ? 2 : 1)}: số tiền không hợp lệ.`);
      return;
    }
    const raw: Record<string, string> = {};
    cells.forEach((cell, i) => {
      raw[header[i] ?? `col_${i + 1}`] = cell;
    });
    lines.push({ txnType, gatewayTxnId, amount, raw });
  });

  return { lines, errors };
}

export function AdminReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-settlements';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('READY');
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [gatewayName, setGatewayName] = useState('');
  const [gatewayDate, setGatewayDate] = useState('');

  const [stmtGateway, setStmtGateway] = useState('VNPAY');
  const [stmtDate, setStmtDate] = useState('');
  const [stmtName, setStmtName] = useState('');
  const [stmtLines, setStmtLines] = useState<ParsedLine[]>([]);
  const [stmtErrors, setStmtErrors] = useState<string[]>([]);

  const settlements = useAdminSettlements({ status: settlementFilter });
  const orgs = useAdminOrgs();
  const statements = useGatewayStatements({ gateway: gatewayName, date: gatewayDate });
  const recompute = useRecomputeSettlement();
  const importStatement = useImportGatewayStatement();

  /** settlements.tenant_id trỏ tới organizations nhưng không có khoá ngoại trực tiếp, nên ghép tên ở client. */
  const orgNames = useMemo(() => {
    const map = new Map<string, string>();
    (orgs.data ?? []).forEach((org) => map.set(org.id, org.name));
    return map;
  }, [orgs.data]);
  const orgName = (tenantId: string) => orgNames.get(tenantId) ?? tenantId.slice(0, 8);

  const filteredSettlements = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = settlements.data ?? [];
    if (!needle) return all;
    return all.filter((s) =>
      `${s.id} ${orgNames.get(s.tenantId) ?? s.tenantId} ${s.session?.title ?? ''} ${s.session?.event?.title ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [settlements.data, search, orgNames]);

  const selectedSettlement: AdminSettlement | undefined = (settlements.data ?? []).find(
    (s) => s.id === selectedSettlementId,
  );

  const statementSummary = useMemo(() => {
    const rows = statements.data ?? [];
    const counts: Record<string, number> = {};
    let total = 0;
    rows.forEach((row) => {
      counts[row.matchStatus] = (counts[row.matchStatus] ?? 0) + 1;
      total += row.amount;
    });
    return { rows, counts, total };
  }, [statements.data]);

  const filteredStatements = useMemo(() => {
    if (!gatewayFilter) return statementSummary.rows;
    return statementSummary.rows.filter((row) => row.matchStatus === gatewayFilter);
  }, [statementSummary.rows, gatewayFilter]);

  const screenMeta = ADMIN_RECON_SCREENS.find((s) => s.id === activeScreen) || ADMIN_RECON_SCREENS[0];

  const onPickFile = async (file: File) => {
    setStmtName(file.name);
    try {
      const text = await file.text();
      const parsed = parseStatementCsv(text);
      setStmtLines(parsed.lines);
      setStmtErrors(parsed.errors);
      if (parsed.lines.length) {
        showToast(`Đã đọc ${parsed.lines.length} dòng hợp lệ từ ${file.name}.`, 'info');
      } else {
        showToast('Tệp không có dòng giao dịch hợp lệ.', 'warning');
      }
    } catch {
      setStmtLines([]);
      setStmtErrors(['Không đọc được tệp sao kê.']);
      showToast('Không đọc được tệp sao kê.', 'danger');
    }
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_RECON_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-settlements */}
      {activeScreen === 'a-settlements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 320 }}>
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
                  placeholder="Tìm theo mã kỳ, tổ chức, suất diễn..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-input"
                style={{ width: 210 }}
                value={settlementFilter}
                onChange={(e) => setSettlementFilter(e.target.value)}
              >
                {SETTLEMENT_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-reconciliation')}>
                Đối chiếu Gateway
              </button>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('a-reconciliation-import')}>
              + Nhập sao kê cổng thanh toán
            </button>
          </div>

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
                Danh sách kỳ đối soát tổ chức
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredSettlements.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={settlements.isPending}
              error={settlements.error}
              onRetry={() => settlements.refetch()}
              empty={settlements.isSuccess && !(settlements.data ?? []).length}
              emptyText="Không có kỳ đối soát ở trạng thái này."
            />
            {!!filteredSettlements.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ KỲ</th>
                      <th>TỔ CHỨC</th>
                      <th>SUẤT DIỄN</th>
                      <th>DOANH THU GỘP</th>
                      <th>THỰC NHẬN RÒNG</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSettlements.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.id.slice(0, 8)}</td>
                        <td>{orgName(s.tenantId)}</td>
                        <td>
                          {s.session?.event?.title
                            ? `${s.session.event.title}${s.session.title ? ` · ${s.session.title}` : ''}`
                            : (s.session?.title ?? '—')}
                        </td>
                        <td>{formatVnd(s.grossAmount)}</td>
                        <td>{formatVnd(s.netAmount)}</td>
                        <td>
                          <span
                            className={`badge ${SETTLEMENT_STATUS[s.status]?.badge ?? 'badge-info'}`}
                          >
                            {SETTLEMENT_STATUS[s.status]?.label ?? s.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSettlementId(s.id);
                              setScreen('a-settlement-detail');
                            }}
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
            )}
          </div>
        </div>
      )}

      {/* 2. a-settlement-detail */}
      {activeScreen === 'a-settlement-detail' && (
        <div>
          <QueryNotice empty={!selectedSettlement} emptyText="Chọn một kỳ đối soát từ danh sách." />
          {selectedSettlement && (
            <>
              <FigmaNavyContextBanner
                title={orgName(selectedSettlement.tenantId)}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge={`Kỳ ${selectedSettlement.id.slice(0, 8)}`}
              />
              <FigmaContextGrid
                items={[
                  {
                    label: 'Kỳ đối soát & Tổ chức',
                    value: `${selectedSettlement.id.slice(0, 8)} · ${orgName(selectedSettlement.tenantId)}`,
                  },
                  {
                    label: 'Suất diễn',
                    value: selectedSettlement.session
                      ? `${selectedSettlement.session.event?.title ?? ''}${selectedSettlement.session.title ? ` · ${selectedSettlement.session.title}` : ''}`
                      : '—',
                  },
                  {
                    label: 'Doanh thu gộp',
                    value: formatVnd(selectedSettlement.grossAmount),
                  },
                  {
                    label: 'Hoàn tiền · Bồi hoàn · Phí',
                    value: `${formatVnd(selectedSettlement.refundAmount)} · ${formatVnd(selectedSettlement.chargebackAmount)} · ${formatVnd(selectedSettlement.feeAmount)}`,
                  },
                  {
                    label: 'Giá trị chuyển sang Payout',
                    value: formatVnd(selectedSettlement.netAmount),
                  },
                  {
                    label: 'Trạng thái · Chốt sổ',
                    value: `${SETTLEMENT_STATUS[selectedSettlement.status]?.label ?? selectedSettlement.status}${selectedSettlement.cutoffAt ? ` · ${formatDateTime(selectedSettlement.cutoffAt)}` : ''}`,
                  },
                ]}
              />
              {selectedSettlement.report && Object.keys(selectedSettlement.report).length > 0 && (
                <div className="card" style={{ padding: 18, marginTop: 14 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    Báo cáo tính toán
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: 'var(--muted)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(selectedSettlement.report, null, 2)}
                  </pre>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={recompute.isPending}
                  onClick={() =>
                    recompute.mutate(selectedSettlement.sessionId, {
                      onSuccess: () => showToast('Đã tính lại kỳ đối soát của suất diễn.', 'success'),
                      onError: (error) => showToast(errorMessage(error), 'danger'),
                    })
                  }
                >
                  Tính lại kỳ đối soát
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-reconciliation')}>
                  Xem khớp lệnh Gateway
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-settlements')}>
                  Quay lại danh sách
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. a-reconciliation */}
      {activeScreen === 'a-reconciliation' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 240 }}>
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
                placeholder="Cổng (VNPAY, MOMO...)"
                value={gatewayName}
                onChange={(e) => setGatewayName(e.target.value)}
              />
            </div>
            <input
              className="form-input"
              type="date"
              style={{ width: 190 }}
              value={gatewayDate}
              onChange={(e) => setGatewayDate(e.target.value)}
            />
            <select
              className="form-input"
              style={{ width: 220 }}
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
            >
              {GATEWAY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => setScreen('a-reconciliation-import')}
            >
              + Tải sao kê CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.entries(GATEWAY_MATCH_STATUS).map(([status, meta]) => (
              <div
                key={status}
                className="card"
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {statementSummary.counts[status] ?? 0}
                </span>
              </div>
            ))}
            <div className="card" style={{ padding: '10px 16px', marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tổng tiền sao kê: </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {formatVnd(statementSummary.total)}
              </span>
            </div>
          </div>

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
                Bảng đối chiếu bút toán Cổng thanh toán vs Hệ thống Tickey
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredStatements.length} dòng</div>
            </div>
            <QueryNotice
              loading={statements.isPending}
              error={statements.error}
              onRetry={() => statements.refetch()}
              empty={statements.isSuccess && !(statements.data ?? []).length}
              emptyText="Chưa nhập sao kê cổng thanh toán nào."
            />
            {!!filteredStatements.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>NGÀY</th>
                      <th>CỔNG THANH TOÁN</th>
                      <th>LOẠI</th>
                      <th>MÃ GIAO DỊCH</th>
                      <th>SỐ TIỀN</th>
                      <th>LIÊN KẾT</th>
                      <th>TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatements.map((row: GatewayStatementLine) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{formatDateTime(row.statementDate)}</td>
                        <td>{row.gateway}</td>
                        <td>{GATEWAY_TXN_TYPE[row.txnType] ?? row.txnType}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.gatewayTxnId}</td>
                        <td>{formatVnd(row.amount)}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {row.paymentId ? `PMT ${row.paymentId.slice(0, 8)}` : row.refundId ? `RF ${row.refundId.slice(0, 8)}` : '—'}
                        </td>
                        <td>
                          <span
                            className={`badge ${GATEWAY_MATCH_STATUS[row.matchStatus]?.badge ?? 'badge-info'}`}
                          >
                            {GATEWAY_MATCH_STATUS[row.matchStatus]?.label ?? row.matchStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. a-reconciliation-import */}
      {activeScreen === 'a-reconciliation-import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tải lên tệp sao kê đối soát từ Cổng thanh toán
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label className="form-label">Cổng thanh toán</label>
                <input
                  className="form-input"
                  value={stmtGateway}
                  onChange={(e) => setStmtGateway(e.target.value)}
                  placeholder="VNPAY"
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label className="form-label">Ngày sao kê</label>
                <input
                  className="form-input"
                  type="date"
                  value={stmtDate}
                  onChange={(e) => setStmtDate(e.target.value)}
                />
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
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Tệp sao kê CSV</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                {stmtName || 'Chưa chọn tệp'} · cột: txn_type, gateway_txn_id, amount
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                Chọn tệp sao kê
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onPickFile(file);
                  }}
                />
              </label>
            </div>

            {stmtErrors.length > 0 && (
              <FigmaInfoAlert tone="warning">
                {stmtErrors.length} dòng bị bỏ qua: {stmtErrors.slice(0, 3).join(' ')}
                {stmtErrors.length > 3 ? ' …' : ''}
              </FigmaInfoAlert>
            )}

            {stmtLines.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: 14 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>LOẠI</th>
                      <th>MÃ GIAO DỊCH</th>
                      <th>SỐ TIỀN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmtLines.slice(0, 8).map((line, index) => (
                      <tr key={`${line.gatewayTxnId}-${index}`}>
                        <td>{GATEWAY_TXN_TYPE[line.txnType] ?? line.txnType}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{line.gatewayTxnId}</td>
                        <td>{formatVnd(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stmtLines.length > 8 && (
                  <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>
                    … và {stmtLines.length - 8} dòng khác.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importStatement.isPending || !stmtGateway.trim() || !stmtDate || !stmtLines.length}
                onClick={() =>
                  importStatement.mutate(
                    {
                      gateway: stmtGateway.trim().toUpperCase(),
                      statementDate: stmtDate,
                      lines: stmtLines,
                    },
                    {
                      onSuccess: (result) => {
                        showToast(
                          `Đã nhập ${stmtLines.length} dòng · ${result.matched} khớp · ${result.mismatches} lệch.`,
                          result.mismatches > 0 ? 'warning' : 'success',
                        );
                        setStmtLines([]);
                        setStmtErrors([]);
                        setStmtName('');
                        setGatewayName(stmtGateway.trim().toUpperCase());
                        setGatewayDate(stmtDate);
                        setScreen('a-reconciliation');
                      },
                      onError: (error) => showToast(errorMessage(error), 'danger'),
                    },
                  )
                }
              >
                Chạy đối chiếu tự động
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-reconciliation')}>
                Hủy
              </button>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}
    </div>
  );
}
