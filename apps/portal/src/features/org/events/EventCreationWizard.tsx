import { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Ticket,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Send,
  Eye,
  Info,
} from 'lucide-react';
import { useToast } from '../../../components/common/ToastProvider';
import { FigmaEventPreviewCard, FigmaInfoAlert } from '../../../components/common/FigmaScreenPrimitives';
import { api, errorMessage, formatVnd, useOrgId } from '../../../lib/api';
import {
  slugify,
  useCategories,
  useSaveEvent,
  useSaveSession,
  useSaveTicketType,
  useSubmitEvent,
} from '../data/event-data';
import { useOrgVenues, useLayoutZones } from '../data/org-data';
import { useVenue } from '../data/venue-data';
import { toIso, toLocalInput } from './datetime';

interface WizardTicketItem {
  tempId: string;
  name: string;
  kind: 'PAID' | 'FREE' | 'COMP';
  price: number;
  quota: number;
  zoneIds: string[];
  refundPolicy: 'ONLY_IF_CANCELLED' | 'REFUNDABLE_BEFORE_DEADLINE' | 'NO_REFUNDS';
}

function getDefaultDates(timeZone = 'Asia/Ho_Chi_Minh') {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(22, 0, 0, 0);

  const doorsOpen = new Date(tomorrow);
  doorsOpen.setHours(18, 0, 0, 0);

  const now = new Date();

  const salesEnd = new Date(tomorrow);
  salesEnd.setHours(18, 0, 0, 0);

  return {
    startsAt: toLocalInput(tomorrow.toISOString(), timeZone),
    endsAt: toLocalInput(tomorrowEnd.toISOString(), timeZone),
    doorsOpenAt: toLocalInput(doorsOpen.toISOString(), timeZone),
    salesStartAt: toLocalInput(now.toISOString(), timeZone),
    salesEndAt: toLocalInput(salesEnd.toISOString(), timeZone),
  };
}

export function EventCreationWizard({
  onComplete,
  onCancel,
}: {
  onComplete: (eventId: string) => void;
  onCancel: () => void;
}) {
  const orgId = useOrgId();
  const { showToast } = useToast();
  const categories = useCategories();
  const venues = useOrgVenues(orgId);

  const saveEvent = useSaveEvent(orgId);
  const saveSession = useSaveSession(orgId);
  const submitEvent = useSubmitEvent(orgId);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  // --- Step 1: Basic Info ---
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [ageLimit, setAgeLimit] = useState('');
  const [terms, setTerms] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- Step 2: Date & Venue ---
  const [venueId, setVenueId] = useState('');
  const chosenVenueId = venueId || venues.data?.[0]?.id || '';
  const venueDetail = useVenue(chosenVenueId);
  const venueTimezone =
    venueDetail.data?.timezone || venues.data?.find((v) => v.id === chosenVenueId)?.timezone || 'Asia/Ho_Chi_Minh';

  const publishedVersions = useMemo(
    () =>
      (venueDetail.data?.layouts ?? []).flatMap((layout) =>
        layout.versions
          .filter((v) => v.status === 'PUBLISHED')
          .map((v) => ({ ...v, layoutName: layout.name })),
      ),
    [venueDetail.data],
  );

  const [layoutVersionId, setLayoutVersionId] = useState('');
  const chosenLayoutVersionId = layoutVersionId || publishedVersions[0]?.id || '';

  const defaultDates = useMemo(() => getDefaultDates(), []);
  const [sessionTitle, setSessionTitle] = useState('Đêm diễn chính');
  const [startsAt, setStartsAt] = useState(defaultDates.startsAt);
  const [endsAt, setEndsAt] = useState(defaultDates.endsAt);
  const [doorsOpenAt, setDoorsOpenAt] = useState(defaultDates.doorsOpenAt);
  const [salesStartAt, setSalesStartAt] = useState(defaultDates.salesStartAt);
  const [salesEndAt, setSalesEndAt] = useState(defaultDates.salesEndAt);
  const [maxTicketsPerAccount, setMaxTicketsPerAccount] = useState('10');

  // --- Step 3: Tickets & Pricing ---
  const zonesQuery = useLayoutZones(chosenLayoutVersionId);
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);

  const [tickets, setTickets] = useState<WizardTicketItem[]>([
    {
      tempId: 't1',
      name: 'Vé VIP',
      kind: 'PAID',
      price: 500000,
      quota: 50,
      zoneIds: [],
      refundPolicy: 'ONLY_IF_CANCELLED',
    },
    {
      tempId: 't2',
      name: 'Vé Tiêu Chuẩn',
      kind: 'PAID',
      price: 250000,
      quota: 200,
      zoneIds: [],
      refundPolicy: 'ONLY_IF_CANCELLED',
    },
  ]);



  const saveTicketType = useSaveTicketType(createdSessionId);

  const effectiveSlug = slug || slugify(title);

  // --- Actions ---
  const handleUploadCover = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await api.upload(file, 'EVENT_ASSET', orgId);
      setCover(publicUrl);
      showToast('Đã tải ảnh poster lên thành công.', 'success');
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleNextFromStep1 = async () => {
    if (title.trim().length < 3) {
      showToast('Tên sự kiện cần ít nhất 3 ký tự.', 'warning');
      return;
    }
    if (!/^[a-z0-9-]{3,120}$/.test(effectiveSlug)) {
      showToast('Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (3–120 ký tự).', 'warning');
      return;
    }

    try {
      const res = await saveEvent.mutateAsync({
        id: createdEventId ?? undefined,
        title: title.trim(),
        slug: effectiveSlug,
        summary: summary.trim() || null,
        description: description.trim() || null,
        categoryId: categoryId || null,
        coverImageUrl: cover,
        ageLimit: ageLimit === '' ? null : Number(ageLimit),
        terms: terms.trim() || null,
      });
      setCreatedEventId(res.id);
      showToast('Đã lưu thông tin cơ bản sự kiện.', 'success');
      setStep(2);
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    }
  };

  const handleNextFromStep2 = async () => {
    if (!createdEventId) {
      showToast('Chưa có thông tin sự kiện. Vui lòng quay lại bước 1.', 'warning');
      setStep(1);
      return;
    }
    if (!chosenVenueId || !chosenLayoutVersionId) {
      showToast('Chọn địa điểm và một sơ đồ khu vực đã phát hành.', 'warning');
      return;
    }
    if (!startsAt || !endsAt || !salesStartAt || !salesEndAt) {
      showToast('Nhập đầy đủ giờ diễn và khung giờ mở bán.', 'warning');
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

    try {
      const res = await saveSession.mutateAsync({
        id: createdSessionId ?? undefined,
        eventId: createdEventId,
        venueId: chosenVenueId,
        layoutVersionId: chosenLayoutVersionId,
        title: sessionTitle.trim() || 'Đêm diễn chính',
        startsAt: toIso(startsAt, venueTimezone),
        endsAt: toIso(endsAt, venueTimezone),
        doorsOpenAt: toIso(doorsOpenAt, venueTimezone),
        salesStartAt: toIso(salesStartAt, venueTimezone),
        salesEndAt: toIso(salesEndAt, venueTimezone),
        maxTicketsPerAccount: Number(maxTicketsPerAccount) || 10,
      });
      setCreatedSessionId(res.id);
      showToast('Đã lưu lịch diễn & địa điểm tổ chức.', 'success');
      setStep(3);
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    }
  };

  const handleNextFromStep3 = async () => {
    if (!createdSessionId) {
      showToast('Chưa có thông tin suất diễn. Vui lòng quay lại bước 2.', 'warning');
      setStep(2);
      return;
    }
    if (tickets.length === 0) {
      showToast('Cần ít nhất một hạng vé để mở bán.', 'warning');
      return;
    }
    for (const t of tickets) {
      if (!t.name.trim()) {
        showToast('Vui lòng nhập tên cho tất cả các hạng vé.', 'warning');
        return;
      }
      if (t.kind === 'PAID' && t.price <= 0) {
        showToast(`Hạng vé "${t.name}" có phí phải có giá lớn hơn 0.`, 'warning');
        return;
      }
      if (t.quota <= 0) {
        showToast(`Hạng vé "${t.name}" cần có số lượng lớn hơn 0.`, 'warning');
        return;
      }
      const effectiveZones = t.zoneIds.length > 0 ? t.zoneIds : (zones[0]?.id ? [zones[0].id] : []);
      if (effectiveZones.length === 0) {
        showToast(`Hạng vé "${t.name}" cần chọn ít nhất một khu vực áp dụng.`, 'warning');
        return;
      }
    }

    // Persist ticket types
    try {
      for (const t of tickets) {
        const effectiveZones = t.zoneIds.length > 0 ? t.zoneIds : (zones[0]?.id ? [zones[0].id] : []);
        await saveTicketType.mutateAsync({
          sessionId: createdSessionId,
          name: t.name.trim(),
          kind: t.kind,
          priceAmount: t.kind === 'PAID' ? t.price : 0,
          quota: t.quota,
          zoneIds: effectiveZones,
          refundPolicy: t.refundPolicy,
          visibility: 'PUBLIC',
          status: 'ACTIVE',
        });
      }
      showToast('Đã lưu danh sách hạng vé thành công.', 'success');
      setStep(4);
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    }
  };

  const handleFinishDraft = () => {
    if (!createdEventId) return;
    showToast('Sự kiện đã được lưu dưới dạng Bản nháp!', 'success');
    onComplete(createdEventId);
  };

  const handleSubmitForReview = async () => {
    if (!createdEventId) return;
    try {
      await submitEvent.mutateAsync(createdEventId);
      showToast('Đã gửi sự kiện lên Admin duyệt thành công!', 'success');
      onComplete(createdEventId);
    } catch (error) {
      showToast(errorMessage(error), 'danger');
    }
  };

  // Ticket helper mutators
  const addTicket = (preset?: 'VIP' | 'STANDARD' | 'FREE') => {
    const defaultZone = zones[0]?.id ? [zones[0].id] : [];
    if (preset === 'VIP') {
      setTickets((prev) => [
        ...prev,
        {
          tempId: `t-${Date.now()}`,
          name: 'Vé VIP Lounge',
          kind: 'PAID',
          price: 750000,
          quota: 30,
          zoneIds: defaultZone,
          refundPolicy: 'ONLY_IF_CANCELLED',
        },
      ]);
    } else if (preset === 'FREE') {
      setTickets((prev) => [
        ...prev,
        {
          tempId: `t-${Date.now()}`,
          name: 'Vé Miễn Phí (Đăng ký)',
          kind: 'FREE',
          price: 0,
          quota: 100,
          zoneIds: defaultZone,
          refundPolicy: 'ONLY_IF_CANCELLED',
        },
      ]);
    } else {
      setTickets((prev) => [
        ...prev,
        {
          tempId: `t-${Date.now()}`,
          name: `Hạng vé ${prev.length + 1}`,
          kind: 'PAID',
          price: 150000,
          quota: 100,
          zoneIds: defaultZone,
          refundPolicy: 'ONLY_IF_CANCELLED',
        },
      ]);
    }
  };

  const removeTicket = (idx: number) => {
    if (tickets.length <= 1) {
      showToast('Sự kiện phải có ít nhất 1 hạng vé.', 'warning');
      return;
    }
    setTickets((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTicket = (idx: number, patch: Partial<WizardTicketItem>) => {
    setTickets((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  // Metrics for summary
  const totalCapacity = useMemo(() => tickets.reduce((s, t) => s + (t.quota || 0), 0), [tickets]);
  const estimatedRevenue = useMemo(
    () => tickets.reduce((s, t) => s + (t.kind === 'PAID' ? t.price * (t.quota || 0) : 0), 0),
    [tickets],
  );

  const selectedVenue = venues.data?.find((v) => v.id === chosenVenueId);
  const selectedLayout = publishedVersions.find((v) => v.id === chosenLayoutVersionId);
  const selectedCategory = categories.data?.find((c) => c.id === categoryId);

  return (
    <div>
      {/* Wizard Header / Progress Indicator */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          marginBottom: 20,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#93C5FD', letterSpacing: '0.08em' }}>
              QUY TRÌNH TẠO SỰ KIỆN MỚI
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {step === 1 && 'Bước 1: Thông tin cơ bản & Poster'}
              {step === 2 && 'Bước 2: Thời gian & Địa điểm tổ chức'}
              {step === 3 && 'Bước 3: Hạng vé & Bảng giá'}
              {step === 4 && 'Bước 4: Xem trước & Công bố sự kiện'}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            style={{ color: '#E2E8F0', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Hủy & Về danh sách
          </button>
        </div>

        {/* Stepper Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { n: 1, label: 'Thông tin cơ bản', icon: FileText },
            { n: 2, label: 'Thời gian & Địa điểm', icon: Calendar },
            { n: 3, label: 'Hạng vé & Giá', icon: Ticket },
            { n: 4, label: 'Xem trước & Gửi', icon: Sparkles },
          ].map((st) => {
            const active = step === st.n;
            const done = step > st.n;
            const StepIcon = st.icon;
            return (
              <div
                key={st.n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: active
                    ? 'rgba(59, 130, 246, 0.35)'
                    : done
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(255, 255, 255, 0.06)',
                  border: active
                    ? '1.5px solid #60A5FA'
                    : done
                      ? '1px solid #4ADE80'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: done ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  if (done) setStep(st.n as 1 | 2 | 3 | 4);
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? '#3B82F6' : done ? '#22C55E' : 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {done ? <CheckCircle2 size={16} /> : <StepIcon size={14} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: active ? '#93C5FD' : done ? '#86EFAC' : '#94A3B8' }}>
                    Bước {st.n}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {st.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: BASIC INFO */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
              Thông tin tổng quan
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Tên sự kiện <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Đại nhạc hội Mùa Hè 2026, Triển lãm Công nghệ..."
                style={{ fontSize: 14 }}
              />
            </div>

            <div>
              <label className="form-label">
                Đường dẫn thân thiện (slug) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>tickey.vn/events/</span>
                <input
                  className="form-input"
                  value={effectiveSlug}
                  onChange={(e) => setSlug(slugify(e.target.value) || e.target.value.toLowerCase())}
                  placeholder="dai-nhac-hoi-mua-he"
                />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                Tự động tạo từ tên sự kiện. Dùng cho đường dẫn chia sẻ tới khán giả.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label">Danh mục sự kiện</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Giới hạn độ tuổi</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  value={ageLimit}
                  onChange={(e) => setAgeLimit(e.target.value)}
                  placeholder="Để trống nếu không giới hạn (ví dụ: 16, 18)"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Tóm tắt ngắn (1-2 câu)</label>
              <textarea
                className="form-input"
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Mô tả súc tích xuất hiện trên thẻ xem trước và danh sách tìm kiếm..."
              />
            </div>

            <div>
              <label className="form-label">Mô tả chi tiết sự kiện</label>
              <textarea
                className="form-input"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Giới thiệu nghệ sĩ biểu diễn, lịch trình chi tiết, thông điệp sự kiện..."
              />
            </div>

            <div>
              <label className="form-label">Điều khoản & Lưu ý tham gia</label>
              <textarea
                className="form-input"
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Quy định mang đồ uống, máy quay phim, quy định hoàn đổi vé..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextFromStep1}
                disabled={saveEvent.isPending || uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
              >
                {saveEvent.isPending ? 'Đang lưu...' : 'Tiếp tục sang Thời gian & Địa điểm'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Right Column: Live Poster Card */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
              XEM TRƯỚC POSTER & THẺ SỰ KIỆN
            </div>
            <FigmaEventPreviewCard
              title={title.trim() || 'Tên sự kiện của bạn'}
              subtitle={selectedCategory?.name ?? 'Sự kiện âm nhạc · Nghệ thuật'}
              badge="Bản nháp"
              image={cover}
              onImageChange={(url) => setCover(url || null)}
              onFile={handleUploadCover}
              uploading={uploading}
            />
            <div
              className="card"
              style={{
                padding: 14,
                marginTop: 14,
                background: '#F8FAFC',
                border: '1px dashed var(--border)',
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.5,
              }}
            >
              <Info size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--primary)' }} />
              Poster kích thước khuyến nghị là 16:9 hoặc 4:3 (tối thiểu 1200x675px) để hiển thị sắc nét nhất trên cả ứng dụng di động và website.
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: SCHEDULE & VENUE */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
              Địa điểm & Lịch trình biểu diễn
            </div>

            {/* Venue & Layout Selection */}
            <div
              style={{
                padding: 16,
                background: 'var(--surface-muted, #F8FAFC)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={16} color="var(--primary)" />
                Địa điểm tổ chức & Sơ đồ mặt bằng
              </div>

              {venues.data && venues.data.length === 0 ? (
                <FigmaInfoAlert tone="warning">
                  Bạn chưa có địa điểm tổ chức nào. Vui lòng vào mục "Địa điểm" để tạo địa điểm và xuất bản ít nhất một sơ đồ mặt bằng trước.
                </FigmaInfoAlert>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Chọn địa điểm
                    </label>
                    <select
                      className="form-select"
                      value={chosenVenueId}
                      onChange={(e) => {
                        setVenueId(e.target.value);
                        setLayoutVersionId('');
                      }}
                    >
                      {(venues.data ?? []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.timezone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Sơ đồ mặt bằng đã phát hành
                    </label>
                    <select
                      className="form-select"
                      value={chosenLayoutVersionId}
                      onChange={(e) => setLayoutVersionId(e.target.value)}
                    >
                      {publishedVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.layoutName} · Bản v{v.versionNo}
                          {v.totalCapacity ? ` (${v.totalCapacity} chỗ)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {venueDetail.data && (
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  📍 Địa chỉ: {venueDetail.data.addressLine}, {venueDetail.data.city} · Múi giờ: {venueDetail.data.timezone}
                </div>
              )}
            </div>

            {/* Session title & timings */}
            <div>
              <label className="form-label">Tên suất diễn</label>
              <input
                className="form-input"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Ví dụ: Đêm diễn chính, Buổi chiều (14h), Buổi tối (20h)..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Giờ bắt đầu sự kiện <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span> <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Giờ kết thúc sự kiện <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span> <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label">Giờ mở cửa đón khách (Doors Open) <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span></label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={doorsOpenAt}
                  onChange={(e) => setDoorsOpenAt(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  Khán giả được check-in qua cổng soát vé từ thời điểm này.
                </div>
              </div>
              <div>
                <label className="form-label">Số vé tối đa mỗi tài khoản</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-input"
                  value={maxTicketsPerAccount}
                  onChange={(e) => setMaxTicketsPerAccount(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  Hạn chế đầu cơ / ôm vé. Mặc định 10 vé / tài khoản.
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                background: '#EFF6FF',
                borderRadius: 12,
                border: '1px solid #BFDBFE',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1E40AF' }}>
                Thời gian mở và đóng bán vé trực tuyến
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ color: '#1E40AF' }}>
                    Bắt đầu bán vé <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span> <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={salesStartAt}
                    onChange={(e) => setSalesStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ color: '#1E40AF' }}>
                    Ngừng bán vé <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({venueTimezone})</span> <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={salesEndAt}
                    onChange={(e) => setSalesEndAt(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={16} /> Quay lại Bước 1
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextFromStep2}
                disabled={saveSession.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
              >
                {saveSession.isPending ? 'Đang lưu...' : 'Tiếp tục sang Hạng vé & Bảng giá'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Right Column: Live Summary */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div className="card" style={{ padding: 18, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Tổng quan sự kiện</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Tên: </span>
                  <strong>{title || 'Chưa đặt tên'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Địa điểm: </span>
                  <strong>{selectedVenue?.name ?? 'Chưa chọn'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Sơ đồ: </span>
                  <strong>{selectedLayout?.layoutName ?? 'Chưa chọn'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Suất diễn: </span>
                  <span>{sessionTitle || 'Chính'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: TICKETS & PRICING */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Quick Actions Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                Thiết lập các hạng vé
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                Cấu hình giá bán, số lượng phát hành và khu vực chỗ ngồi cho từng loại vé.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => addTicket('FREE')}
                style={{ fontSize: 12.5 }}
              >
                + Vé Miễn Phí
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => addTicket('VIP')}
                style={{ fontSize: 12.5 }}
              >
                + Vé VIP
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addTicket()}
                style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={15} /> Thêm hạng vé
              </button>
            </div>
          </div>

          {/* Ticket Items Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>TÊN HẠNG VÉ</th>
                    <th>LOẠI VÉ</th>
                    <th>GIÁ BÁN (VND)</th>
                    <th>SỐ LƯỢNG (QUOTA)</th>
                    <th>KHU VỰC ÁP DỤNG</th>
                    <th>CHÍNH SÁCH HOÀN TIỀN</th>
                    <th style={{ width: 60, textAlign: 'center' }}>XÓA</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, idx) => (
                    <tr key={t.tempId}>
                      <td style={{ fontWeight: 700, color: 'var(--muted)' }}>{idx + 1}</td>
                      <td>
                        <input
                          className="form-input"
                          value={t.name}
                          onChange={(e) => updateTicket(idx, { name: e.target.value })}
                          placeholder="Ví dụ: Vé VIP, Vé Thường..."
                          style={{ minWidth: 140 }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={t.kind}
                          onChange={(e) => {
                            const kind = e.target.value as WizardTicketItem['kind'];
                            updateTicket(idx, {
                              kind,
                              price: kind === 'FREE' ? 0 : t.price || 100000,
                            });
                          }}
                          style={{ minWidth: 110 }}
                        >
                          <option value="PAID">Có phí</option>
                          <option value="FREE">Miễn phí</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="10000"
                          disabled={t.kind === 'FREE'}
                          className="form-input"
                          value={t.kind === 'FREE' ? 0 : t.price}
                          onChange={(e) => updateTicket(idx, { price: Number(e.target.value) })}
                          style={{ minWidth: 120, textAlign: 'right', fontWeight: 700 }}
                        />
                        {t.kind === 'PAID' && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>
                            {formatVnd(t.price)}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={t.quota}
                          onChange={(e) => updateTicket(idx, { quota: Number(e.target.value) })}
                          style={{ minWidth: 90, textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        {zones.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Đang tải khu vực...</span>
                        ) : (
                          <select
                            className="form-select"
                            value={t.zoneIds[0] ?? zones[0]?.id ?? ''}
                            onChange={(e) => updateTicket(idx, { zoneIds: [e.target.value] })}
                            style={{ minWidth: 140 }}
                          >
                            {zones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name} ({z.kind === 'SEATED' ? 'Có ghế' : 'Đứng'})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={t.refundPolicy}
                          onChange={(e) =>
                            updateTicket(idx, {
                              refundPolicy: e.target.value as WizardTicketItem['refundPolicy'],
                            })
                          }
                          style={{ minWidth: 150 }}
                        >
                          <option value="ONLY_IF_CANCELLED">Chỉ hoàn khi hủy sự kiện</option>
                          <option value="REFUNDABLE_BEFORE_DEADLINE">Hoàn trước hạn 48h</option>
                          <option value="NO_REFUNDS">Không hoàn tiền</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeTicket(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                          title="Xóa hạng vé này"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>TỔNG SỐ HẠNG VÉ</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {tickets.length}
              </div>
            </div>
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>TỔNG SỨC CHỨA / VÉ PHÁT HÀNH</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {totalCapacity.toLocaleString('vi-VN')} vé
              </div>
            </div>
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>DOANH THU TỐI ĐA DỰ KIẾN</div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 4,
                  color: 'var(--primary)',
                }}
              >
                {formatVnd(estimatedRevenue)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStep(2)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={16} /> Quay lại Bước 2
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNextFromStep3}
              disabled={saveTicketType.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
            >
              {saveTicketType.isPending ? 'Đang lưu hạng vé...' : 'Tiếp tục sang Xem trước & Công bố'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & PUBLISH */}
      {step === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Live Event Card */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
              GIAO DIỆN HIỂN THỊ TRÊN KHÁCH HÀNG (PREVIEW)
            </div>
            <FigmaEventPreviewCard
              title={title}
              subtitle={selectedCategory?.name ?? 'Sự kiện âm nhạc'}
              badge="Sẵn sàng gửi duyệt"
              image={cover}
            />

            <div className="card" style={{ padding: 18, marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Thông tin chi tiết</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Khung giờ diễn: </span>
                  <strong>{startsAt}</strong> đến <strong>{endsAt}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Địa điểm: </span>
                  <strong>{venueDetail.data?.name ?? selectedVenue?.name}</strong>{' '}
                  {venueDetail.data?.addressLine ? `(${venueDetail.data.addressLine}, ${venueDetail.data.city})` : ''}
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Giới hạn vé/tài khoản: </span>
                  <strong>{maxTicketsPerAccount} vé</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Độ tuổi tham gia: </span>
                  <strong>{ageLimit ? `${ageLimit}+ tuổi` : 'Không giới hạn'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Readiness Checklist & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                Kiểm tra tính sẵn sàng (Readiness Checklist)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  {
                    pass: title.trim().length >= 3,
                    title: 'Tên sự kiện hợp lệ',
                    desc: title,
                  },
                  {
                    pass: !!chosenVenueId && !!chosenLayoutVersionId,
                    title: 'Địa điểm & Sơ đồ mặt bằng',
                    desc: `${selectedVenue?.name} · ${selectedLayout?.layoutName ?? 'Sơ đồ mặc định'}`,
                  },
                  {
                    pass: !!startsAt && !!endsAt && endsAt > startsAt,
                    title: 'Khung giờ diễn hợp lệ',
                    desc: `${startsAt} → ${endsAt}`,
                  },
                  {
                    pass: tickets.length > 0 && totalCapacity > 0,
                    title: `Đã thiết lập ${tickets.length} hạng vé`,
                    desc: `Tổng sức chứa: ${totalCapacity.toLocaleString('vi-VN')} vé · Doanh thu dự kiến: ${formatVnd(estimatedRevenue)}`,
                  },
                  {
                    pass: !!cover,
                    title: cover ? 'Đã có ảnh poster bìa' : 'Chưa có ảnh bìa (khuyến nghị tải lên)',
                    desc: cover ? 'Đã tải lên hệ thống' : 'Sự kiện có poster sẽ thu hút nhiều người xem hơn',
                    warnOnly: !cover,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: item.pass
                        ? '#F0FDF4'
                        : item.warnOnly
                          ? '#FFFBEB'
                          : '#FEF2F2',
                      border: `1px solid ${
                        item.pass
                          ? '#BBF7D0'
                          : item.warnOnly
                            ? '#FDE68A'
                            : '#FECACA'
                      }`,
                    }}
                  >
                    {item.pass ? (
                      <CheckCircle2 size={18} color="#16A34A" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <AlertCircle
                        size={18}
                        color={item.warnOnly ? '#D97706' : '#DC2626'}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      />
                    )}
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: item.pass ? '#166534' : item.warnOnly ? '#92400E' : '#991B1B',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Actions Card */}
            <div
              className="card"
              style={{
                padding: 22,
                background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
                border: '1.5px solid #BFDBFE',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                Chọn hành động công bố
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Bạn có thể lưu sự kiện để chỉnh sửa thêm (hoặc cấu hình giữ chỗ, xếp ghế nâng cao) hoặc gửi trực tiếp cho Admin nền tảng xét duyệt công bố.
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitForReview}
                  disabled={submitEvent.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '11px 22px',
                    fontWeight: 700,
                  }}
                >
                  <Send size={16} />
                  {submitEvent.isPending ? 'Đang gửi duyệt...' : 'Gửi xét duyệt ngay'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleFinishDraft}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '11px 20px',
                    fontWeight: 700,
                    background: '#FFFFFF',
                  }}
                >
                  <Eye size={16} /> Lưu bản nháp & Quản lý nâng cao
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(3)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={16} /> Quay lại cấu hình hạng vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
