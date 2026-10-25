import { useState } from 'react';
import { useToast } from '../../../components/common/ToastProvider';
import { FigmaInfoAlert } from '../../../components/common/FigmaScreenPrimitives';
import { errorMessage } from '../../../lib/api';
import { useLayoutZones } from '../data/org-data';
import {
  TICKET_KIND,
  inventoryOf,
  useSaveTicketType,
  type OrgEventDetail,
  type TicketTypeManage,
} from '../data/event-data';
import { toIso, toLocalInput } from './datetime';

/** Create / edit a ticket type of a Session (save_ticket_type): price, fixed quota, zones, refund policy. */
export function TicketTypeForm({
  session,
  ticketType,
  onSaved,
  onCancel,
}: {
  session: OrgEventDetail['sessions'][number];
  ticketType: TicketTypeManage | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const zones = useLayoutZones(session.layoutVersionId);
  const save = useSaveTicketType(session.id);
  const venueTimezone = session.venue?.timezone ?? 'Asia/Ho_Chi_Minh';

  const [name, setName] = useState(ticketType?.name ?? '');
  const [kind, setKind] = useState<TicketTypeManage['kind']>(ticketType?.kind ?? 'PAID');
  const [price, setPrice] = useState(String(ticketType?.priceAmount ?? 300000));
  const [quota, setQuota] = useState(String(ticketType ? inventoryOf(ticketType).quota : 100));
  const [maxPerOrder, setMaxPerOrder] = useState(ticketType?.maxPerOrder?.toString() ?? '');
  const [zoneIds, setZoneIds] = useState<string[]>(ticketType?.zones.map((z) => z.zoneId) ?? []);
  const [saleStartAt, setSaleStartAt] = useState(() => toLocalInput(ticketType?.saleStartAt, venueTimezone));
  const [saleEndAt, setSaleEndAt] = useState(() => toLocalInput(ticketType?.saleEndAt, venueTimezone));
  const [refundPolicy, setRefundPolicy] = useState(ticketType?.refundPolicy ?? 'ONLY_IF_CANCELLED');
  const [refundDeadline, setRefundDeadline] = useState(ticketType?.refundDeadlineHours?.toString() ?? '48');
  const [visibility, setVisibility] = useState(ticketType?.visibility ?? 'PUBLIC');
  const [status, setStatus] = useState(ticketType?.status ?? 'ACTIVE');
  const sold = ticketType ? inventoryOf(ticketType).sold + inventoryOf(ticketType).locked : 0;

  const submit = () => {
    if (!name.trim()) {
      showToast('Nhập tên hạng vé.', 'warning');
      return;
    }
    if (!zoneIds.length) {
      showToast('Chọn ít nhất một khu vực áp dụng hạng vé.', 'warning');
      return;
    }
    if (kind === 'PAID' && !(Number(price) > 0)) {
      showToast('Vé có phí cần giá lớn hơn 0.', 'warning');
      return;
    }
    if (Number(quota) < sold) {
      showToast(`Quota không thể thấp hơn số vé đã bán / đang giữ (${sold}).`, 'warning');
      return;
    }
    save.mutate(
      {
        id: ticketType?.id,
        name: name.trim(),
        kind,
        priceAmount: kind === 'PAID' ? Number(price) : 0,
        quota: Number(quota),
        maxPerOrder: maxPerOrder ? Number(maxPerOrder) : null,
        zoneIds,
        saleStartAt: toIso(saleStartAt, venueTimezone),
        saleEndAt: toIso(saleEndAt, venueTimezone),
        refundPolicy,
        refundDeadlineHours: refundPolicy === 'REFUNDABLE_BEFORE_DEADLINE' ? Number(refundDeadline) : null,
        visibility: kind === 'COMP' ? 'HIDDEN' : visibility,
        status,
      },
      {
        onSuccess: () => {
          showToast(`Đã lưu hạng vé ${name.trim()}.`, 'success');
          onSaved();
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
        {ticketType ? `Chỉnh sửa hạng vé · ${ticketType.name}` : 'Thêm hạng vé'}
      </div>
      {sold > 0 && (
        <FigmaInfoAlert tone="info">
          Đã bán / đang giữ {sold} vé: giá và khu vực không đổi được nữa, chỉ tăng quota hoặc ngừng bán.
        </FigmaInfoAlert>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Tên hạng vé</label>
          <input
            className="form-input"
            placeholder="Ví dụ: VIP, Standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Loại vé</label>
          <select
            className="form-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as TicketTypeManage['kind'])}
          >
            {Object.entries(TICKET_KIND).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Giá (VND)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            step={1000}
            value={kind === 'PAID' ? price : '0'}
            disabled={kind !== 'PAID'}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Quota (tổng số vé)</label>
          <input
            className="form-input"
            type="number"
            min={sold}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Tối đa / đơn (tùy chọn)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="form-label">Khu vực áp dụng</label>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {(zones.data ?? []).map((zone) => (
            <label
              key={zone.id}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={zoneIds.includes(zone.id)}
                onChange={(e) =>
                  setZoneIds((ids) =>
                    e.target.checked ? [...ids, zone.id] : ids.filter((id) => id !== zone.id),
                  )
                }
              />
              {zone.name} ({zone.kind === 'SEATED' ? `${zone.capacity} ghế` : `${zone.capacity} chỗ đứng`})
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">
            Bắt đầu bán <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone}, để trống: theo suất)</span>
          </label>
          <input
            className="form-input"
            type="datetime-local"
            value={saleStartAt}
            onChange={(e) => setSaleStartAt(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">
            Ngừng bán <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone}, để trống: theo suất)</span>
          </label>
          <input
            className="form-input"
            type="datetime-local"
            value={saleEndAt}
            onChange={(e) => setSaleEndAt(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Chính sách hoàn vé</label>
          <select
            className="form-select"
            value={refundPolicy}
            onChange={(e) => setRefundPolicy(e.target.value as typeof refundPolicy)}
          >
            <option value="ONLY_IF_CANCELLED">Chỉ hoàn khi hủy suất diễn</option>
            <option value="REFUNDABLE_BEFORE_DEADLINE">Cho hoàn trước hạn</option>
          </select>
        </div>
        <div>
          <label className="form-label">Hạn hoàn (giờ trước suất)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            value={refundDeadline}
            disabled={refundPolicy !== 'REFUNDABLE_BEFORE_DEADLINE'}
            onChange={(e) => setRefundDeadline(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Hiển thị</label>
          <select
            className="form-select"
            value={kind === 'COMP' ? 'HIDDEN' : visibility}
            disabled={kind === 'COMP'}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="PUBLIC">Công khai</option>
            <option value="HIDDEN">Ẩn</option>
          </select>
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Đang lưu…' : ticketType ? 'Lưu hạng vé' : 'Thêm hạng vé'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Quay lại
        </button>
      </div>
    </div>
  );
}
