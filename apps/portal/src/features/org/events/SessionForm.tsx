import { useState } from 'react';
import { useToast } from '../../../components/common/ToastProvider';
import { FigmaInfoAlert } from '../../../components/common/FigmaScreenPrimitives';
import { errorMessage, useOrgId } from '../../../lib/api';
import { useOrgVenues } from '../data/org-data';
import { useSaveSession, type OrgEventDetail } from '../data/event-data';
import { useVenue } from '../data/venue-data';
import { toIso, toLocalInput } from './datetime';

type SessionRow = OrgEventDetail['sessions'][number];

/** Create / edit a Session (save_session). Only SCHEDULED sessions can change. */
export function SessionForm({
  event,
  session,
  onSaved,
  onCancel,
}: {
  event: OrgEventDetail;
  session: SessionRow | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const orgId = useOrgId();
  const { showToast } = useToast();
  const venues = useOrgVenues(orgId);
  const save = useSaveSession(orgId);
  const [venueId, setVenueId] = useState(session?.venue?.id ?? '');
  const chosenVenueId = venueId || venues.data?.[0]?.id || '';
  const venue = useVenue(chosenVenueId);
  const venueTimezone = session?.venue?.timezone ?? venue.data?.timezone ?? 'Asia/Ho_Chi_Minh';

  const [layoutVersionId, setLayoutVersionId] = useState(session?.layoutVersionId ?? '');
  const [title, setTitle] = useState(session?.title ?? '');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(session?.startsAt, session?.venue?.timezone));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(session?.endsAt, session?.venue?.timezone));
  const [doorsOpenAt, setDoorsOpenAt] = useState(() => toLocalInput(session?.doorsOpenAt, session?.venue?.timezone));
  const [salesStartAt, setSalesStartAt] = useState(() => toLocalInput(session?.salesStartAt, session?.venue?.timezone));
  const [salesEndAt, setSalesEndAt] = useState(() => toLocalInput(session?.salesEndAt, session?.venue?.timezone));
  const [maxTickets, setMaxTickets] = useState(String(session?.maxTicketsPerAccount ?? 10));

  const editable = !session || session.status === 'SCHEDULED';
  const publishedVersions = (venue.data?.layouts ?? []).flatMap((layout) =>
    layout.versions.filter((v) => v.status === 'PUBLISHED').map((v) => ({ ...v, layoutName: layout.name })),
  );
  const chosenVersion = layoutVersionId || publishedVersions[0]?.id || '';

  const submit = () => {
    if (!chosenVenueId || !chosenVersion) {
      showToast('Chọn địa điểm và một sơ đồ đã phát hành.', 'warning');
      return;
    }
    if (!startsAt || !endsAt || !salesStartAt || !salesEndAt) {
      showToast('Nhập giờ diễn và khung giờ mở bán.', 'warning');
      return;
    }
    if (
      endsAt <= startsAt ||
      salesEndAt <= salesStartAt ||
      salesEndAt > endsAt ||
      (doorsOpenAt && doorsOpenAt > startsAt)
    ) {
      showToast(
        'Thời gian chưa hợp lệ: kết thúc sau bắt đầu, mở cửa trước giờ diễn, ngừng bán không sau giờ kết thúc.',
        'warning',
      );
      return;
    }
    save.mutate(
      {
        id: session?.id,
        eventId: event.id,
        venueId: chosenVenueId,
        layoutVersionId: chosenVersion,
        title: title.trim() || null,
        startsAt: toIso(startsAt, venueTimezone),
        endsAt: toIso(endsAt, venueTimezone),
        doorsOpenAt: toIso(doorsOpenAt, venueTimezone),
        salesStartAt: toIso(salesStartAt, venueTimezone),
        salesEndAt: toIso(salesEndAt, venueTimezone),
        maxTicketsPerAccount: Number(maxTickets) || 10,
      },
      {
        onSuccess: ({ id }) => {
          showToast('Đã lưu suất diễn.', 'success');
          onSaved(id);
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const time = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div>
      <label className="form-label">
        {label} <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span>
      </label>
      <input
        className="form-input"
        type="datetime-local"
        value={value}
        disabled={!editable}
        onChange={(e) => set(e.target.value)}
      />
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );

  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
        {session ? `Cấu hình suất diễn · ${session.title ?? event.title}` : `Thêm suất diễn · ${event.title}`}
      </div>
      {!editable && (
        <FigmaInfoAlert tone="info">
          Suất diễn đã mở bán không đổi được giờ, địa điểm hay sơ đồ.
        </FigmaInfoAlert>
      )}
      <div>
        <label className="form-label">Tên suất (tùy chọn)</label>
        <input
          className="form-input"
          placeholder="Ví dụ: Đêm 1"
          value={title}
          disabled={!editable}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Địa điểm</label>
          <select
            className="form-select"
            value={chosenVenueId}
            disabled={!editable}
            onChange={(e) => {
              setVenueId(e.target.value);
              setLayoutVersionId('');
            }}
          >
            {(venues.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Sơ đồ (đã phát hành)</label>
          <select
            className="form-select"
            value={chosenVersion}
            disabled={!editable}
            onChange={(e) => setLayoutVersionId(e.target.value)}
          >
            {!publishedVersions.length && <option value="">Địa điểm chưa có sơ đồ đã phát hành</option>}
            {publishedVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.layoutName} · v{v.versionNo} · {v.totalCapacity} chỗ
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {time('Mở cửa', doorsOpenAt, setDoorsOpenAt, 'Để trống: 1 giờ trước giờ diễn')}
        {time('Bắt đầu', startsAt, setStartsAt)}
        {time('Kết thúc', endsAt, setEndsAt)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {time('Mở bán', salesStartAt, setSalesStartAt)}
        {time('Ngừng bán', salesEndAt, setSalesEndAt)}
        <div>
          <label className="form-label">Tối đa vé / tài khoản</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={maxTickets}
            disabled={!editable}
            onChange={(e) => setMaxTickets(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {editable && (
          <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={submit}>
            {save.isPending ? 'Đang lưu…' : session ? 'Lưu suất diễn' : 'Tạo suất diễn'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Quay lại
        </button>
      </div>
    </div>
  );
}
