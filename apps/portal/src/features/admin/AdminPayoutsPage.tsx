import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const ADMIN_PAYOUT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-refunds', label: 'Quản lý hoàn tiền (Refunds)' },
  { id: 'a-refund-detail', label: 'Chi tiết lệnh hoàn · RF-024' },
  { id: 'a-refund-create', label: 'Tạo lệnh hoàn tiền thủ công' },
  { id: 'a-refund-transfer', label: 'Xác nhận chuyển khoản hoàn tiền' },
  { id: 'a-refund-result', label: 'Đã hoàn tất chuyển tiền hoàn' },
  { id: 'a-chargebacks', label: 'Khiếu nại bồi hoàn thẻ (Chargebacks)' },
  { id: 'a-chargeback-edit', label: 'Cập nhật hồ sơ Chargeback · CB-03' },
  { id: 'a-payouts', label: 'Giải ngân cho Tổ chức (Payouts)' },
  { id: 'a-payout-review', label: 'Kiểm tra giải ngân · PO-8821' },
  { id: 'a-payout-cancel', label: 'Hủy / Tạm hoãn lệnh giải ngân' },
  { id: 'a-payout-result', label: 'Đã giải ngân cho Tổ chức' },
  { id: 'a-bank', label: 'Xác minh tài khoản ngân hàng Tổ chức' },
  { id: 'a-bank-review', label: 'Kiểm tra ngân hàng · Ánh Trăng Events' },
  { id: 'a-bank-result', label: 'Đã phê duyệt ngân hàng Tổ chức' },
];

export function AdminPayoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, executeAdminRefundTransfer, processAdminPayout, approveAdminBank } =
    useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-payouts';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [selectedPayoutId, setSelectedPayoutId] = useState<string>('po-1');
  const payoutsList = state?.adminPayouts || [];
  const selectedPayout =
    payoutsList.find((p) => p.id === selectedPayoutId) || payoutsList[0];

  const [manualOrder, setManualOrder] = useState('TK-1024 · Nguyễn Minh Anh');
  const [manualAmount, setManualAmount] = useState('1.800.000đ');
  const [bankRef, setBankRef] = useState('VCB-REF-20261021-8892');

  const [cbNote, setCbNote] = useState(
    'Đã nộp log 3DS2 và biên nhận vé điện tử lên cổng thanh toán Quốc tế.',
  );
  const [payoutCancelReason, setPayoutCancelReason] = useState(
    'Tạm hoãn chờ hoàn tất đối chiếu 2 đơn hoàn tiền phát sinh.',
  );

  const screenMeta =
    ADMIN_PAYOUT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_PAYOUT_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_PAYOUT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* Top quick module switch bar */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
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
                placeholder="Tìm theo mã RF-..., đơn vé..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-refund-create')}
            >
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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.refunds.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ HOÀN</th>
                    <th>ĐƠN VÉ</th>
                    <th>KHÁCH HÀNG</th>
                    <th>SỐ TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.refunds.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.code}</td>
                      <td>{r.orderCode}</td>
                      <td>{r.customerName}</td>
                      <td>{r.amount}</td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === 'TRANSFERRED'
                              ? 'badge-success'
                              : 'badge-warning'
                          }`}
                        >
                          {r.status === 'TRANSFERRED'
                            ? 'Đã chuyển hoàn'
                            : 'Chờ chuyển hoàn'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setScreen('a-refund-detail')}
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
        </div>
      )}

      {/* 2. a-refund-detail */}
      {activeScreen === 'a-refund-detail' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Lệnh hoàn RF-024"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã hoàn & Đơn vé', value: 'RF-024 · Đơn TK-1024 (Nguyễn Minh Anh)' },
              { label: 'Số tiền & Kênh hoàn', value: '1.800.000đ · Hoàn qua cổng VNPay gốc' },
              { label: 'Xác nhận từ Tổ chức', value: 'Đã duyệt hoàn & mở lại ghế C04, C05' },
              { label: 'Trạng thái thực thi', value: 'Sẵn sàng đẩy lệnh hoàn tiền' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-refund-transfer')}
            >
              Thực hiện chuyển khoản hoàn
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-refunds')}
            >
              Quay lại
            </button>
          </div>
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
                <label className="form-label">Đơn vé áp dụng</label>
                <input
                  className="form-input"
                  value={manualOrder}
                  onChange={(e) => setManualOrder(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Số tiền hoàn</label>
                <input
                  className="form-input"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã khởi tạo lệnh hoàn tiền thủ công.', 'success');
                    setScreen('a-refund-transfer');
                  }}
                >
                  Tiếp tục chuyển khoản
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-refunds')}
                >
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Lệnh hoàn</label>
                <input className="form-input" readOnly value="RF-024 · 1.800.000đ" />
              </div>
              <div>
                <label className="form-label">Mã tham chiếu ngân hàng / Cổng thanh toán</label>
                <input
                  className="form-input"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    executeAdminRefundTransfer('rf-1');
                    showToast('Đã ghi nhận hoàn tất chuyển khoản hoàn tiền RF-024.', 'success');
                    setScreen('a-refund-result');
                  }}
                >
                  Xác nhận đã chuyển tiền
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-refund-detail')}
                >
                  Quay lại
                </button>
              </div>
            </div>
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
            Bút toán {bankRef} đã được khấu trừ vào quỹ dự phòng đối soát của sự kiện.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-refunds')}>
            Danh sách hoàn tiền
          </button>
        </div>
      )}

      {/* 6. a-chargebacks */}
      {activeScreen === 'a-chargebacks' && (
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>1 bản ghi</div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MÃ CB</th>
                  <th>MÃ ĐƠN</th>
                  <th>NGÂN HÀNG PHÁT HÀNH</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>CB-03</td>
                  <td>TK-1019</td>
                  <td>HSBC Visa · *8821</td>
                  <td>1.800.000đ</td>
                  <td>
                    <span className="badge badge-warning">Đang kháng nghị</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setScreen('a-chargeback-edit')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Cập nhật →
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. a-chargeback-edit */}
      {activeScreen === 'a-chargeback-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Hồ sơ Chargeback CB-03
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Mã hồ sơ & Giao dịch</label>
                <input className="form-input" readOnly value="CB-03 · Đơn TK-1019 (1.800.000đ)" />
              </div>
              <div>
                <label className="form-label">Bằng chứng đối kháng gửi Ngân hàng</label>
                <input
                  className="form-input"
                  value={cbNote}
                  onChange={(e) => setCbNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã lưu hồ sơ kháng nghị Chargeback CB-03.', 'success');
                    setScreen('a-chargebacks');
                  }}
                >
                  Lưu cập nhật
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-chargebacks')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 8. a-payouts */}
      {activeScreen === 'a-payouts' && (
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {payoutsList.length} bản ghi
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MÃ LỆNH</th>
                  <th>TỔ CHỨC</th>
                  <th>KỲ ĐỐI SOÁT</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {payoutsList.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.code}</td>
                    <td>{p.orgName}</td>
                    <td>{p.settlementCode}</td>
                    <td>{p.amount}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.status === 'PAID'
                            ? 'badge-success'
                            : p.status === 'CANCELLED'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {p.status === 'PAID'
                          ? 'Đã giải ngân'
                          : p.status === 'CANCELLED'
                            ? 'Đã tạm hoãn'
                            : 'Chờ giải ngân'}
                      </span>
                    </td>
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
                        Xử lý →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. a-payout-review */}
      {activeScreen === 'a-payout-review' && (
        <div>
          <FigmaNavyContextBanner
            title={selectedPayout?.orgName || 'Ánh Trăng Events'}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={
              selectedPayout?.status === 'PAID'
                ? 'Đã giải ngân'
                : selectedPayout?.status === 'CANCELLED'
                  ? 'Đã tạm hoãn'
                  : `Lệnh ${selectedPayout?.code || 'PO-8821'}`
            }
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Lệnh chi trả & Kỳ đối soát',
                value: `${selectedPayout?.code || 'PO-8821'} · Kỳ ${selectedPayout?.settlementCode || 'STL-2026-10A'}`,
              },
              {
                label: 'Số tiền giải ngân ròng',
                value: `${selectedPayout?.amount || '64.200.000đ'} (Đã trừ phí 5% và quỹ dự phòng 10%)`,
              },
              {
                label: 'Tài khoản thụ hưởng',
                value: `${selectedPayout?.orgName || 'Ánh Trăng Events'} · Đã xác minh`,
              },
              { label: 'Phê duyệt kép', value: 'Đã hoàn tất kiểm tra tính hợp lệ của kỳ đối soát' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedPayout) {
                  processAdminPayout(selectedPayout.id, 'PAID');
                  showToast(`Đã xác nhận giải ngân lệnh ${selectedPayout.code}.`, 'success');
                  setScreen('a-payout-result');
                }
              }}
            >
              Xác nhận giải ngân
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-payout-cancel')}
            >
              Tạm hoãn / Hủy lệnh
            </button>
          </div>
        </div>
      )}

      {/* 10. a-payout-cancel */}
      {activeScreen === 'a-payout-cancel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Tạm hoãn lệnh giải ngân {selectedPayout?.code || 'PO-8821'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Lý do tạm hoãn giải ngân</label>
                <input
                  className="form-input"
                  value={payoutCancelReason}
                  onChange={(e) => setPayoutCancelReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedPayout) {
                      processAdminPayout(selectedPayout.id, 'CANCELLED');
                      showToast(`Đã tạm hoãn lệnh giải ngân ${selectedPayout.code}.`, 'warning');
                      setScreen('a-payouts');
                    }
                  }}
                >
                  Xác nhận tạm hoãn
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-payout-review')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 11. a-payout-result */}
      {activeScreen === 'a-payout-result' && (
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
            Đã hoàn tất giải ngân PO-8821
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14 }}>
            Ủy nhiệm chi 64.200.000đ đã được đồng bộ sang cổng tài chính của Ánh Trăng Events.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-payouts')}>
            Danh sách giải ngân
          </button>
        </div>
      )}

      {/* 12. a-bank */}
      {activeScreen === 'a-bank' && (
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>1 bản ghi</div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>TỔ CHỨC</th>
                  <th>NGÂN HÀNG MỚI</th>
                  <th>SỐ TÀI KHOẢN</th>
                  <th>CHỦ TÀI KHOẢN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Ánh Trăng Events</td>
                  <td>{state.orgBank.bankName}</td>
                  <td>{state.orgBank.accountNumber}</td>
                  <td>{state.orgBank.accountHolder}</td>
                  <td>
                    <span
                      className={`badge ${
                        state.orgBank.status === 'VERIFIED' ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {state.orgBank.status === 'VERIFIED' ? 'Đã xác minh' : 'Chờ duyệt'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setScreen('a-bank-review')}
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 13. a-bank-review */}
      {activeScreen === 'a-bank-review' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Xác minh ngân hàng"
          />
          <FigmaContextGrid
            items={[
              { label: 'Pháp nhân trên giấy phép KYC', value: 'CONG TY TNHH ANH TRANG EVENTS' },
              { label: 'Tên chủ tài khoản ngân hàng', value: state.orgBank.accountHolder },
              { label: 'Ngân hàng & Số tài khoản', value: `${state.orgBank.bankName} · ${state.orgBank.accountNumber}` },
              { label: 'Xác thực 2FA Owner', value: 'Hợp lệ · Trùng khớp 100% tên pháp nhân' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                approveAdminBank();
                showToast('Đã phê duyệt tài khoản ngân hàng nhận tiền.', 'success');
                setScreen('a-bank-result');
              }}
            >
              Phê duyệt tài khoản ngân hàng
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-bank')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* 14. a-bank-result */}
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
            Đã xác minh tài khoản ngân hàng Tổ chức
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 14 }}>
            Các kỳ đối soát tiếp theo của Ánh Trăng Events sẽ được giải ngân về tài khoản mới.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-bank')}>
            Danh sách ngân hàng
          </button>
        </div>
      )}
    </div>
  );
}
