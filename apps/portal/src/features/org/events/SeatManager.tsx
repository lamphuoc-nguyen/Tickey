import { useMemo, useState } from 'react';
import { useToast } from '../../../components/common/ToastProvider';
import { QueryNotice } from '../../../components/common/QueryNotice';
import { FigmaInfoAlert } from '../../../components/common/FigmaScreenPrimitives';
import { errorMessage } from '../../../lib/api';
import { useLayoutZones, type Zone } from '../data/org-data';
import {
  useAssignSeats,
  useSessionSeats,
  useSetSeatStatus,
  useSetZoneHeld,
  useTicketTypes,
  useZoneInventory,
  type OrgEventDetail,
  type SessionSeat,
} from '../data/event-data';

const STATUS_COLORS: Record<SessionSeat['status'], string> = {
  AVAILABLE: '#CBD5E1',
  LOCKED: '#F59E0B',
  SOLD: '#1B7956',
  BLOCKED: '#1F2937',
  HELD: '#7C3AED',
};
const STATUS_LABELS: Record<SessionSeat['status'], string> = {
  AVAILABLE: 'Trống',
  LOCKED: 'Đang giữ thanh toán',
  SOLD: 'Đã bán',
  BLOCKED: 'Chặn (kỹ thuật)',
  HELD: 'Giữ cho BTC',
};
const TYPE_COLORS = ['#E2553B', '#2F6FEB', '#0E7490', '#946018', '#BE185D', '#4D7C0F'];

/**
 * Seats of one Session. "pricing": which ticket type each seat sells as (assign_seats_ticket_type).
 * "status": hold for sponsors / block for technical reasons / release (set_session_seat_status).
 */
export function SeatManager({
  session,
  mode,
}: {
  session: OrgEventDetail['sessions'][number];
  mode: 'pricing' | 'status';
}) {
  const { showToast } = useToast();
  const seats = useSessionSeats(session.id);
  const zones = useLayoutZones(session.layoutVersionId);
  const ticketTypes = useTicketTypes(session.id);
  const zoneInventory = useZoneInventory(session.id);
  const assign = useAssignSeats(session.id);
  const setStatus = useSetSeatStatus(session.id);
  const setHeld = useSetZoneHeld(session.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [reason, setReason] = useState('');
  const [heldDraft, setHeldDraft] = useState<Record<string, string>>({});

  const typeColor = useMemo(
    () => new Map((ticketTypes.data ?? []).map((t, i) => [t.id, TYPE_COLORS[i % TYPE_COLORS.length]])),
    [ticketTypes.data],
  );
  // zone → row → seats (ordered by seat number)
  const grid = useMemo(() => {
    const byZone = new Map<string, Map<string, SessionSeat[]>>();
    for (const seat of seats.data ?? []) {
      const rows = byZone.get(seat.zoneId) ?? new Map<string, SessionSeat[]>();
      rows.set(seat.seat.rowLabel, [...(rows.get(seat.seat.rowLabel) ?? []), seat]);
      byZone.set(seat.zoneId, rows);
    }
    for (const rows of byZone.values())
      for (const [row, list] of rows)
        rows.set(
          row,
          list.sort((a, b) => a.seat.x - b.seat.x),
        );
    return byZone;
  }, [seats.data]);

  const toggle = (ids: string[]) =>
    setSelected((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  const done = (message: string) => {
    setSelected([]);
    showToast(message, 'success');
  };

  const applyPricing = () => {
    if (!ticketTypeId || !selected.length) return;
    assign.mutate(
      { seatIds: selected, ticketTypeId },
      {
        onSuccess: (r) =>
          done(
            r.updated === r.requested
              ? `Đã gán hạng vé cho ${r.updated} ghế.`
              : `Đã gán ${r.updated}/${r.requested} ghế (ghế đã bán hoặc ngoài khu vực của hạng vé được giữ nguyên).`,
          ),
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };
  const applyStatus = (action: 'HOLD' | 'BLOCK' | 'RELEASE') => {
    if (!selected.length) return;
    if (action !== 'RELEASE' && !reason.trim()) {
      showToast('Nhập lý do giữ / chặn ghế.', 'warning');
      return;
    }
    setStatus.mutate(
      { seatIds: selected, action, reason: reason.trim() || undefined },
      {
        onSuccess: () =>
          done(
            action === 'RELEASE' ? 'Đã giải phóng ghế.' : action === 'HOLD' ? 'Đã giữ ghế.' : 'Đã chặn ghế.',
          ),
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const seatColor = (seat: SessionSeat) =>
    mode === 'pricing'
      ? seat.ticketTypeId
        ? (typeColor.get(seat.ticketTypeId) ?? '#94A3B8')
        : '#E2E8F0'
      : STATUS_COLORS[seat.status];
  const seatedZones = (zones.data ?? []).filter((z) => z.kind === 'SEATED');
  const standingZones = (zones.data ?? []).filter((z) => z.kind === 'STANDING');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
      <div className="card" style={{ padding: 18 }}>
        <QueryNotice loading={seats.isLoading || zones.isLoading} error={seats.error ?? zones.error} />
        {seatedZones.map((zone: Zone) => (
          <div key={zone.id} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{zone.name}</div>
            {[...(grid.get(zone.id) ?? new Map<string, SessionSeat[]>())].map(([row, rowSeats]) => (
              <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <button
                  type="button"
                  title="Chọn cả hàng"
                  onClick={() => toggle(rowSeats.map((s) => s.seatId))}
                  style={{
                    width: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {row}
                </button>
                {rowSeats.map((seat) => (
                  <button
                    key={seat.seatId}
                    type="button"
                    title={`${seat.seat.seatCode} · ${STATUS_LABELS[seat.status]}${seat.holdReason ? ` · ${seat.holdReason}` : ''}`}
                    onClick={() => toggle([seat.seatId])}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      fontSize: 8,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      background: seatColor(seat),
                      border: selected.includes(seat.seatId) ? '2px solid #111827' : '1px solid transparent',
                    }}
                  >
                    {seat.seat.seatNumber}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
        {mode === 'status' &&
          standingZones.map((zone) => {
            const inventory = zoneInventory.data?.find((z) => z.zoneId === zone.id);
            const value = heldDraft[zone.id] ?? String(inventory?.held ?? 0);
            return (
              <div
                key={zone.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13 }}
              >
                <strong style={{ minWidth: 120 }}>{zone.name}</strong>
                <span style={{ color: 'var(--muted)' }}>
                  {inventory
                    ? `${inventory.sold} đã bán · ${inventory.locked} đang giữ / ${inventory.capacity}`
                    : ''}
                </span>
                Giữ cho BTC
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  style={{ width: 90 }}
                  value={value}
                  onChange={(e) => setHeldDraft((d) => ({ ...d, [zone.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={setHeld.isPending}
                  onClick={() =>
                    setHeld.mutate(
                      { zoneId: zone.id, held: Number(value) },
                      {
                        onSuccess: () => showToast(`Đã giữ ${value} chỗ ở ${zone.name}.`, 'success'),
                        onError: (error) => showToast(errorMessage(error), 'danger'),
                      },
                    )
                  }
                >
                  Lưu
                </button>
              </div>
            );
          })}
      </div>

      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Đã chọn {selected.length} ghế</div>
        {mode === 'pricing' ? (
          <>
            {(ticketTypes.data ?? []).map((t) => (
              <label
                key={t.id}
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <input
                  type="radio"
                  name="ticket-type"
                  checked={ticketTypeId === t.id}
                  onChange={() => setTicketTypeId(t.id)}
                />
                <span style={{ width: 12, height: 12, borderRadius: 3, background: typeColor.get(t.id) }} />
                {t.name}
              </label>
            ))}
            {!ticketTypes.data?.length && (
              <FigmaInfoAlert tone="info">Tạo hạng vé trước khi gán ghế.</FigmaInfoAlert>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selected.length || !ticketTypeId || assign.isPending}
              onClick={applyPricing}
            >
              {assign.isPending ? 'Đang gán…' : 'Gán hạng vé cho ghế đã chọn'}
            </button>
          </>
        ) : (
          <>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: STATUS_COLORS[status as SessionSeat['status']],
                  }}
                />
                {label}
              </div>
            ))}
            <textarea
              className="form-input"
              rows={2}
              placeholder="Lý do (tài trợ, nghệ sĩ, khuất tầm nhìn…)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selected.length || setStatus.isPending}
                onClick={() => applyStatus('HOLD')}
              >
                Giữ ghế
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!selected.length || setStatus.isPending}
                onClick={() => applyStatus('BLOCK')}
              >
                Chặn ghế
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!selected.length || setStatus.isPending}
                onClick={() => applyStatus('RELEASE')}
              >
                Giải phóng
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Chỉ ghế trống mới giữ / chặn được; ghế đã bán hoặc đang thanh toán được bỏ qua.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
