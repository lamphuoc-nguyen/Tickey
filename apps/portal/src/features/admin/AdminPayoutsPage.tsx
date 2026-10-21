import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
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
import { BANK_ACCOUNT_STATUS, PAYOUT_STATUS } from '../org/data/finance-data';
import { REFUND_REASON, REFUND_STATUS } from '../org/data/report-data';
import {
  CHARGEBACK_STATUS,
  useAdminBankAccounts,
  useAdminChargebacks,
  useAdminOrgs,
  useAdminPayouts,
  useAdminRefunds,
  useCancelPayout,
  useCreateManualRefund,
  useManualTransfer,
  useProposePayout,
  useRefundAction,
  useRefundBankInfo,
  useResolveChargeback,
  useReviewBankAccount,
  type AdminBankAccount,
  type AdminPayout,
  type AdminRefund,
  type Chargeback,
} from './data/admin-data';

const ADMIN_PAYOUT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-refunds', label: 'Quản lý hoàn tiền (Refunds)' },
  { id: 'a-refund-detail', label: 'Chi tiết lệnh hoàn' },
  { id: 'a-refund-create', label: 'Tạo lệnh hoàn tiền thủ công' },
  { id: 'a-refund-transfer', label: 'Xác nhận chuyển khoản hoàn tiền' },
  { id: 'a-refund-result', label: 'Đã hoàn tất chuyển tiền hoàn' },
  { id: 'a-chargebacks', label: 'Khiếu nại bồi hoàn thẻ (Chargebacks)' },
  { id: 'a-chargeback-edit', label: 'Kết luận hồ sơ Chargeback' },
  { id: 'a-payouts', label: 'Giải ngân cho Tổ chức (Payouts)' },
  { id: 'a-payout-review', label: 'Chi tiết lệnh giải ngân' },
  { id: 'a-payout-cancel', label: 'Hủy / Tạm hoãn lệnh giải ngân' },
  { id: 'a-bank', label: 'Xác minh tài khoản ngân hàng Tổ chức' },
  { id: 'a-bank-review', label: 'Kiểm tra tài khoản ngân hàng' },
  { id: 'a-bank-result', label: 'Đã xử lý tài khoản ngân hàng' },
];

const REFUND_FILTERS = [
  { value: 'REQUESTED', label: 'Chờ xử lý' },
  { value: 'PROCESSING', label: 'Đang hoàn tiền' },
  { value: 'AWAITING_BANK_INFO', label: 'Chờ thông tin ngân hàng' },
  { value: 'MANUAL_TRANSFER', label: 'Chuyển khoản thủ công' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'SUCCEEDED', label: 'Đã hoàn tiền' },
];

const CHARGEBACK_FILTERS = [
  { value: 'OPEN', label: 'Đang kháng nghị' },
  { value: 'WON', label: 'Thắng kháng nghị' },
  { value: 'LOST', label: 'Thua kháng nghị' },
  { value: 'ACCEPTED', label: 'Chấp nhận bồi hoàn' },
];

const PAYOUT_FILTERS = [
  { value: 'PROPOSED', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt, chờ chuyển' },
  { value: 'SENT', label: 'Đã chuyển khoản' },
  { value: 'CONFIRMED', label: 'Thành công' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const BANK_FILTERS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'ACTIVE', label: 'Đang sử dụng' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'RETIRED', label: 'Đã ngừng dùng' },
];

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; badge: string }> }) {
  const meta = map[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

/** Input tiền: chỉ giữ chữ số, trả về 0 khi rỗng. */
const parseAmount = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};

export function AdminPayoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-payouts';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);
  const [selectedChargebackId, setSelectedChargebackId] = useState<string | null>(null);
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const [refundFilter, setRefundFilter] = useState('REQUESTED');
  const [chargebackFilter, setChargebackFilter] = useState('OPEN');
  const [payoutFilter, setPayoutFilter] = useState('PROPOSED');
  const [bankFilter, setBankFilter] = useState('PENDING');

  const [manualBookingId, setManualBookingId] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [cbOutcome, setCbOutcome] = useState<'WON' | 'LOST' | 'ACCEPTED'>('WON');
  const [cbNote, setCbNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [bankDecision, setBankDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [bankNote, setBankNote] = useState('');
  const [proposeOrgId, setProposeOrgId] = useState('');
  const [refundResultRef, setRefundResultRef] = useState('');
  const [bankResult, setBankResult] = useState<{ account: AdminBankAccount; decision: 'APPROVE' | 'REJECT' } | null>(
    null,
  );

  const refunds = useAdminRefunds(refundFilter);
  const chargebacks = useAdminChargebacks(chargebackFilter);
  const payouts = useAdminPayouts(payoutFilter);
  const bankAccounts = useAdminBankAccounts(bankFilter);
  const orgs = useAdminOrgs();

  const bankInfo = useRefundBankInfo(
    activeScreen === 'a-refund-detail' || activeScreen === 'a-refund-transfer' ? selectedRefundId : null,
  );

  const createManualRefund = useCreateManualRefund();
  const manualTransfer = useManualTransfer();
  const refundAction = useRefundAction();
  const resolveChargeback = useResolveChargeback();
  const cancelPayout = useCancelPayout();
  const proposePayout = useProposePayout();
  const reviewBank = useReviewBankAccount();

  const filteredRefunds = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = refunds.data ?? [];
    if (!needle) return all;
    return all.filter((r) => `${r.id} ${r.bookingId} ${r.reason}`.toLowerCase().includes(needle));
  }, [refunds.data, search]);

  const selectedRefund: AdminRefund | undefined = (refunds.data ?? []).find((r) => r.id === selectedRefundId);
  const selectedChargeback: Chargeback | undefined = (chargebacks.data ?? []).find(
    (c) => c.id === selectedChargebackId,
  );
  const selectedPayout: AdminPayout | undefined = (payouts.data ?? []).find((p) => p.id === selectedPayoutId);
  const selectedBank: AdminBankAccount | undefined = (bankAccounts.data ?? []).find((b) => b.id === selectedBankId);

  const screenMeta = ADMIN_PAYOUT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_PAYOUT_SCREENS[0];

  const runManualTransfer = () => {
    if (!selectedRefund) return;
    manualTransfer.mutate(
      { id: selectedRefund.id, transferRef: transferRef.trim() },
      {
        onSuccess: () => {
          setRefundResultRef(transferRef.trim());
          setTransferRef('');
          showToast(`Đã ghi nhận chuyển khoản hoàn ${selectedRefund.id.slice(0, 8)}.`, 'success');
          setScreen('a-refund-result');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_PAYOUT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* Module switch bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeScreen.startsWith('a-payout') ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setScreen('a-payouts')}
        >
          Giải ngân Tổ chức
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeScreen.startsWith('a-refund') ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setScreen('a-refunds')}
        >
          Hoàn tiền khách hàng
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeScreen.startsWith('a-chargeback') ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setScreen('a-chargebacks')}
        >
          Chargebacks
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeScreen.startsWith('a-bank') ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setScreen('a-bank')}
        >
          Xác minh ngân hàng
        </button>
      </div>

      {/* 1. a-refunds */}
      {activeScreen === 'a-refunds' && (
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
                  placeholder="Tìm theo mã lệnh, đơn vé..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-input"
                style={{ width: 220 }}
                value={refundFilter}
                onChange={(e) => setRefundFilter(e.target.value)}
              >
                {REFUND_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('a-refund-create')}>
              + Tạo lệnh hoàn thủ công
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
                Danh sách lệnh hoàn tiền khách hàng
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredRefunds.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={refunds.isPending}
              error={refunds.error}
              onRetry={() => refunds.refetch()}
              empty={refunds.isSuccess && !(refunds.data ?? []).length}
              emptyText="Không có lệnh hoàn tiền ở trạng thái này."
            />
            {!!filteredRefunds.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ HOÀN</th>
                      <th>ĐƠN VÉ</th>
                      <th>SỐ TIỀN</th>
                      <th>LÝ DO</th>
                      <th>SỐ LẦN THỬ</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefunds.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.id.slice(0, 8)}</td>
                        <td>{r.bookingId.slice(0, 8)}</td>
                        <td>{formatVnd(r.amount)}</td>
                        <td>{REFUND_REASON[r.reason] ?? r.reason}</td>
                        <td>{r.attempts}</td>
                        <td>
                          <StatusBadge status={r.status} map={REFUND_STATUS} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRefundId(r.id);
                              setScreen('a-refund-detail');
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

      {/* 2. a-refund-detail */}
      {activeScreen === 'a-refund-detail' && (
        <div>
          <QueryNotice
            loading={refunds.isPending}
            error={refunds.error}
            onRetry={() => refunds.refetch()}
            empty={!selectedRefund}
            emptyText="Chọn một lệnh hoàn tiền từ danh sách."
          />
          {selectedRefund && (
            <>
              <FigmaNavyContextBanner
                title={`Lệnh hoàn ${selectedRefund.id.slice(0, 8)}`}
                subtitle="Hồ sơ đang xem · Đúng phạm vi xử lý nền tảng"
                badge={REFUND_STATUS[selectedRefund.status]?.label ?? selectedRefund.status}
              />
              <FigmaContextGrid
                items={[
                  { label: 'Mã hoàn & Đơn vé', value: `${selectedRefund.id.slice(0, 8)} · ${selectedRefund.bookingId}` },
                  { label: 'Số tiền', value: formatVnd(selectedRefund.amount) },
                  { label: 'Lý do', value: REFUND_REASON[selectedRefund.reason] ?? selectedRefund.reason },
                  { label: 'Ngày tạo', value: formatDateTime(selectedRefund.createdAt) },
                  {
                    label: 'Lỗi gần nhất',
                    value: selectedRefund.lastError || '—',
                  },
                ]}
              />

              <div className="card" style={{ padding: 22, marginTop: 14, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Thông tin nhận tiền hoàn của khách
                </div>
                <QueryNotice
                  loading={bankInfo.isPending}
                  error={bankInfo.error}
                  onRetry={() => bankInfo.refetch()}
                  empty={bankInfo.isSuccess && !bankInfo.data}
                  emptyText="Khách chưa khai báo tài khoản nhận tiền hoàn."
                />
                {bankInfo.data && (
                  <FigmaContextGrid
                    items={[
                      { label: 'Ngân hàng', value: bankInfo.data.bankCode },
                      { label: 'Số tài khoản', value: bankInfo.data.accountNumber },
                      { label: 'Chủ tài khoản', value: bankInfo.data.accountHolder },
                      {
                        label: 'Mã chuyển khoản',
                        value: bankInfo.data.transferRef || 'Chưa chuyển',
                      },
                      {
                        label: 'Thời điểm chuyển',
                        value: bankInfo.data.transferredAt ? formatDateTime(bankInfo.data.transferredAt) : '—',
                      },
                    ]}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(selectedRefund.status === 'FAILED' || selectedRefund.status === 'REQUESTED') && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={refundAction.isPending}
                    onClick={() =>
                      refundAction.mutate(
                        { id: selectedRefund.id, action: 'RETRY' },
                        {
                          onSuccess: (r) => {
                            showToast(`Đã gửi lại lệnh hoàn qua cổng · trạng thái ${r.status}.`, 'success');
                          },
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Thử lại hoàn qua cổng
                  </button>
                )}
                {selectedRefund.status === 'MANUAL_TRANSFER' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setTransferRef('');
                      setScreen('a-refund-transfer');
                    }}
                  >
                    Ghi nhận đã chuyển khoản
                  </button>
                )}
                {selectedRefund.status !== 'SUCCEEDED' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={refundAction.isPending}
                    onClick={() =>
                      refundAction.mutate(
                        { id: selectedRefund.id, action: 'REQUEST_BANK_INFO' },
                        {
                          onSuccess: (r) => showToast(`Đã yêu cầu khách bổ sung thông tin · ${r.status}.`, 'info'),
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Yêu cầu bổ sung thông tin ngân hàng
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-refunds')}>
                  Quay lại
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. a-refund-create */}
      {activeScreen === 'a-refund-create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Tạo lệnh hoàn thủ công
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Mã đơn vé (UUID)</label>
                <input
                  className="form-input"
                  value={manualBookingId}
                  onChange={(e) => setManualBookingId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div>
                <label className="form-label">Số tiền hoàn (VND)</label>
                <input
                  className="form-input"
                  inputMode="numeric"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="1.800.000"
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {formatVnd(parseAmount(manualAmount))} · Từ 10.000.000đ sẽ cần phê duyệt kép.
                </div>
              </div>
              <div>
                <label className="form-label">Lý do / ghi chú nội bộ</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Khách báo trùng thanh toán, đã xác minh cùng mã giao dịch."
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    createManualRefund.isPending ||
                    !manualBookingId.trim() ||
                    parseAmount(manualAmount) <= 0 ||
                    !manualNote.trim()
                  }
                  onClick={() =>
                    createManualRefund.mutate(
                      {
                        bookingId: manualBookingId.trim(),
                        amount: parseAmount(manualAmount),
                        note: manualNote.trim(),
                      },
                      {
                        onSuccess: (result) => {
                          if (result.refund_id) {
                            setSelectedRefundId(result.refund_id);
                            showToast('Đã tạo lệnh hoàn tiền thủ công.', 'success');
                            setScreen('a-refund-detail');
                          } else {
                            showToast(
                              'Số tiền vượt ngưỡng — đã tạo phiếu phê duyệt kép cho Admin thứ hai.',
                              'info',
                            );
                            setScreen('a-refunds');
                          }
                        },
                        onError: (error) => showToast(errorMessage(error), 'danger'),
                      },
                    )
                  }
                >
                  Tạo lệnh hoàn
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-refunds')}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 4. a-refund-transfer */}
      {activeScreen === 'a-refund-transfer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Xác nhận mã bút toán hoàn tiền
            </div>
            <QueryNotice
              loading={!selectedRefund}
              empty={!selectedRefund}
              emptyText="Chọn một lệnh hoàn tiền từ danh sách."
            />
            {selectedRefund && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Lệnh hoàn</label>
                  <input
                    className="form-input"
                    readOnly
                    value={`${selectedRefund.id.slice(0, 8)} · ${formatVnd(selectedRefund.amount)}`}
                  />
                </div>
                <div>
                  <label className="form-label">Tài khoản nhận</label>
                  <input
                    className="form-input"
                    readOnly
                    value={
                      bankInfo.data
                        ? `${bankInfo.data.bankCode} · ${bankInfo.data.accountNumber} · ${bankInfo.data.accountHolder}`
                        : 'Chưa có thông tin ngân hàng của khách'
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Mã tham chiếu ngân hàng / Cổng thanh toán</label>
                  <input
                    className="form-input"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="VCB-REF-20261021-8892"
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={manualTransfer.isPending || !transferRef.trim()}
                    onClick={runManualTransfer}
                  >
                    Xác nhận đã chuyển tiền
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-refund-detail')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. a-refund-result */}
      {activeScreen === 'a-refund-result' && (
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
            Đã hoàn tất chuyển tiền hoàn cho khách hàng
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14 }}>
            Bút toán {refundResultRef || '—'} đã được ghi nhận và lệnh hoàn chuyển sang trạng thái thành công.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-refunds')}>
            Danh sách hoàn tiền
          </button>
        </div>
      )}

      {/* 6. a-chargebacks */}
      {activeScreen === 'a-chargebacks' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <select
              className="form-input"
              style={{ width: 240 }}
              value={chargebackFilter}
              onChange={(e) => setChargebackFilter(e.target.value)}
            >
              {CHARGEBACK_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
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
                Hồ sơ tra soát thẻ quốc tế (Chargebacks)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {(chargebacks.data ?? []).length} bản ghi
              </div>
            </div>
            <QueryNotice
              loading={chargebacks.isPending}
              error={chargebacks.error}
              onRetry={() => chargebacks.refetch()}
              empty={chargebacks.isSuccess && !(chargebacks.data ?? []).length}
              emptyText="Không có hồ sơ chargeback ở trạng thái này."
            />
            {!!(chargebacks.data ?? []).length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ CB</th>
                      <th>ĐƠN VÉ</th>
                      <th>MÃ CỔNG</th>
                      <th>SỐ TIỀN</th>
                      <th>LÝ DO</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chargebacks.data ?? []).map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.id.slice(0, 8)}</td>
                        <td>{c.bookingId.slice(0, 8)}</td>
                        <td>{c.gatewayCaseId || '—'}</td>
                        <td>{formatVnd(c.amount)}</td>
                        <td>{c.reason || '—'}</td>
                        <td>
                          <StatusBadge status={c.status} map={CHARGEBACK_STATUS} />
                        </td>
                        <td>
                          {c.status === 'OPEN' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChargebackId(c.id);
                                setCbOutcome('WON');
                                setCbNote('');
                                setScreen('a-chargeback-edit');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Kết luận →
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Đã kết luận</span>
                          )}
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

      {/* 7. a-chargeback-edit */}
      {activeScreen === 'a-chargeback-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Hồ sơ Chargeback
            </div>
            <QueryNotice empty={!selectedChargeback} emptyText="Chọn một hồ sơ chargeback từ danh sách." />
            {selectedChargeback && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Mã hồ sơ & Giao dịch</label>
                  <input
                    className="form-input"
                    readOnly
                    value={`${selectedChargeback.id.slice(0, 8)} · Đơn ${selectedChargeback.bookingId.slice(0, 8)} (${formatVnd(selectedChargeback.amount)})`}
                  />
                </div>
                <div>
                  <label className="form-label">Kết luận kháng nghị</label>
                  <select
                    className="form-input"
                    value={cbOutcome}
                    onChange={(e) => setCbOutcome(e.target.value as 'WON' | 'LOST' | 'ACCEPTED')}
                  >
                    <option value="WON">Thắng kháng nghị</option>
                    <option value="LOST">Thua kháng nghị</option>
                    <option value="ACCEPTED">Chấp nhận bồi hoàn</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Bằng chứng / ghi chú gửi Ngân hàng</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={cbNote}
                    onChange={(e) => setCbNote(e.target.value)}
                    placeholder="Đã nộp log 3DS2 và biên nhận vé điện tử lên cổng thanh toán Quốc tế."
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={resolveChargeback.isPending}
                    onClick={() =>
                      resolveChargeback.mutate(
                        { id: selectedChargeback.id, outcome: cbOutcome, note: cbNote.trim() || null },
                        {
                          onSuccess: () => {
                            showToast(
                              `Đã ghi nhận kết luận chargeback: ${CHARGEBACK_STATUS[cbOutcome]?.label ?? cbOutcome}.`,
                              'success',
                            );
                            setScreen('a-chargebacks');
                          },
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Lưu kết luận
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-chargebacks')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 8. a-payouts */}
      {activeScreen === 'a-payouts' && (
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 700, marginBottom: 10 }}>
              Tạo lệnh giải ngân từ số dư READY
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ width: 360 }}
                value={proposeOrgId}
                onChange={(e) => setProposeOrgId(e.target.value)}
              >
                <option value="">Chọn tổ chức…</option>
                {(orgs.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={proposePayout.isPending || !proposeOrgId}
                onClick={() =>
                  proposePayout.mutate(proposeOrgId, {
                    onSuccess: (result) => {
                      showToast(
                        `Đã đề xuất giải ngân ${formatVnd(result.amount)} — chờ Admin thứ hai phê duyệt.`,
                        'success',
                      );
                      setPayoutFilter('PROPOSED');
                      setProposeOrgId('');
                    },
                    onError: (error) => showToast(errorMessage(error), 'danger'),
                  })
                }
              >
                Đề xuất giải ngân
              </button>
              <select
                className="form-input"
                style={{ width: 220, marginLeft: 'auto' }}
                value={payoutFilter}
                onChange={(e) => setPayoutFilter(e.target.value)}
              >
                {PAYOUT_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
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
                Danh sách lệnh giải ngân cho Tổ chức
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(payouts.data ?? []).length} bản ghi</div>
            </div>
            <QueryNotice
              loading={payouts.isPending}
              error={payouts.error}
              onRetry={() => payouts.refetch()}
              empty={payouts.isSuccess && !(payouts.data ?? []).length}
              emptyText="Không có lệnh giải ngân ở trạng thái này."
            />
            {!!(payouts.data ?? []).length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ LỆNH</th>
                      <th>TỔ CHỨC</th>
                      <th>SỐ TIỀN</th>
                      <th>TRẠNG THÁI</th>
                      <th>NGÀY TẠO</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payouts.data ?? []).map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.id.slice(0, 8)}</td>
                        <td>{p.org?.name ?? p.tenantId.slice(0, 8)}</td>
                        <td>{formatVnd(p.amount)}</td>
                        <td>
                          <StatusBadge status={p.status} map={PAYOUT_STATUS} />
                        </td>
                        <td>{formatDateTime(p.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayoutId(p.id);
                              setScreen('a-payout-review');
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

      {/* 9. a-payout-review */}
      {activeScreen === 'a-payout-review' && (
        <div>
          <QueryNotice empty={!selectedPayout} emptyText="Chọn một lệnh giải ngân từ danh sách." />
          {selectedPayout && (
            <>
              <FigmaNavyContextBanner
                title={selectedPayout.org?.name ?? 'Tổ chức'}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge={PAYOUT_STATUS[selectedPayout.status]?.label ?? selectedPayout.status}
              />
              <FigmaContextGrid
                items={[
                  { label: 'Mã lệnh giải ngân', value: selectedPayout.id },
                  { label: 'Số tiền giải ngân ròng', value: formatVnd(selectedPayout.amount) },
                  { label: 'Tài khoản thụ hưởng', value: selectedPayout.bankAccountId },
                  {
                    label: 'Phiếu phê duyệt kép',
                    value: selectedPayout.approvalId ?? 'Không có',
                  },
                  {
                    label: 'Mã giao dịch cổng',
                    value: selectedPayout.gatewayPayoutRef ?? 'Chưa chuyển',
                  },
                  {
                    label: 'Lỗi gần nhất',
                    value: selectedPayout.failureReason || '—',
                  },
                ]}
              />
              <FigmaInfoAlert tone="info">
                Lệnh chỉ được chuyển tiền sau khi phiếu phê duyệt kép đạt đủ phiếu APPROVE; hệ thống cổng chi sẽ
                xác nhận khi tiền về tài khoản Tổ chức.
              </FigmaInfoAlert>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                {(selectedPayout.status === 'PROPOSED' || selectedPayout.status === 'APPROVED') && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setCancelReason('');
                      setScreen('a-payout-cancel');
                    }}
                  >
                    Tạm hoãn / Hủy lệnh
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-payouts')}>
                  Quay lại
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 10. a-payout-cancel */}
      {activeScreen === 'a-payout-cancel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Tạm hoãn lệnh giải ngân
            </div>
            <QueryNotice empty={!selectedPayout} emptyText="Chọn một lệnh giải ngân từ danh sách." />
            {selectedPayout && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Lệnh giải ngân</label>
                  <input
                    className="form-input"
                    readOnly
                    value={`${selectedPayout.id.slice(0, 8)} · ${formatVnd(selectedPayout.amount)} · ${selectedPayout.org?.name ?? ''}`}
                  />
                </div>
                <div>
                  <label className="form-label">Lý do tạm hoãn giải ngân</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Tạm hoãn chờ hoàn tất đối chiếu 2 đơn hoàn tiền phát sinh."
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={cancelPayout.isPending || !cancelReason.trim()}
                    onClick={() =>
                      cancelPayout.mutate(
                        { id: selectedPayout.id, reason: cancelReason.trim() },
                        {
                          onSuccess: () => {
                            showToast(`Đã tạm hoãn lệnh giải ngân ${selectedPayout.id.slice(0, 8)}.`, 'warning');
                            setCancelReason('');
                            setScreen('a-payouts');
                          },
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Xác nhận tạm hoãn
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-payout-review')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 11. a-bank */}
      {activeScreen === 'a-bank' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <select
              className="form-input"
              style={{ width: 240 }}
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
            >
              {BANK_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
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
                Yêu cầu thay đổi tài khoản ngân hàng nhận tiền
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {(bankAccounts.data ?? []).length} bản ghi
              </div>
            </div>
            <QueryNotice
              loading={bankAccounts.isPending}
              error={bankAccounts.error}
              onRetry={() => bankAccounts.refetch()}
              empty={bankAccounts.isSuccess && !(bankAccounts.data ?? []).length}
              emptyText="Không có tài khoản ngân hàng ở trạng thái này."
            />
            {!!(bankAccounts.data ?? []).length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>TỔ CHỨC</th>
                      <th>NGÂN HÀNG</th>
                      <th>SỐ TÀI KHOẢN</th>
                      <th>CHỦ TÀI KHOẢN</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bankAccounts.data ?? []).map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700 }}>{b.org?.name ?? b.orgId.slice(0, 8)}</td>
                        <td>{b.bankCode}</td>
                        <td>{b.accountNumber}</td>
                        <td>{b.accountHolder}</td>
                        <td>
                          <StatusBadge status={b.status} map={BANK_ACCOUNT_STATUS} />
                        </td>
                        <td>
                          {b.status === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBankId(b.id);
                                setBankDecision('APPROVE');
                                setBankNote('');
                                setScreen('a-bank-review');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Kiểm tra →
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Đã xử lý</span>
                          )}
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

      {/* 12. a-bank-review */}
      {activeScreen === 'a-bank-review' && (
        <div>
          <QueryNotice empty={!selectedBank} emptyText="Chọn một tài khoản ngân hàng từ danh sách." />
          {selectedBank && (
            <>
              <FigmaNavyContextBanner
                title={selectedBank.org?.name ?? 'Tổ chức'}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge="Xác minh ngân hàng"
              />
              <FigmaContextGrid
                items={[
                  { label: 'Tổ chức', value: selectedBank.org?.name ?? selectedBank.orgId },
                  { label: 'Ngân hàng', value: selectedBank.bankCode },
                  { label: 'Số tài khoản', value: selectedBank.accountNumber },
                  { label: 'Chủ tài khoản', value: selectedBank.accountHolder },
                  {
                    label: 'Ngày gửi yêu cầu',
                    value: formatDateTime(selectedBank.createdAt),
                  },
                ]}
              />
              <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="form-label">Quyết định</label>
                    <select
                      className="form-input"
                      value={bankDecision}
                      onChange={(e) => setBankDecision(e.target.value as 'APPROVE' | 'REJECT')}
                    >
                      <option value="APPROVE">Phê duyệt tài khoản</option>
                      <option value="REJECT">Từ chối tài khoản</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ghi chú xác minh</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={bankNote}
                      onChange={(e) => setBankNote(e.target.value)}
                      placeholder="Tên chủ tài khoản trùng khớp pháp nhân trên giấy phép KYC."
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={reviewBank.isPending}
                  onClick={() =>
                    reviewBank.mutate(
                      { id: selectedBank.id, decision: bankDecision, note: bankNote.trim() || null },
                      {
                        onSuccess: () => {
                          setBankResult({ account: selectedBank, decision: bankDecision });
                          showToast(
                            bankDecision === 'APPROVE'
                              ? 'Đã phê duyệt tài khoản ngân hàng nhận tiền.'
                              : 'Đã từ chối tài khoản ngân hàng.',
                            bankDecision === 'APPROVE' ? 'success' : 'warning',
                          );
                          setScreen('a-bank-result');
                        },
                        onError: (error) => showToast(errorMessage(error), 'danger'),
                      },
                    )
                  }
                >
                  {bankDecision === 'APPROVE' ? 'Phê duyệt tài khoản ngân hàng' : 'Từ chối tài khoản ngân hàng'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-bank')}>
                  Quay lại
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 13. a-bank-result */}
      {activeScreen === 'a-bank-result' && (
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
              background: bankResult?.decision === 'REJECT' ? '#FDECEC' : '#EAF7F0',
              color: bankResult?.decision === 'REJECT' ? '#B42318' : '#18794E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {bankResult?.decision === 'REJECT'
              ? 'Đã từ chối tài khoản ngân hàng Tổ chức'
              : 'Đã xác minh tài khoản ngân hàng Tổ chức'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14 }}>
            {bankResult
              ? bankResult.decision === 'REJECT'
                ? `Tổ chức ${bankResult.account.org?.name ?? ''} cần gửi tài khoản nhận tiền khác.`
                : `Các kỳ đối soát tiếp theo của ${bankResult.account.org?.name ?? 'tổ chức'} sẽ được giải ngân về tài khoản mới.`
              : 'Hồ sơ đã được xử lý.'}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-bank')}>
            Danh sách ngân hàng
          </button>
        </div>
      )}
    </div>
  );
}
