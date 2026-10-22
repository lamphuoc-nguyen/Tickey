import { ApiError } from '@event/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaInfoAlert,
  FigmaPageHeader,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { errorMessage, formatDateTime, useOrgId } from '../../lib/api';
import {
  VENUE_TYPES,
  useCreateLayout,
  useLayoutVersion,
  useNewLayoutVersion,
  useOrgVenueList,
  usePublishLayout,
  useSaveLayoutDraft,
  useSaveVenue,
  useVenue,
  type VenueDetail,
  type VenueInput,
} from './data/venue-data';
import { LayoutEditor } from './venues/LayoutEditor';
import { definitionErrors, fromDefinition, toDefinition, type EditorZone } from './venues/layout-model';

const VENUE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-venues', label: 'Địa điểm của tổ chức' },
  { id: 'o-venue-create', label: 'Thêm địa điểm mới' },
  { id: 'o-venue-edit', label: 'Thông tin địa điểm' },
  { id: 'o-layouts', label: 'Sơ đồ địa điểm' },
  { id: 'o-layout-editor', label: 'Chỉnh sửa sơ đồ ghế' },
  { id: 'o-layout-published', label: 'Phát hành sơ đồ thành công' },
];

const EMPTY_VENUE: VenueInput = {
  name: '',
  venueType: 'THEATER',
  addressLine: '',
  ward: '',
  district: '',
  city: 'TP. Hồ Chí Minh',
  timezone: 'Asia/Ho_Chi_Minh',
  capacity: 500,
  description: '',
};

// publish_layout_version reports problems as English strings in details.errors.
function publishErrors(error: unknown): string[] {
  if (error instanceof ApiError && Array.isArray(error.details.errors)) {
    return (error.details.errors as string[]).map((e) =>
      e === 'total capacity exceeds venue capacity'
        ? `Tổng sức chứa ${String(error.details.total_capacity)} vượt sức chứa địa điểm (${String(error.details.venue_capacity)}).`
        : e,
    );
  }
  return [errorMessage(error)];
}

const linkButton = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

export function OrgVenuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const orgId = useOrgId();

  // The screen and the selected venue / layout version live in the URL so reloads and Back keep them.
  const activeScreen = searchParams.get('screen') || 'o-venues';
  const venueId = searchParams.get('venue');
  const versionId = searchParams.get('version');
  const go = (screen: string, ids: { venue?: string | null; version?: string | null } = {}) => {
    const next: Record<string, string> = { screen };
    const v = ids.venue === undefined ? venueId : ids.venue;
    const ver = ids.version === undefined ? versionId : ids.version;
    if (v) next.venue = v;
    if (ver) next.version = ver;
    setSearchParams(next);
  };
  const setScreen = (screen: string) => go(screen);

  const venues = useOrgVenueList(orgId);
  const saveVenue = useSaveVenue(orgId);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<VenueInput>(EMPTY_VENUE);
  const [formVenueId, setFormVenueId] = useState<string | null>(null);

  const venue = useVenue(venueId);
  const createLayout = useCreateLayout(venueId);
  const newVersion = useNewLayoutVersion(venueId);
  const saveDraft = useSaveLayoutDraft();
  const publish = usePublishLayout(venueId);
  const [layoutName, setLayoutName] = useState('');
  const version = useLayoutVersion(versionId);
  const [draftZones, setDraftZones] = useState<{ versionId: string; zones: EditorZone[] } | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [published, setPublished] = useState<{ name: string; capacity: number } | null>(null);

  const zones =
    draftZones?.versionId === versionId ? draftZones.zones : fromDefinition(version.data?.definition);
  const setZones = (next: EditorZone[]) => versionId && setDraftZones({ versionId, zones: next });
  const isDraft = version.data?.status === 'DRAFT';
  const capacity = venue.data?.capacity ?? 0;
  const localErrors = isDraft ? definitionErrors(zones, capacity) : [];

  const shownVenues = (venues.data ?? []).filter((v) =>
    `${v.name} ${v.city} ${v.addressLine}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const field = <K extends keyof VenueInput>(key: K) => ({
    value: form[key] ?? '',
    onChange: (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: key === 'capacity' ? Number(e.target.value) : e.target.value })),
  });

  const fillForm = (v: VenueDetail) => {
    setFormVenueId(v.id);
    setForm({
      name: v.name,
      venueType: v.venueType,
      addressLine: v.addressLine,
      ward: v.ward ?? '',
      district: v.district ?? '',
      city: v.city,
      timezone: v.timezone,
      capacity: v.capacity,
      description: v.description ?? '',
    });
  };
  // A reload on o-venue-edit has the venue id but no form yet: fill it once the venue loads.
  if (activeScreen === 'o-venue-edit' && venue.data && formVenueId !== venue.data.id) fillForm(venue.data);

  const openVenue = (v: VenueDetail, screen: string) => {
    fillForm(v);
    go(screen, { venue: v.id, version: null });
  };

  const submitVenue = (status?: 'ACTIVE' | 'ARCHIVED') => {
    if (!form.name.trim() || !form.addressLine.trim() || !form.city.trim() || form.capacity < 1) {
      showToast('Nhập tên, địa chỉ, thành phố và sức chứa của địa điểm.', 'warning');
      return;
    }
    const editing = activeScreen === 'o-venue-edit' ? venueId : null;
    saveVenue.mutate(
      { ...form, id: editing ?? undefined, status },
      {
        onSuccess: ({ id }) => {
          showToast(
            status === 'ARCHIVED' ? `Đã lưu trữ ${form.name}.` : `Đã lưu địa điểm ${form.name}.`,
            'success',
          );
          setFormVenueId(id);
          go(status === 'ARCHIVED' ? 'o-venues' : 'o-layouts', { venue: id, version: null });
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const openVersion = (id: string) => {
    setServerErrors([]);
    go('o-layout-editor', { version: id });
  };

  const addLayout = () => {
    if (!layoutName.trim()) {
      showToast('Đặt tên cho sơ đồ, ví dụ "Sơ đồ chính".', 'warning');
      return;
    }
    createLayout.mutate(layoutName.trim(), {
      onSuccess: ({ layoutVersionId }) => {
        setLayoutName('');
        openVersion(layoutVersionId);
      },
      onError: (error) => showToast(errorMessage(error), 'danger'),
    });
  };

  const editPublished = (layoutId: string) =>
    newVersion.mutate(layoutId, {
      onSuccess: ({ id }) => openVersion(id),
      onError: (error) => showToast(errorMessage(error), 'danger'),
    });

  const saveCurrentDraft = (then?: () => void) => {
    if (!versionId) return;
    if (localErrors.length) {
      setServerErrors(localErrors);
      return;
    }
    saveDraft.mutate(
      { id: versionId, definition: toDefinition(zones) },
      {
        onSuccess: () => {
          setServerErrors([]);
          if (then) then();
          else showToast('Đã lưu bản nháp sơ đồ.', 'success');
        },
        onError: (error) => setServerErrors(publishErrors(error)),
      },
    );
  };

  const publishCurrent = () =>
    saveCurrentDraft(() =>
      publish.mutate(versionId!, {
        onSuccess: ({ totalCapacity }) => {
          setPublished({ name: venue.data?.name ?? '', capacity: totalCapacity });
          setDraftZones(null);
          setScreen('o-layout-published');
        },
        onError: (error) => setServerErrors(publishErrors(error)),
      }),
    );

  const screenMeta = VENUE_SCREENS.find((s) => s.id === activeScreen) || VENUE_SCREENS[0];

  const venueForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="form-label">Tên địa điểm</label>
        <input className="form-input" placeholder="Ví dụ: Nhà hát Ánh Trăng" {...field('name')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Loại hình</label>
          <select className="form-select" {...field('venueType')}>
            {Object.entries(VENUE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Sức chứa tối đa (người)</label>
          <input className="form-input" type="number" min={1} {...field('capacity')} />
        </div>
      </div>
      <div>
        <label className="form-label">Địa chỉ</label>
        <input className="form-input" placeholder="Số nhà, đường" {...field('addressLine')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Phường / xã</label>
          <input className="form-input" {...field('ward')} />
        </div>
        <div>
          <label className="form-label">Quận / huyện</label>
          <input className="form-input" {...field('district')} />
        </div>
        <div>
          <label className="form-label">Tỉnh / thành phố</label>
          <input className="form-input" {...field('city')} />
        </div>
      </div>
      <div>
        <label className="form-label">Mô tả (tùy chọn)</label>
        <textarea className="form-input" rows={3} {...field('description')} />
      </div>
    </div>
  );

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={VENUE_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* o-venues */}
      {activeScreen === 'o-venues' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
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
                placeholder="Tìm theo tên, địa chỉ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormVenueId(null);
                setForm(EMPTY_VENUE);
                go('o-venue-create', { venue: null, version: null });
              }}
            >
              + Thêm địa điểm
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <QueryNotice
              loading={venues.isLoading}
              error={venues.error}
              empty={venues.isSuccess && !shownVenues.length}
              emptyText="Chưa có địa điểm. Thêm địa điểm để vẽ sơ đồ và tạo suất diễn."
              onRetry={() => void venues.refetch()}
            />
            {!!shownVenues.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ĐỊA ĐIỂM</th>
                      <th>LOẠI HÌNH</th>
                      <th>ĐỊA CHỈ</th>
                      <th>SỨC CHỨA</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownVenues.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 700 }}>{v.name}</td>
                        <td>{VENUE_TYPES[v.venueType] ?? v.venueType}</td>
                        <td>{[v.addressLine, v.district, v.city].filter(Boolean).join(', ')}</td>
                        <td>{v.capacity.toLocaleString('vi-VN')}</td>
                        <td>
                          <span
                            className={`badge ${v.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}
                          >
                            {v.status === 'ACTIVE' ? 'Đang dùng' : 'Đã lưu trữ'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: 12 }}>
                          <button type="button" style={linkButton} onClick={() => openVenue(v, 'o-layouts')}>
                            Sơ đồ →
                          </button>
                          <button
                            type="button"
                            style={linkButton}
                            onClick={() => openVenue(v, 'o-venue-edit')}
                          >
                            Sửa
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

      {/* o-venue-create / o-venue-edit */}
      {(activeScreen === 'o-venue-create' || activeScreen === 'o-venue-edit') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}
            >
              {activeScreen === 'o-venue-edit' ? `Thông tin · ${form.name}` : 'Thêm địa điểm mới'}
            </div>
            {venueForm}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saveVenue.isPending}
                onClick={() => submitVenue('ACTIVE')}
              >
                {saveVenue.isPending
                  ? 'Đang lưu…'
                  : activeScreen === 'o-venue-edit'
                    ? 'Lưu thay đổi'
                    : 'Tạo địa điểm'}
              </button>
              {activeScreen === 'o-venue-edit' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saveVenue.isPending}
                  onClick={() => submitVenue('ARCHIVED')}
                >
                  Lưu trữ địa điểm
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-venues')}>
                Quay lại
              </button>
            </div>
          </div>
          <FigmaRecordInfoCard
            title="Sức chứa là giới hạn cứng"
            description="Tổng ghế và chỗ đứng của sơ đồ không được vượt sức chứa địa điểm khi phát hành."
          />
        </div>
      )}

      {/* o-layouts */}
      {activeScreen === 'o-layouts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Sơ đồ · {venue.data?.name ?? 'Chọn địa điểm'}
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-venues')}>
                ← Địa điểm
              </button>
            </div>
            <QueryNotice
              loading={venue.isLoading}
              error={venue.error}
              empty={!venueId || (venue.isSuccess && !venue.data.layouts?.length)}
              emptyText={
                venueId ? 'Địa điểm chưa có sơ đồ. Tạo sơ đồ bên phải.' : 'Chọn một địa điểm trong danh sách.'
              }
            />
            {(venue.data?.layouts ?? []).map((layout) => {
              const versions = [...layout.versions].sort((a, b) => b.versionNo - a.versionNo);
              const draft = versions.find((v) => v.status === 'DRAFT');
              return (
                <div
                  key={layout.id}
                  style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <strong>{layout.name}</strong>
                    {draft ? (
                      <button type="button" style={linkButton} onClick={() => openVersion(draft.id)}>
                        Sửa bản nháp v{draft.versionNo} →
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={linkButton}
                        disabled={newVersion.isPending}
                        onClick={() => editPublished(layout.id)}
                      >
                        Tạo phiên bản mới →
                      </button>
                    )}
                  </div>
                  <table className="table">
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id}>
                          <td>v{v.versionNo}</td>
                          <td>
                            <span
                              className={`badge ${v.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}
                            >
                              {v.status === 'PUBLISHED' ? 'Đã phát hành' : 'Bản nháp'}
                            </span>
                          </td>
                          <td>{v.totalCapacity ? `${v.totalCapacity.toLocaleString('vi-VN')} chỗ` : '—'}</td>
                          <td>{formatDateTime(v.publishedAt)}</td>
                          <td>
                            <button type="button" style={linkButton} onClick={() => openVersion(v.id)}>
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}
            >
              Tạo sơ đồ mới
            </div>
            <input
              className="form-input"
              placeholder="Tên sơ đồ, ví dụ: Sơ đồ chính"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12, width: '100%' }}
              disabled={!venueId || createLayout.isPending}
              onClick={addLayout}
            >
              {createLayout.isPending ? 'Đang tạo…' : 'Tạo và vẽ sơ đồ'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
              Sơ đồ đã phát hành không sửa được: suất diễn đang dùng nó giữ nguyên ghế. Muốn đổi, tạo phiên
              bản mới rồi gán cho suất diễn sau.
            </div>
          </div>
        </div>
      )}

      {/* o-layout-editor */}
      {activeScreen === 'o-layout-editor' && (
        <div className="card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
              {venue.data?.name ?? 'Sơ đồ'} · v{version.data?.versionNo ?? '…'}{' '}
              <span className={`badge ${isDraft ? 'badge-warning' : 'badge-success'}`}>
                {isDraft ? 'Bản nháp' : 'Đã phát hành'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              Sức chứa địa điểm: {capacity.toLocaleString('vi-VN')}
            </div>
          </div>
          <QueryNotice
            loading={version.isLoading}
            error={version.error}
            empty={!versionId}
            emptyText="Chọn sơ đồ để chỉnh sửa."
          />
          {version.data && (
            <>
              {!isDraft && (
                <div style={{ marginBottom: 14 }}>
                  <FigmaInfoAlert tone="info">
                    Phiên bản đã phát hành chỉ xem được. Tạo phiên bản mới để thay đổi.
                  </FigmaInfoAlert>
                </div>
              )}
              <LayoutEditor zones={zones} onChange={setZones} readOnly={!isDraft} />
              {!!(serverErrors.length || (isDraft && localErrors.length)) && (
                <div style={{ marginTop: 14 }}>
                  <FigmaInfoAlert tone="danger">
                    {(serverErrors.length ? serverErrors : localErrors).map((e) => (
                      <div key={e}>• {e}</div>
                    ))}
                  </FigmaInfoAlert>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                {isDraft && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saveDraft.isPending}
                      onClick={() => saveCurrentDraft()}
                    >
                      {saveDraft.isPending ? 'Đang lưu…' : 'Lưu bản nháp'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saveDraft.isPending || publish.isPending || localErrors.length > 0}
                      onClick={publishCurrent}
                    >
                      {publish.isPending ? 'Đang phát hành…' : 'Kiểm tra & phát hành'}
                    </button>
                  </>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-layouts')}>
                  Danh sách sơ đồ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* o-layout-published */}
      {activeScreen === 'o-layout-published' && (
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
            Đã phát hành sơ đồ
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 18, lineHeight: 1.5 }}
          >
            {published ? `${published.name}: ${published.capacity.toLocaleString('vi-VN')} chỗ.` : ''} Sơ đồ
            đã khóa và dùng được khi tạo suất diễn.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('o-layouts')}>
            Danh sách sơ đồ
          </button>
        </div>
      )}
    </div>
  );
}
