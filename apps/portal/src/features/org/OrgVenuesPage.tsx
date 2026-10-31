import { ApiError } from '@event/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search, LayoutGrid, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaInfoAlert,
  FigmaPageHeader,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { api, errorMessage, formatDateTime, useOrgId } from '../../lib/api';
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
import { LayoutTypePicker } from './venues/LayoutTypePicker';
import {
  createTemplateZones,
  definitionErrors,
  fromDefinition,
  toDefinition,
  type EditorZone,
  type VenueTemplateType,
} from './venues/layout-model';

const TEMPLATE_OPTIONS: { id: VenueTemplateType; label: string; desc: string; icon: string }[] = [
  { id: 'stadium', label: 'Sân vận động', desc: '4 Khán đài A, B, C, D quanh sân', icon: '🏟️' },
  { id: 'theater', label: 'Nhà hát / Khán phòng', desc: 'Sân khấu trung tâm + Khán phòng', icon: '🎭' },
  { id: 'cinema', label: 'Rạp chiếu phim', desc: 'Màn chiếu cong + Phòng chiếu', icon: '🎬' },
  { id: 'standing', label: 'Khuôn viên đứng', desc: 'Khu vực mở (GA), không chia ghế', icon: '🎪' },
];

function defaultTemplateForVenue(venueType: string): VenueTemplateType {
  switch (venueType) {
    case 'STADIUM':
      return 'stadium';
    case 'THEATER':
    case 'HALL':
      return 'theater';
    case 'CINEMA':
      return 'cinema';
    case 'OUTDOOR':
    case 'CLUB':
      return 'standing';
    default:
      return 'theater';
  }
}

const VENUE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-venues', label: 'Địa điểm của tổ chức' },
  { id: 'o-venue-create', label: 'Thêm địa điểm mới' },
  { id: 'o-venue-edit', label: 'Thông tin địa điểm' },
  { id: 'o-layouts', label: 'Sơ đồ địa điểm' },
  { id: 'o-layout-type', label: 'Chọn loại hình địa điểm' },
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
  const [venueToDelete, setVenueToDelete] = useState<VenueDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [formVenueId, setFormVenueId] = useState<string | null>(null);

  const venue = useVenue(venueId);
  const createLayout = useCreateLayout(venueId);
  const newVersion = useNewLayoutVersion(venueId);
  const saveDraft = useSaveLayoutDraft();
  const publish = usePublishLayout(venueId);
  const [layoutName, setLayoutName] = useState('Sơ đồ chính');
  const [selectedTemplate, setSelectedTemplate] = useState<VenueTemplateType>('theater');
  const [isSubmittingUnified, setIsSubmittingUnified] = useState(false);
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

  const handleDeleteVenue = (v: VenueDetail) => {
    saveVenue.mutate(
      { id: v.id, status: 'ARCHIVED' },
      {
        onSuccess: () => {
          showToast(`Đã xóa địa điểm "${v.name}".`, 'success');
          setVenueToDelete(null);
          if (activeScreen === 'o-venue-edit') {
            go('o-venues', { venue: null, version: null });
          }
        },
        onError: (err) => showToast(errorMessage(err), 'danger'),
      },
    );
  };

  const handleRestoreVenue = (v: VenueDetail) => {
    saveVenue.mutate(
      { id: v.id, status: 'ACTIVE' },
      {
        onSuccess: () => {
          showToast(`Đã khôi phục hoạt động cho địa điểm "${v.name}".`, 'success');
        },
        onError: (err) => showToast(errorMessage(err), 'danger'),
      },
    );
  };

  const allVenues = venues.data ?? [];
  const activeCount = allVenues.filter((v) => v.status === 'ACTIVE').length;
  const archivedCount = allVenues.filter((v) => v.status === 'ARCHIVED').length;

  const filteredVenues = allVenues.filter((v) => {
    if (statusFilter === 'ACTIVE' && v.status !== 'ACTIVE') return false;
    if (statusFilter === 'ARCHIVED' && v.status !== 'ARCHIVED') return false;
    return true;
  });

  const shownVenues = filteredVenues.filter((v) =>
    `${v.name} ${v.city} ${v.addressLine}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const field = <K extends keyof VenueInput>(key: K) => ({
    value: key === 'capacity' ? (form.capacity === 0 ? '' : form.capacity) : (form[key] ?? ''),
    onChange: (e: { target: { value: string } }) => {
      if (key === 'capacity') {
        const raw = e.target.value.replace(/^0+(?=\d)/, '');
        const val = raw === '' ? 0 : Number(raw);
        setForm((f) => ({ ...f, capacity: isNaN(val) ? 0 : val }));
      } else {
        setForm((f) => ({ ...f, [key]: e.target.value }));
      }
    },
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

  const submitVenueAndLayout = async () => {
    if (!form.name.trim() || !form.addressLine.trim() || !form.city.trim() || form.capacity < 1) {
      showToast('Nhập tên, địa chỉ, thành phố và sức chứa của địa điểm.', 'warning');
      return;
    }
    setIsSubmittingUnified(true);
    try {
      const editing = activeScreen === 'o-venue-edit' ? venueId : null;
      const venueRes = await saveVenue.mutateAsync({ ...form, id: editing ?? undefined, status: 'ACTIVE' });
      const targetVenueId = venueRes.id;
      setFormVenueId(targetVenueId);

      const lName = layoutName.trim() || 'Sơ đồ chính';
      const layoutRes = await api.post<{ layoutId: string; layoutVersionId: string }>(
        `/api/venues/${targetVenueId}/layouts`,
        { name: lName },
      );
      const newVersionId = layoutRes.layoutVersionId;

      const templateZones = createTemplateZones(selectedTemplate);
      await api.put(`/api/layout-versions/${newVersionId}/draft`, {
        definition: toDefinition(templateZones),
      });

      setDraftZones({ versionId: newVersionId, zones: templateZones });
      showToast(`Đã tạo địa điểm "${form.name}" và "${lName}" thành công!`, 'success');
      go('o-layout-editor', { venue: targetVenueId, version: newVersionId });
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    } finally {
      setIsSubmittingUnified(false);
    }
  };

  const addLayoutWithTemplate = async (template: VenueTemplateType = selectedTemplate) => {
    if (!venueId) return;
    const lName = layoutName.trim() || 'Sơ đồ chính';
    setIsSubmittingUnified(true);
    try {
      const layoutRes = await api.post<{ layoutId: string; layoutVersionId: string }>(
        `/api/venues/${venueId}/layouts`,
        { name: lName },
      );
      const newVersionId = layoutRes.layoutVersionId;
      const templateZones = createTemplateZones(template);
      await api.put(`/api/layout-versions/${newVersionId}/draft`, {
        definition: toDefinition(templateZones),
      });
      setDraftZones({ versionId: newVersionId, zones: templateZones });
      showToast(`Đã tạo "${lName}" thành công!`, 'success');
      go('o-layout-editor', { venue: venueId, version: newVersionId });
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    } finally {
      setIsSubmittingUnified(false);
    }
  };

  void addLayoutWithTemplate;

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
          <select
            className="form-select"
            value={form.venueType}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, venueType: val }));
              setSelectedTemplate(defaultTemplateForVenue(val));
            }}
          >
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
                  placeholder="Tìm theo tên, địa chỉ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, background: '#F3F4F6', padding: 4, borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  style={{
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: statusFilter === 'ACTIVE' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    background: statusFilter === 'ACTIVE' ? '#fff' : 'transparent',
                    color: statusFilter === 'ACTIVE' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: statusFilter === 'ACTIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Đang dùng ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: statusFilter === 'ALL' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    background: statusFilter === 'ALL' ? '#fff' : 'transparent',
                    color: statusFilter === 'ALL' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: statusFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Tất cả ({allVenues.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ARCHIVED')}
                  style={{
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: statusFilter === 'ARCHIVED' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    background: statusFilter === 'ARCHIVED' ? '#fff' : 'transparent',
                    color: statusFilter === 'ARCHIVED' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: statusFilter === 'ARCHIVED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Đã xóa / Lưu trữ ({archivedCount})
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormVenueId(null);
                setForm(EMPTY_VENUE);
                setLayoutName('Sơ đồ chính');
                setSelectedTemplate('theater');
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
                        <td style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
                          {v.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              style={{ ...linkButton, color: '#DC2626' }}
                              onClick={() => setVenueToDelete(v)}
                            >
                              Xóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={{ ...linkButton, color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => handleRestoreVenue(v)}
                            >
                              <RotateCcw size={12} /> Khôi phục
                            </button>
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

      {/* o-venue-create / o-venue-edit */}
      {(activeScreen === 'o-venue-create' || activeScreen === 'o-venue-edit') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div
                style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}
              >
                {activeScreen === 'o-venue-edit' ? `Thông tin · ${form.name}` : 'Thêm địa điểm & Thiết lập sơ đồ'}
              </div>
              {activeScreen === 'o-venue-create' && (
                <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={12} /> Tạo chung 1 luồng
                </span>
              )}
            </div>

            {/* Bước 1: Thông tin cơ bản */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 11, background: 'var(--primary)', color: '#fff', fontSize: 12, alignItems: 'center', justifyContent: 'center' }}>1</span>
                Thông tin địa điểm
              </div>
              {venueForm}
            </div>

            {/* Bước 2: Sơ đồ khởi tạo ngay cùng địa điểm */}
            {activeScreen === 'o-venue-create' && (
              <div style={{ marginBottom: 24, padding: 18, background: '#F9FAFB', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 11, background: 'var(--primary)', color: '#fff', fontSize: 12, alignItems: 'center', justifyContent: 'center' }}>2</span>
                  Khởi tạo sơ đồ khu vực & ghế ngồi
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                  Sơ đồ sẽ được tạo và gán sẵn mẫu bố cục để bạn vào vẽ và điều chỉnh ngay lập tức.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Tên sơ đồ</label>
                  <input
                    className="form-input"
                    style={{ background: '#fff' }}
                    placeholder="Ví dụ: Sơ đồ chính"
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Chọn mẫu bố cục</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {TEMPLATE_OPTIONS.map((tmpl) => {
                      const active = selectedTemplate === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          onClick={() => setSelectedTemplate(tmpl.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: active ? 'rgba(217, 66, 45, 0.04)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <span style={{ fontSize: 24 }}>{tmpl.icon}</span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? 'var(--primary)' : 'var(--text)' }}>
                              {tmpl.label}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.3 }}>
                              {tmpl.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeScreen === 'o-venue-create' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmittingUnified || saveVenue.isPending}
                    onClick={submitVenueAndLayout}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
                  >
                    <Sparkles size={16} />
                    {isSubmittingUnified ? 'Đang tạo & thiết lập sơ đồ…' : 'Tạo địa điểm & Vẽ sơ đồ ngay →'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isSubmittingUnified || saveVenue.isPending}
                    onClick={() => submitVenue('ACTIVE')}
                  >
                    Chỉ lưu địa điểm
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saveVenue.isPending}
                    onClick={() => submitVenue('ACTIVE')}
                  >
                    {saveVenue.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                  {venue.data?.status === 'ARCHIVED' ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ color: '#16A34A', borderColor: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      disabled={saveVenue.isPending}
                      onClick={() => venue.data && handleRestoreVenue(venue.data)}
                    >
                      <RotateCcw size={14} /> Khôi phục hoạt động
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ color: '#DC2626', borderColor: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      disabled={saveVenue.isPending}
                      onClick={() => venue.data && setVenueToDelete(venue.data)}
                    >
                      <Trash2 size={14} /> Xóa địa điểm
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => go('o-layouts', { venue: venueId })}
                  >
                    Xem danh sách sơ đồ →
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-venues')}>
                Quay lại
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FigmaRecordInfoCard
              title="Luồng tạo đồng bộ 1 chạm"
              description="Hệ thống sẽ tự động tạo địa điểm, nạp mẫu sơ đồ tương ứng và mở ngay trình vẽ sơ đồ để bạn làm việc mà không cần các bước trung gian."
            />
            <FigmaRecordInfoCard
              title="Sức chứa là giới hạn cứng"
              description="Tổng ghế và chỗ đứng của sơ đồ không được vượt sức chứa địa điểm khi phát hành."
            />
          </div>
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
                alignItems: 'center',
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
              empty={!venueId}
              emptyText="Chọn một địa điểm trong danh sách."
            />
            {venue.isSuccess && !venue.data.layouts?.length && (
              <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(217, 66, 45, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <LayoutGrid size={24} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 700, marginBottom: 6 }}>
                  Địa điểm chưa có sơ đồ
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, marginBottom: 20, lineHeight: 1.5 }}>
                  Khởi tạo nhanh sơ đồ chính kèm mẫu bố cục tương ứng ({venue.data?.name}) để bắt đầu phân bố ghế và khu vực.
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmittingUnified}
                  onClick={() => addLayoutWithTemplate(defaultTemplateForVenue(venue.data?.venueType ?? ''))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px' }}
                >
                  <Sparkles size={16} />
                  {isSubmittingUnified ? 'Đang tạo…' : '⚡ Tạo sơ đồ chính & Bắt đầu vẽ ngay →'}
                </button>
              </div>
            )}
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
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Tên sơ đồ</label>
              <input
                className="form-input"
                placeholder="Ví dụ: Sơ đồ chính"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Mẫu bố cục</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TEMPLATE_OPTIONS.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      padding: '8px 10px',
                      fontSize: 12.5,
                      borderRadius: 'var(--radius-sm)',
                      border: selectedTemplate === tmpl.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedTemplate === tmpl.id ? 'rgba(217, 66, 45, 0.05)' : '#fff',
                      color: selectedTemplate === tmpl.id ? 'var(--primary)' : 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {tmpl.icon} {tmpl.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!venueId || isSubmittingUnified || createLayout.isPending}
              onClick={() => addLayoutWithTemplate(selectedTemplate)}
            >
              {isSubmittingUnified || createLayout.isPending ? 'Đang tạo…' : 'Tạo và vẽ sơ đồ ngay →'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
              Sơ đồ đã phát hành không sửa được: suất diễn đang dùng nó giữ nguyên ghế. Muốn đổi, tạo phiên
              bản mới rồi gán cho suất diễn sau.
            </div>
          </div>
        </div>
      )}

      {/* o-layout-type */}
      {activeScreen === 'o-layout-type' && (
        <LayoutTypePicker
          onSelect={(type) => {
            const templateZones = createTemplateZones(type);
            setZones(templateZones);
            if (versionId) {
              saveDraft.mutate(
                { id: versionId, definition: toDefinition(templateZones) },
                {
                  onSuccess: () => {
                    setScreen('o-layout-editor');
                  },
                },
              );
            } else {
              setScreen('o-layout-editor');
            }
          }}
          onBack={() => setScreen('o-layouts')}
        />
      )}

      {/* o-layout-editor */}
      {activeScreen === 'o-layout-editor' && (
        <div>
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
              <LayoutEditor
                zones={zones}
                onChange={setZones}
                readOnly={!isDraft}
                venueName={venue.data?.name ?? 'Địa điểm'}
                venueCapacity={capacity}
                onSaveDraft={isDraft ? () => saveCurrentDraft() : undefined}
                onPublish={isDraft ? publishCurrent : undefined}
                isSavingDraft={saveDraft.isPending}
                isPublishing={publish.isPending}
                localErrors={isDraft ? localErrors : []}
                serverErrors={serverErrors}
                onOpenTypePicker={() => setScreen('o-layout-type')}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-layouts')}>
                  ← Danh sách sơ đồ
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
      {/* Modal xác nhận xóa địa điểm */}
      {venueToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => !saveVenue.isPending && setVenueToDelete(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 440,
              padding: 24,
              margin: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  Xác nhận xóa địa điểm
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Địa điểm sẽ chuyển sang trạng thái lưu trữ
                </p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, margin: '16px 0' }}>
              Bạn có chắc chắn muốn xóa địa điểm <strong>"{venueToDelete.name}"</strong>? Sau khi xóa, địa điểm sẽ không thể chọn khi tạo sự kiện và suất diễn mới.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saveVenue.isPending}
                onClick={() => setVenueToDelete(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                disabled={saveVenue.isPending}
                onClick={() => handleDeleteVenue(venueToDelete)}
              >
                {saveVenue.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
