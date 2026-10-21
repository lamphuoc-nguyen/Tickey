import { useState } from 'react';
import { useToast } from '../../../components/common/ToastProvider';
import { FigmaEventPreviewCard } from '../../../components/common/FigmaScreenPrimitives';
import { api, errorMessage, useOrgId } from '../../../lib/api';
import { slugify, useCategories, useSaveEvent, type OrgEventDetail } from '../data/event-data';

/** Create / edit the Event shell (save_event). Selling happens per Session. */
export function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event: OrgEventDetail | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const orgId = useOrgId();
  const { showToast } = useToast();
  const categories = useCategories();
  const save = useSaveEvent(orgId);
  const [title, setTitle] = useState(event?.title ?? '');
  const [slug, setSlug] = useState(event?.slug ?? '');
  const [summary, setSummary] = useState(event?.summary ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '');
  const [ageLimit, setAgeLimit] = useState(event?.ageLimit?.toString() ?? '');
  const [terms, setTerms] = useState(event?.terms ?? '');
  const [cover, setCover] = useState(event?.coverImageUrl ?? null);
  const [uploading, setUploading] = useState(false);

  const effectiveSlug = slug || slugify(title);

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await api.upload(file, 'EVENT_ASSET', orgId);
      setCover(publicUrl);
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (title.trim().length < 3) {
      showToast('Tên sự kiện cần ít nhất 3 ký tự.', 'warning');
      return;
    }
    if (!/^[a-z0-9-]{3,120}$/.test(effectiveSlug)) {
      showToast('Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (3–120 ký tự).', 'warning');
      return;
    }
    save.mutate(
      {
        id: event?.id,
        title: title.trim(),
        slug: effectiveSlug,
        summary: summary.trim() || null,
        description: description.trim() || null,
        categoryId: categoryId || null,
        coverImageUrl: cover,
        ageLimit: ageLimit === '' ? null : Number(ageLimit),
        terms: terms.trim() || null,
      },
      {
        onSuccess: ({ id }) => {
          showToast(`Đã lưu sự kiện "${title.trim()}".`, 'success');
          onSaved(id);
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
          {event ? `Thông tin sự kiện · ${event.title}` : 'Tạo sự kiện mới'}
        </div>
        <div>
          <label className="form-label">Tên sự kiện</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Đêm nhạc Mùa Thu"
          />
        </div>
        <div>
          <label className="form-label">Đường dẫn (slug)</label>
          <input
            className="form-input"
            value={effectiveSlug}
            onChange={(e) => setSlug(slugify(e.target.value) || e.target.value.toLowerCase())}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Thể loại</label>
            <select
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Chưa chọn</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Giới hạn độ tuổi (0–21, để trống nếu không có)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={21}
              value={ageLimit}
              onChange={(e) => setAgeLimit(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="form-label">Tóm tắt</label>
          <input className="form-input" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Mô tả chi tiết</label>
          <textarea
            className="form-input"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Điều khoản tham dự</label>
          <textarea
            className="form-input"
            rows={3}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={save.isPending || uploading}
            onClick={submit}
          >
            {save.isPending ? 'Đang lưu…' : event ? 'Lưu thay đổi' : 'Tạo sự kiện'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
      <FigmaEventPreviewCard
        title={title || 'Chưa đặt tên sự kiện'}
        subtitle={summary || 'Ban tổ chức'}
        badge={event ? 'Đang chỉnh sửa' : 'Bản nháp'}
        image={cover}
        uploading={uploading}
        onFile={(file) => void uploadCover(file)}
        onImageChange={(url) => setCover(url || null)}
      />
    </div>
  );
}
