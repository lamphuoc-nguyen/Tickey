import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useOrgId, formatVnd, formatDateTime, errorMessage } from '../../lib/api';
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
import {
  BANK_ACCOUNT_STATUS,
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
  useOrgBankAccounts,
  useOrgFinance,
  useOrgPayouts,
  useOrgSettlements,
  useRequestBankAccount,
} from './data/finance-data';

const FINANCE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-finance', label: 'Tổng quan tài chính' },
  { id: 'o-settlements', label: 'Kỳ đối soát doanh thu' },
  { id: 'o-payouts', label: 'Lệnh chi trả (Payouts)' },
  { id: 'o-bank', label: 'Tài khoản ngân hàng nhận tiền' },
];

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        {value}
      </div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{note}</div>}
    </div>
  );
}

function StatusBadge({ map, status }: { map: Record<string, { label: string; badge: string }>; status: string }) {
  const meta = map[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ color: 'var(--muted)', fontSize: 13 }}>
        {text}
      </td>
    </tr>
  );
}

export function OrgFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = useOrgId();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-finance';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const finance = useOrgFinance(orgId);
  const settlements = useOrgSettlements(orgId);
  const payouts = useOrgPayouts(orgId);
  const bankAccounts = useOrgBankAccounts(orgId);
  const requestBank = useRequestBankAccount(orgId);

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const screenMeta = FINANCE_SCREENS.find((s) => s.id === activeScreen) || FINANCE_SCREENS[0];
  const summary = finance.data;
  const activeBank = (bankAccounts.data ?? []).find((a) => a.status === 'ACTIVE') ?? null;
  const pendingBank = (bankAccounts.data ?? []).find((a) => a.status === 'PENDING') ?? null;

  const grossRevenue = (settlements.data ?? []).reduce((sum, s) => sum + s.grossAmount, 0);
  const feePaid = (settlements.data ?? []).reduce((sum, s) => sum + s.feeAmount, 0);

  const submitBank = () => {
    if (!bankCode.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      showToast('Vui lòng nhập đủ ngân hàng, số tài khoản và tên chủ tài khoản.', 'danger');
      return;
    }
    requestBank.mutate(
      { bankCode: bankCode.trim(), accountNumber: accountNumber.trim(), accountHolder: accountHolder.trim() },
      {
        onSuccess: () => {
          showToast('Đã gửi yêu cầu đổi ngân hàng nhận tiền tới Admin.', 'success');
          setBankCode('');
          setAccountNumber('');
          setAccountHolder('');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={FINANCE_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-finance */}
      {activeScreen === 'o-finance' && (
        <div>
          <QueryNotice
            loading={finance.isLoading}
            error={finance.error}
            onRetry={() => void finance.refetch()}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
            <StatCard label="Số dư khả dụng" value={formatVnd(summary?.ledgerBalance)} note="Tổng phải trả cho Org" />
            <StatCard label="Quỹ dự phòng hoàn/tranh chấp" value={formatVnd(summary?.held)} note="Kỳ đang mở hoặc tạm giữ" />
            <StatCard label="Sẵn sàng chi trả" value={formatVnd(summary?.ready)} note="Kỳ đã qua đối soát" />
            <StatCard label="Đã chi trả" value={formatVnd(summary?.paidOut)} note="Các lệnh đã xác nhận" />
          </div>

          {summary?.negativeBalanceSince && (
            <FigmaInfoAlert tone="danger">
              Số dư âm từ {formatDateTime(summary.negativeBalanceSince)} — cần tất toán trước khi tiếp tục bán vé.
            </FigmaInfoAlert>
          )}

          {!!summary?.inProgress && (
            <FigmaInfoAlert tone="info">
              Đang có {formatVnd(summary.inProgress)} trong các lệnh chi trả chờ xử lý.
            </FigmaInfoAlert>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('o-settlements')}>
              Xem kỳ đối soát
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-payouts')}>
              Lệnh chi trả
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-bank')}>
              Tài khoản ngân hàng
            </button>
          </div>

          {!!summary?.activeHolds?.length && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                Khoản đang tạm giữ
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>PHẠM VI</th>
                      <th>LÝ DO</th>
                      <th>THỜI ĐIỂM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.activeHolds.map((hold) => (
                      <tr key={hold.id}>
                        <td style={{ fontWeight: 700 }}>{hold.scope}</td>
                        <td>{hold.reason || '—'}</td>
                        <td>{formatDateTime(hold.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                Biến động doanh thu theo suất diễn
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {settlements.data?.length ?? 0} bản ghi
              </div>
            </div>
            <QueryNotice
              loading={settlements.isLoading}
              error={settlements.error}
              empty={!settlements.isLoading && !settlements.data?.length}
              emptyText="Chưa có kỳ đối soát nào."
              onRetry={() => void settlements.refetch()}
            />
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SUẤT DIỄN</th>
                    <th>DOANH THU GỘP</th>
                    <th>PHÍ NỀN TẢNG</th>
                    <th>THỰC NHẬN DỰ KIẾN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.data?.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.session?.title || 'Suất diễn'}</td>
                      <td>{formatVnd(s.grossAmount)}</td>
                      <td>{formatVnd(s.feeAmount)}</td>
                      <td>{formatVnd(s.netAmount)}</td>
                      <td>
                        <StatusBadge map={SETTLEMENT_STATUS} status={s.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setScreen('o-settlements')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Đối soát →
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!settlements.isLoading && !settlements.error && !settlements.data?.length && (
                    <EmptyRow colSpan={6} text="Chưa có kỳ đối soát nào." />
                  )}
                </tbody>
              </table>
            </div>
            {!!settlements.data?.length && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)' }}>
                Tổng gộp {formatVnd(grossRevenue)} · phí nền tảng {formatVnd(feePaid)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. o-settlements */}
      {activeScreen === 'o-settlements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-payouts')}
            >
              Lệnh chi trả
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
                Tất cả danh sách kỳ đối soát
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {settlements.data?.length ?? 0} bản ghi
              </div>
            </div>
            <QueryNotice
              loading={settlements.isLoading}
              error={settlements.error}
              empty={!settlements.isLoading && !settlements.data?.length}
              emptyText="Chưa có kỳ đối soát nào."
              onRetry={() => void settlements.refetch()}
            />
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SUẤT DIỄN</th>
                    <th>CHỐT SỔ DỰ KIẾN</th>
                    <th>DOANH THU GỘP</th>
                    <th>HOÀN / CHARGEBACK</th>
                    <th>PHÍ</th>
                    <th>DOANH THU RÒNG</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.data?.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.session?.title || 'Suất diễn'}</td>
                      <td>{formatDateTime(s.cutoffAt)}</td>
                      <td>{formatVnd(s.grossAmount)}</td>
                      <td>{formatVnd(s.refundAmount + s.chargebackAmount)}</td>
                      <td>{formatVnd(s.feeAmount)}</td>
                      <td style={{ fontWeight: 700 }}>{formatVnd(s.netAmount)}</td>
                      <td>
                        <StatusBadge map={SETTLEMENT_STATUS} status={s.status} />
                      </td>
                    </tr>
                  ))}
                  {!settlements.isLoading && !settlements.error && !settlements.data?.length && (
                    <EmptyRow colSpan={7} text="Chưa có kỳ đối soát nào." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. o-payouts */}
      {activeScreen === 'o-payouts' && (
        <div>
          {!activeBank && (
            <FigmaInfoAlert tone="warning">
              Chưa có tài khoản ngân hàng đang sử dụng. Cập nhật ngân hàng nhận tiền trước khi đề nghị chi trả.
            </FigmaInfoAlert>
          )}

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
                Lịch sử lệnh chi trả về tài khoản tổ chức
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('o-bank')}
              >
                Cập nhật ngân hàng nhận
              </button>
            </div>
            <QueryNotice
              loading={payouts.isLoading}
              error={payouts.error}
              empty={!payouts.isLoading && !payouts.data?.length}
              emptyText="Chưa có lệnh chi trả nào."
              onRetry={() => void payouts.refetch()}
            />
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>NGÂN HÀNG NHẬN</th>
                    <th>SỐ TIỀN</th>
                    <th>NGÀY ĐỀ NGHỊ</th>
                    <th>ĐÃ CHUYỂN</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.data?.map((p) => {
                    const bank = (bankAccounts.data ?? []).find((a) => a.id === p.bankAccountId);
                    return (
                      <tr key={p.id}>
                        <td>
                          {bank
                            ? `${bank.bankCode} (*${bank.accountNumber.slice(-4)})`
                            : `TK …${p.bankAccountId.slice(0, 8)}`}
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatVnd(p.amount)}</td>
                        <td>{formatDateTime(p.createdAt)}</td>
                        <td>{formatDateTime(p.confirmedAt)}</td>
                        <td>
                          <StatusBadge map={PAYOUT_STATUS} status={p.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!payouts.isLoading && !payouts.error && !payouts.data?.length && (
                    <EmptyRow colSpan={5} text="Chưa có lệnh chi trả nào." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. o-bank */}
      {activeScreen === 'o-bank' && (
        <div>
          {pendingBank && (
            <FigmaInfoAlert tone="warning">
              Yêu cầu đổi ngân hàng tới {pendingBank.bankCode} · {pendingBank.accountNumber} đang chờ Admin duyệt.
            </FigmaInfoAlert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
                Gửi yêu cầu đổi tài khoản ngân hàng
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Ngân hàng / mã BIN</label>
                  <input
                    className="form-input"
                    placeholder="Vietcombank hoặc 970436"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Số tài khoản doanh nghiệp</label>
                  <input
                    className="form-input"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Tên chủ tài khoản (trùng tên pháp nhân KYC)</label>
                  <input
                    className="form-input"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                  />
                </div>
                <FigmaInfoAlert tone="info">
                  Yêu cầu mới sẽ ở trạng thái chờ duyệt. Tài khoản đang sử dụng vẫn nhận chi trả cho tới khi Admin duyệt.
                </FigmaInfoAlert>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={requestBank.isPending}
                    onClick={submitBank}
                  >
                    {requestBank.isPending ? 'Đang gửi…' : 'Gửi duyệt'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-finance')}>
                    Quay lại
                  </button>
                </div>
              </div>
            </div>
            <FigmaRecordInfoCard />
          </div>

          {activeBank && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 18 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                Tài khoản đang sử dụng
              </div>
              <div style={{ padding: '16px 20px' }}>
                <FigmaContextGrid
                  columns={2}
                  items={[
                    { label: 'Ngân hàng', value: activeBank.bankCode },
                    { label: 'Số tài khoản', value: activeBank.accountNumber },
                    { label: 'Chủ tài khoản', value: activeBank.accountHolder },
                    { label: 'Hiệu lực', value: formatDateTime(activeBank.effectiveAt) },
                  ]}
                />
              </div>
            </div>
          )}

          {!!bankAccounts.data?.length && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 18 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                Lịch sử tài khoản ngân hàng
              </div>
              <QueryNotice
                loading={bankAccounts.isLoading}
                error={bankAccounts.error}
                onRetry={() => void bankAccounts.refetch()}
              />
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>NGÂN HÀNG</th>
                      <th>SỐ TÀI KHOẢN</th>
                      <th>CHỦ TÀI KHOẢN</th>
                      <th>TRẠNG THÁI</th>
                      <th>NGÀY TẠO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.data.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700 }}>{a.bankCode}</td>
                        <td>{a.accountNumber}</td>
                        <td>{a.accountHolder}</td>
                        <td>
                          <StatusBadge map={BANK_ACCOUNT_STATUS} status={a.status} />
                        </td>
                        <td>{formatDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!bankAccounts.isLoading && !bankAccounts.error && !bankAccounts.data?.length && (
            <FigmaNavyContextBanner
              title="Chưa có tài khoản ngân hàng"
              subtitle="Gửi yêu cầu đầu tiên để Admin xác minh tên pháp nhân KYC."
              badge="Cần cập nhật"
            />
          )}
        </div>
      )}
    </div>
  );
}
