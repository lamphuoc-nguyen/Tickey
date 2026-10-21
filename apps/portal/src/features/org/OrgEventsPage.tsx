import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, CheckCircle2, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useMockStore, type EventItem } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaHeroBanner,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaDocumentRow,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  FigmaEventPreviewCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const EVENT_SCREENS: FigmaScreenOption[] = [
  { id: 'o-events', label: 'Danh sách sự kiện' },
  { id: 'o-event-edit', label: 'Thông tin sự kiện' },
  { id: 'o-event-detail', label: 'Chi tiết sự kiện · Đêm nhạc Mùa Thu' },
  { id: 'o-session-edit', label: 'Cấu hình suất diễn' },
  { id: 'o-session-detail', label: 'Suất diễn · Đêm 1 (24/10)' },
  { id: 'o-session-2', label: 'Suất diễn · Đêm 2 (25/10)' },
  { id: 'o-session-paused', label: 'Suất diễn đang tạm dừng bán' },
  { id: 'o-ticket-types', label: 'Hạng vé & quota theo ghế' },
  { id: 'o-ticket-edit', label: 'Chỉnh sửa hạng vé · Standard' },
  { id: 'o-ticket-vip', label: 'Chỉnh sửa hạng vé · VIP' },
  { id: 'o-ticket-comp', label: 'Chỉnh sửa hạng vé · COMP' },
  { id: 'o-ticket-free', label: 'Chỉnh sửa hạng vé · Vé 0đ' },
  { id: 'o-audience-pricing', label: 'Giá vé theo đối tượng' },
  { id: 'o-promotions', label: 'Khuyến mãi sự kiện' },
  { id: 'o-seat-pricing', label: 'Gán hạng vé theo hàng ghế' },
  { id: 'o-seat-pricing-vip', label: 'Gán hạng VIP · Hàng C–D' },
  { id: 'o-seat-rows-applied', label: 'Đã áp dụng hạng vé cho hàng ghế' },
  { id: 'o-seat-status', label: 'Trạng thái ghế theo suất diễn' },
  { id: 'o-seat-block-confirm', label: 'Xác nhận giữ / chặn ghế' },
  { id: 'o-seat-release-confirm', label: 'Xác nhận giải phóng ghế' },
  { id: 'o-review-submit', label: 'Gửi xét duyệt sự kiện' },
  { id: 'o-event-pending', label: 'Sự kiện đang chờ duyệt' },
  { id: 'o-cancel', label: 'Yêu cầu hủy sự kiện' },
  { id: 'o-cancel-pending', label: 'Đã gửi yêu cầu hủy sự kiện' },
];

const SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEAT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function parseSessTime(str: string) {
  let date = '';
  let start = '20:00';
  let end = '23:00';
  if (!str) return { date: '', start, end };

  const dMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dMatch) {
    const day = dMatch[1].padStart(2, '0');
    const month = dMatch[2].padStart(2, '0');
    const year = dMatch[3];
    date = `${year}-${month}-${day}`;
  } else {
    const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) date = isoMatch[0];
  }

  const times = str.match(/(\d{1,2}:\d{2})/g);
  if (times && times.length >= 2) {
    start = times[0];
    end = times[1];
  } else if (times && times.length === 1) {
    start = times[0];
  }

  return { date, start, end };
}

function formatSessTime(dateStr: string, startTime: string, endTime: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts;
  const formattedDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  const s = startTime || '20:00';
  const e = endTime || '23:00';
  return `${formattedDate} · ${s} – ${e}`;
}

function parseSaleWindow(str: string) {
  let start = '';
  let end = '';
  if (!str) return { start: '', end: '' };

  const matches = [...str.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})/g)];
  if (matches.length >= 2) {
    const [, d1, m1, y1, t1] = matches[0];
    start = `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}T${t1}`;
    const [, d2, m2, y2, t2] = matches[1];
    end = `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}T${t2}`;
  } else if (matches.length === 1) {
    const [, d1, m1, y1, t1] = matches[0];
    start = `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}T${t1}`;
  } else {
    const isoMatches = [...str.matchAll(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/g)];
    if (isoMatches.length >= 2) {
      start = isoMatches[0][0];
      end = isoMatches[1][0];
    }
  }
  return { start, end };
}

function formatSaleWindow(startIso: string, endIso: string): string {
  if (!startIso && !endIso) return '';
  const fmt = (iso: string) => {
    if (!iso) return '';
    const [datePart, timePart] = iso.split('T');
    if (!datePart) return iso;
    const parts = datePart.split('-');
    if (parts.length < 3) return iso;
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y} ${timePart || '00:00'}`;
  };
  if (startIso && endIso) return `${fmt(startIso)} → ${fmt(endIso)}`;
  if (startIso) return `Từ ${fmt(startIso)}`;
  return `Đến ${fmt(endIso)}`;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateTimeInputValue(d: Date): string {
  const dateStr = toDateInputValue(d);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr}T${h}:${min}`;
}

export function OrgEventsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    state,
    createEvent,
    updateEvent,
    updateTicketTier,
    applySeatRowTier,
    updateSeatStatus,
    submitEventForReview,
    requestEventCancellation,
  } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-events';
  const eventIdParam = searchParams.get('eventId');
  const createNewParam = searchParams.get('createNew');

  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdParam || 'ev-1');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(createNewParam === 'true');

  const setScreen = (screen: string) => {
    const params: Record<string, string> = { screen };
    if (selectedEventId) params.eventId = selectedEventId;
    if (isCreatingNew) params.createNew = 'true';
    setSearchParams(params);
  };

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const eventsList = state?.events || [];
  const currentEvent = eventsList.find((e) => e.id === selectedEventId) || (isCreatingNew ? null : eventsList[0]);

  const verifiedVenues = (state?.venues || []).filter((v) => v.status === 'VERIFIED');
  const availableLayouts = state?.layouts || [];

  // Event form state
  const [evName, setEvName] = useState(
    isCreatingNew ? '' : currentEvent?.name || 'Đêm nhạc Mùa Thu',
  );
  const [evVenue, setEvVenue] = useState(
    currentEvent?.venueName || 'Nhà hát Ánh Trăng (Đã xác minh)',
  );
  const [evLayout, setEvLayout] = useState(
    currentEvent?.layoutName || 'Sơ đồ nhà hát v4 · 80 ghế',
  );
  const [evCategory, setEvCategory] = useState(
    currentEvent?.category || 'Âm nhạc · Biểu diễn nghệ thuật',
  );
  const [evPoster, setEvPoster] = useState<string | null>(
    isCreatingNew
      ? null
      : currentEvent?.poster ||
        (currentEvent?.name === 'Đêm nhạc Mùa Thu'
          ? '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg'
          : null),
  );

  // Session form state
  const [sessName, setSessName] = useState(
    isCreatingNew ? 'Suất 1 · Khai mạc' : currentEvent?.sessions?.[0]?.name || 'Đêm 1 · Khai màn',
  );
  const [sessTime, setSessTime] = useState(
    isCreatingNew ? '' : currentEvent?.sessions?.[0]?.time || '24/10/2026 · 20:00 – 22:30',
  );
  const [sessSaleWindow, setSessSaleWindow] = useState(
    isCreatingNew ? '' : currentEvent?.sessions?.[0]?.saleWindow || '01/10/2026 09:00 → 24/10/2026 19:30',
  );
  const [sessGates, setSessGates] = useState(
    currentEvent?.sessions?.[0]?.gates || 'Cổng chính G1, Cổng VIP G2',
  );

  const initParsedTime = parseSessTime(isCreatingNew ? '' : currentEvent?.sessions?.[0]?.time || '24/10/2026 · 20:00 – 22:30');
  const [sessDate, setSessDate] = useState(initParsedTime.date);
  const [sessStartTime, setSessStartTime] = useState(initParsedTime.start);
  const [sessEndTime, setSessEndTime] = useState(initParsedTime.end);

  const initParsedSale = parseSaleWindow(isCreatingNew ? '' : currentEvent?.sessions?.[0]?.saleWindow || '01/10/2026 09:00 → 24/10/2026 19:30');
  const [sessSaleStart, setSessSaleStart] = useState(initParsedSale.start);
  const [sessSaleEnd, setSessSaleEnd] = useState(initParsedSale.end);

  const handleDateChange = (newDate: string) => {
    setSessDate(newDate);
    const formatted = formatSessTime(newDate, sessStartTime, sessEndTime);
    setSessTime(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: formatted,
          saleWindow: sessSaleWindow,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
  };

  const handleStartTimeChange = (newStart: string) => {
    setSessStartTime(newStart);
    const formatted = formatSessTime(sessDate, newStart, sessEndTime);
    setSessTime(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: formatted,
          saleWindow: sessSaleWindow,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
  };

  const handleEndTimeChange = (newEnd: string) => {
    setSessEndTime(newEnd);
    const formatted = formatSessTime(sessDate, sessStartTime, newEnd);
    setSessTime(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: formatted,
          saleWindow: sessSaleWindow,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
  };

  const handleSaleStartChange = (newStart: string) => {
    setSessSaleStart(newStart);
    const formatted = formatSaleWindow(newStart, sessSaleEnd);
    setSessSaleWindow(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: sessTime,
          saleWindow: formatted,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
  };

  const handleSaleEndChange = (newEnd: string) => {
    setSessSaleEnd(newEnd);
    const formatted = formatSaleWindow(sessSaleStart, newEnd);
    setSessSaleWindow(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: sessTime,
          saleWindow: formatted,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
  };

  const applyPresetSession = (type: 'tonight' | 'weekend' | 'nextMonth') => {
    const d = new Date();
    let start = '20:00';
    let end = '23:00';
    if (type === 'tonight') {
      start = '20:00';
      end = '23:00';
    } else if (type === 'weekend') {
      const dayOfWeek = d.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilSaturday);
      start = '19:30';
      end = '22:30';
    } else if (type === 'nextMonth') {
      d.setDate(d.getDate() + 30);
      start = '20:00';
      end = '23:00';
    }
    const dStr = toDateInputValue(d);
    setSessDate(dStr);
    setSessStartTime(start);
    setSessEndTime(end);
    const formatted = formatSessTime(dStr, start, end);
    setSessTime(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: formatted,
          saleWindow: sessSaleWindow,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
    showToast(`Đã chọn thời gian: ${formatted}`, 'success');
  };

  const applyPresetSale = (type: 'now' | 'twoWeeksBefore' | 'closeAtShow') => {
    const now = new Date();
    let startIso = toDateTimeInputValue(now);
    let endIso = '';

    if (sessDate) {
      if (type === 'now') {
        startIso = toDateTimeInputValue(now);
        endIso = `${sessDate}T${sessStartTime || '20:00'}`;
      } else if (type === 'twoWeeksBefore') {
        const evD = new Date(sessDate);
        evD.setDate(evD.getDate() - 15);
        evD.setHours(9, 0, 0, 0);
        startIso = toDateTimeInputValue(evD);
        endIso = `${sessDate}T${sessStartTime || '20:00'}`;
      } else if (type === 'closeAtShow') {
        startIso = sessSaleStart || toDateTimeInputValue(now);
        const [h, m] = (sessStartTime || '20:00').split(':').map(Number);
        const closeH = Math.max(0, h - 2);
        endIso = `${sessDate}T${String(closeH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      }
    } else {
      const endD = new Date(now);
      endD.setDate(endD.getDate() + 14);
      endIso = toDateTimeInputValue(endD);
    }

    setSessSaleStart(startIso);
    setSessSaleEnd(endIso);
    const formatted = formatSaleWindow(startIso, endIso);
    setSessSaleWindow(formatted);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: sessTime,
          saleWindow: formatted,
          gates: sessGates,
          status: 'ACTIVE',
        },
      ],
    });
    showToast(`Đã chọn khung giờ bán vé: ${formatted}`, 'success');
  };

  const handleToggleGate = (gateName: string) => {
    const currentList = sessGates
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    let nextList: string[];
    if (currentList.some((g) => g.toLowerCase() === gateName.toLowerCase())) {
      nextList = currentList.filter((g) => g.toLowerCase() !== gateName.toLowerCase());
    } else {
      nextList = [...currentList, gateName];
    }
    const nextStr = nextList.join(', ');
    setSessGates(nextStr);
    syncCurrentEvent({
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: sessName,
          time: sessTime,
          saleWindow: sessSaleWindow,
          gates: nextStr,
          status: 'ACTIVE',
        },
      ],
    });
  };

  // Ticket tier form state
  const [stdPrice, setStdPrice] = useState('500.000đ');
  const [vipPrice, setVipPrice] = useState('900.000đ');
  const [compNote, setCompNote] = useState('Vé mời đối tác & nghệ sĩ · Không thu tiền');
  const [freeLimit, setFreeLimit] = useState('Tối đa 2 vé / tài khoản');

  // Seat row pricing state
  const [selectedStandardRows, setSelectedStandardRows] = useState<string[]>(['A', 'B', 'E', 'F']);
  const [selectedVipRows, setSelectedVipRows] = useState<string[]>(['C', 'D']);

  // Seat status state
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['A02', 'A03']);
  const [seatAction, setSeatAction] = useState('Giữ nội bộ (Hold)');
  const [seatReason, setSeatReason] = useState('Khách mời nhà tài trợ');

  // Cancel event state
  const [cancelReason, setCancelReason] = useState(
    'Nghệ sĩ chính gặp sự cố sức khỏe đột xuất, có giấy xác nhận bệnh viện.',
  );
  const [cancelRefundPlan, setCancelRefundPlan] = useState(
    'Hoàn tiền 100% tự động cho 214 vé đã bán (128.400.000đ).',
  );
  const [cancelDoc, setCancelDoc] = useState('ThongBaoHuyShow_BienBan_2026.pdf');

  const cleanVenueName = evVenue.replace(' (Đã xác minh)', '').replace('CUSTOM: ', '').trim();
  const matchedLayouts = availableLayouts.filter((l) => {
    if (!cleanVenueName) return false;
    const vName = (l.venueName || '').toLowerCase();
    const cName = cleanVenueName.toLowerCase();
    return vName.includes(cName) || cName.includes(vName);
  });

  const syncCurrentEvent = (patch: Partial<EventItem>) => {
    if (!selectedEventId) return;
    updateEvent(selectedEventId, patch);
  };

  const startCreateNewEvent = (venuePreselect?: string, layoutPreselect?: string) => {
    const vName =
      venuePreselect ||
      (verifiedVenues[0] ? `${verifiedVenues[0].name} (Đã xác minh)` : 'Nhà hát Ánh Trăng (Đã xác minh)');
    const clean = vName.replace(' (Đã xác minh)', '').trim();
    const matched = availableLayouts.filter((l) =>
      (l.venueName || '').toLowerCase().includes(clean.toLowerCase()),
    );
    const lName =
      layoutPreselect ||
      (matched[0] ? `${matched[0].name} · ${matched[0].totalSeats}` : 'Sơ đồ nhà hát v4 · 80 ghế');

    const newId = createEvent({
      name: '',
      orgName: state.orgOnboarding?.orgName || 'Ánh Trăng Events',
      venueName: vName,
      layoutName: lName,
      category: 'Âm nhạc · Biểu diễn nghệ thuật',
      poster: null,
      status: 'DRAFT',
      sessions: [
        {
          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
          name: 'Suất 1 · Khai mạc',
          time: '',
          saleWindow: '',
          gates: 'Cổng chính G1, Cổng VIP G2',
          status: 'ACTIVE',
        },
      ],
      ticketTiers: [
        { id: `tt-${Date.now()}-1`, name: 'Standard', price: '500.000đ', quota: 50, sold: 0 },
        { id: `tt-${Date.now()}-2`, name: 'VIP', price: '900.000đ', quota: 20, sold: 0 },
        { id: `tt-${Date.now()}-3`, name: 'COMP', price: '0đ', quota: 10, sold: 0 },
      ],
      totalRevenue: '0đ',
      ticketsSold: 0,
      totalTickets: 80,
    });

    setSelectedEventId(newId);
    setIsCreatingNew(true);
    setEvName('');
    setEvPoster(null);
    setEvVenue(vName);
    setEvLayout(lName);
    setEvCategory('Âm nhạc · Biểu diễn nghệ thuật');
    setSessName('Suất 1 · Khai mạc');
    setSessTime('');
    setSessDate('');
    setSessStartTime('20:00');
    setSessEndTime('23:00');
    setSessSaleWindow('');
    setSessSaleStart('');
    setSessSaleEnd('');
    setSessGates('Cổng chính G1, Cổng VIP G2');
    setStdPrice('500.000đ');
    setVipPrice('900.000đ');
    setSelectedStandardRows(['A', 'B', 'E', 'F']);
    setSelectedVipRows(['C', 'D']);
    setSearchParams({ screen: 'o-event-edit', eventId: newId, createNew: 'true' });
  };

  const handleVenueChange = (val: string) => {
    if (val === 'CUSTOM') {
      setEvVenue('CUSTOM: Sân khấu ngoài trời mới');
      setEvLayout('CUSTOM: Sơ đồ đứng tự do (GA)');
      syncCurrentEvent({
        venueName: 'CUSTOM: Sân khấu ngoài trời mới',
        layoutName: 'CUSTOM: Sơ đồ đứng tự do (GA)',
      });
      return;
    }
    setEvVenue(val);
    const clean = val.replace(' (Đã xác minh)', '').replace('CUSTOM: ', '').trim();
    const matched = availableLayouts.filter((l) => {
      const vName = (l.venueName || '').toLowerCase();
      const cName = clean.toLowerCase();
      return vName.includes(cName) || cName.includes(vName);
    });
    let chosenLayout = 'Khu vực đứng tự do (GA) · Không số ghế';
    if (matched.length > 0) {
      chosenLayout = `${matched[0].name} · ${matched[0].totalSeats}`;
    } else if (clean.toLowerCase().includes('bến sông')) {
      chosenLayout = 'Sơ đồ khu đứng v1 · 2.500 chỗ';
    } else if (clean.toLowerCase().includes('phú thọ')) {
      chosenLayout = 'Sơ đồ Arena v1 · 1.400 chỗ';
    }
    setEvLayout(chosenLayout);
    syncCurrentEvent({ venueName: val, layoutName: chosenLayout });
  };

  useEffect(() => {
    const venueParam = searchParams.get('venue');
    const layoutParam = searchParams.get('layout');
    const createNew = searchParams.get('createNew');
    const eventId = searchParams.get('eventId');

    if (createNew === 'true' && !eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startCreateNewEvent(venueParam || undefined, layoutParam || undefined);
    } else if (eventId && eventId !== selectedEventId) {
      setSelectedEventId(eventId);
      setIsCreatingNew(false);
      const ev = (state?.events || []).find((e) => e.id === eventId);
      if (ev) {
        setEvName(ev.name);
        setEvVenue(ev.venueName);
        setEvLayout(ev.layoutName);
        setEvCategory(ev.category || 'Âm nhạc · Biểu diễn nghệ thuật');
        setEvPoster(ev.poster || null);
        if (ev.sessions && ev.sessions.length > 0) {
          const s = ev.sessions[0];
          setSessName(s.name);
          setSessTime(s.time);
          const tp = parseSessTime(s.time);
          setSessDate(tp.date);
          setSessStartTime(tp.start);
          setSessEndTime(tp.end);

          setSessSaleWindow(s.saleWindow || '');
          const sp = parseSaleWindow(s.saleWindow || '');
          setSessSaleStart(sp.start);
          setSessSaleEnd(sp.end);

          setSessGates(s.gates || 'Cổng chính G1, Cổng VIP G2');
        }
        if (ev.ticketTiers && ev.ticketTiers.length > 0) {
          const std = ev.ticketTiers.find((t) => t.name.toLowerCase().includes('standard'));
          const vip = ev.ticketTiers.find((t) => t.name.toLowerCase().includes('vip'));
          if (std) setStdPrice(std.price);
          if (vip) setVipPrice(vip.price);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state?.events]);

  const handleSaveDraft = () => {
    if (!evName.trim()) {
      showToast('Vui lòng nhập tên sự kiện trước khi lưu.', 'warning');
      return;
    }
    if (selectedEventId) {
      syncCurrentEvent({
        name: evName,
        venueName: evVenue,
        layoutName: evLayout,
        category: evCategory,
        poster: evPoster,
        sessions: [
          {
            id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
            name: sessName || 'Suất 1 · Khai mạc',
            time: sessTime || 'Chưa định ngày',
            saleWindow: sessSaleWindow || '',
            gates: sessGates || 'Cổng chính G1',
            status: 'ACTIVE',
          },
        ],
        ticketTiers: [
          { id: `tt-1`, name: 'Standard', price: stdPrice, quota: 50, sold: 0 },
          { id: `tt-2`, name: 'VIP', price: vipPrice, quota: 20, sold: 0 },
          { id: `tt-3`, name: 'COMP', price: '0đ', quota: 10, sold: 0 },
        ],
      });
      showToast(`Đã lưu nháp thông tin sự kiện "${evName}".`, 'success');
    }
  };

  const screenMeta = EVENT_SCREENS.find((s) => s.id === activeScreen) || EVENT_SCREENS[0];

  const toggleStandardRow = (row: string) => {
    setSelectedStandardRows((prev) =>
      prev.includes(row) ? prev.filter((r) => r !== row) : [...prev, row],
    );
  };

  const toggleVipRow = (row: string) => {
    setSelectedVipRows((prev) =>
      prev.includes(row) ? prev.filter((r) => r !== row) : [...prev, row],
    );
  };

  const toggleSeat = (code: string) => {
    setSelectedSeats((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={EVENT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
        workflowSteps={[
          { id: 'o-events', label: 'Danh sách sự kiện', matchIds: ['o-events'] },
          {
            id: 'o-event-edit',
            label: 'Thông tin & Địa điểm',
            matchIds: ['o-event-edit', 'o-event-detail'],
          },
          {
            id: 'o-session-edit',
            label: 'Suất diễn',
            matchIds: ['o-session-edit', 'o-session-detail', 'o-session-2', 'o-session-paused'],
          },
          {
            id: 'o-ticket-types',
            label: 'Hạng vé & Khuyến mãi',
            matchIds: [
              'o-ticket-types',
              'o-ticket-edit',
              'o-ticket-vip',
              'o-ticket-comp',
              'o-ticket-free',
              'o-audience-pricing',
              'o-promotions',
            ],
          },
          {
            id: 'o-seat-pricing',
            label: 'Gán ghế & Giữ ghế',
            matchIds: [
              'o-seat-pricing',
              'o-seat-pricing-vip',
              'o-seat-rows-applied',
              'o-seat-status',
              'o-seat-block-confirm',
              'o-seat-release-confirm',
            ],
          },
          {
            id: 'o-review-submit',
            label: 'Gửi duyệt & Xuất bản',
            matchIds: ['o-review-submit', 'o-event-pending', 'o-cancel', 'o-cancel-pending'],
          },
        ]}
      />

      {/* 1. o-events */}
      {activeScreen === 'o-events' && (
        <div>
          <FigmaHeroBanner variant="concert" />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
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
                  placeholder="Tìm theo tên, mã, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-ticket-types')}
              >
                Lọc trạng thái
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => showToast('Đã xuất danh sách sự kiện ra tệp CSV.', 'success')}
              >
                Xuất CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startCreateNewEvent()}
              >
                + Tạo mới sự kiện
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Tất cả danh sách sự kiện
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {eventsList.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SỰ KIỆN</th>
                    <th>ĐỊA ĐIỂM</th>
                    <th>SUẤT DIỄN</th>
                    <th>VÉ ĐÃ BÁN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsList
                    .filter(
                      (e) =>
                        !search ||
                        e.name.toLowerCase().includes(search.toLowerCase()) ||
                        e.venueName.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((e) => {
                      const totalSold = e.ticketsSold || e.ticketTiers.reduce((acc, t) => acc + (t.sold || 0), 0);
                      const totalQuota = e.totalTickets || e.ticketTiers.reduce((acc, t) => acc + (t.quota || 0), 80);
                      return (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 700 }}>{e.name}</td>
                          <td>{e.venueName}</td>
                          <td>{e.sessions.length > 0 ? `${e.sessions.length} suất` : 'Chưa có suất'}</td>
                          <td>
                            {totalSold} / {totalQuota}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                e.status === 'PUBLISHED'
                                  ? 'badge-success'
                                  : e.status === 'PENDING'
                                    ? 'badge-warning'
                                    : e.status === 'DRAFT'
                                      ? 'badge-secondary'
                                      : 'badge-danger'
                              }`}
                            >
                              {e.status === 'PUBLISHED'
                                ? 'Đang mở bán'
                                : e.status === 'PENDING'
                                  ? 'Chờ duyệt mở bán'
                                  : e.status === 'DRAFT'
                                    ? 'Bản nháp'
                                    : e.status === 'CANCEL_REQUESTED'
                                      ? 'Chờ duyệt hủy'
                                      : e.status === 'CANCELLED'
                                        ? 'Đã hủy show'
                                        : 'Từ chối duyệt'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNew(false);
                                setSelectedEventId(e.id);
                                setEvName(e.name);
                                setEvPoster(
                                  e.poster ||
                                  (e.name === 'Đêm nhạc Mùa Thu'
                                    ? '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg'
                                    : null),
                                );
                                setEvVenue(e.venueName);
                                setEvLayout(e.layoutName);
                                setEvCategory(e.category || 'Âm nhạc · Biểu diễn nghệ thuật');
                                if (e.sessions && e.sessions.length > 0) {
                                  const s = e.sessions[0];
                                  setSessName(s.name);
                                  setSessTime(s.time);
                                  const tp = parseSessTime(s.time);
                                  setSessDate(tp.date);
                                  setSessStartTime(tp.start);
                                  setSessEndTime(tp.end);

                                  setSessSaleWindow(s.saleWindow || '');
                                  const sp = parseSaleWindow(s.saleWindow || '');
                                  setSessSaleStart(sp.start);
                                  setSessSaleEnd(sp.end);

                                  setSessGates(s.gates || 'Cổng chính G1');
                                }
                                if (e.ticketTiers && e.ticketTiers.length > 0) {
                                  const std = e.ticketTiers.find((t) => t.name.toLowerCase().includes('standard'));
                                  const vip = e.ticketTiers.find((t) => t.name.toLowerCase().includes('vip'));
                                  if (std) setStdPrice(std.price);
                                  if (vip) setVipPrice(vip.price);
                                }
                                if (e.status === 'PUBLISHED') {
                                  setScreen('o-event-detail');
                                } else if (e.status === 'PENDING') {
                                  setScreen('o-event-pending');
                                } else if (e.status === 'CANCEL_REQUESTED' || e.status === 'CANCELLED') {
                                  setScreen('o-cancel-pending');
                                } else {
                                  setScreen('o-event-edit');
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {e.status === 'PUBLISHED'
                                ? 'Quản lý →'
                                : e.status === 'PENDING'
                                  ? 'Xem hồ sơ →'
                                  : 'Chỉnh sửa →'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. o-event-edit */}
      {activeScreen === 'o-event-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              {isCreatingNew ? 'Tạo mới sự kiện' : 'Thông tin chi tiết sự kiện'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên sự kiện</label>
                <input
                  className="form-input"
                  placeholder="Nhập tên sự kiện (ví dụ: Live Concert Mùa Yêu, Lễ hội Âm nhạc...)"
                  value={evName}
                  onChange={(e) => setEvName(e.target.value)}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Địa điểm tổ chức</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, padding: '2px 8px', color: 'var(--primary)', fontWeight: 600 }}
                    onClick={() => navigate('/org/venues?screen=o-venue-create')}
                  >
                    + Khai báo địa điểm mới trong thư viện →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    className="form-input"
                    value={evVenue.startsWith('CUSTOM:') ? 'CUSTOM' : evVenue}
                    onChange={(e) => handleVenueChange(e.target.value)}
                  >
                    {verifiedVenues.map((v) => (
                      <option key={v.id} value={`${v.name} (Đã xác minh)`}>
                        {v.name} · {v.city} ({v.type || 'Đã xác minh'})
                      </option>
                    ))}
                    <option value="Sân khấu Bến Sông · TP. Thủ Đức">
                      Sân khấu Bến Sông · Ngoài trời (2.500 khách)
                    </option>
                    <option value="CUSTOM">+ Nhập địa điểm mới trực tiếp...</option>
                  </select>
                  {evVenue.startsWith('CUSTOM:') && (
                    <input
                      className="form-input"
                      placeholder="Gõ tên và địa chỉ địa điểm mới (ví dụ: Trung tâm Triển lãm SECC, Quận 7)"
                      value={evVenue.replace('CUSTOM: ', '')}
                      onChange={(e) => setEvVenue(`CUSTOM: ${e.target.value}`)}
                    />
                  )}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Sơ đồ chỗ ngồi áp dụng</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, padding: '2px 8px', color: 'var(--primary)', fontWeight: 600 }}
                    onClick={() => navigate('/org/venues?screen=o-layout-editor')}
                  >
                    Vẽ & chỉnh sửa sơ đồ ghế →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    className="form-input"
                    value={evLayout.startsWith('CUSTOM:') ? 'CUSTOM' : evLayout}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setEvLayout('CUSTOM: Sơ đồ đứng tự do (GA)');
                      } else {
                        setEvLayout(e.target.value);
                      }
                    }}
                  >
                    {matchedLayouts.length > 0 && (
                      <optgroup label={`Sơ đồ thiết kế riêng cho ${cleanVenueName} (${matchedLayouts.length})`}>
                        {matchedLayouts.map((l) => (
                          <option key={l.id} value={`${l.name} · ${l.totalSeats}`}>
                            {l.name} · {l.structure} ({l.totalSeats})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Sơ đồ địa điểm khác & Mẫu chung">
                      {availableLayouts
                        .filter((l) => !matchedLayouts.some((m) => m.id === l.id))
                        .map((l) => (
                          <option key={l.id} value={`${l.name} · ${l.totalSeats}`}>
                            {l.name} · {l.venueName} ({l.totalSeats})
                          </option>
                        ))}
                      <option value="Khu vực đứng tự do (GA) · Không số ghế">
                        Khu vực đứng tự do (General Admission - GA) · Không số ghế
                      </option>
                      <option value="Sân vận động · Khán đài A, B, C, D (15.000 chỗ)">
                        Sân vận động · Khán đài A, B, C, D (15.000 chỗ)
                      </option>
                    </optgroup>
                    <optgroup label="Tùy biến">
                      <option value="CUSTOM">+ Tùy chỉnh loại sơ đồ khác...</option>
                    </optgroup>
                  </select>
                  {evLayout.startsWith('CUSTOM:') && (
                    <input
                      className="form-input"
                      placeholder="Nhập tên mô hình sơ đồ (ví dụ: Khu VIP Lounge 10 bàn + GA 500 khách)"
                      value={evLayout.replace('CUSTOM: ', '')}
                      onChange={(e) => setEvLayout(`CUSTOM: ${e.target.value}`)}
                    />
                  )}
                </div>
              </div>

              {/* Thẻ liên kết Địa điểm & Sơ đồ ghế */}
              <div
                style={{
                  padding: '12px 16px',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#DBEAFE',
                      color: '#1D4ED8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    🔗
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A' }}>
                      Địa điểm & Sơ đồ ghế đã liên kết
                    </div>
                    <div style={{ fontSize: 12, color: '#2563EB' }}>
                      Địa điểm: <strong>{cleanVenueName || 'Chưa chọn'}</strong>
                      {' ➔ '}
                      Sơ đồ áp dụng: <strong>{evLayout.replace('CUSTOM: ', '')}</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: '#FFFFFF',
                    borderColor: '#93C5FD',
                    color: '#1D4ED8',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    if (
                      cleanVenueName.toLowerCase().includes('bến sông') ||
                      evLayout.toLowerCase().includes('khu đứng')
                    ) {
                      navigate('/org/venues?screen=o-layout-standing');
                    } else {
                      navigate('/org/venues?screen=o-layout-editor');
                    }
                  }}
                >
                  Xem & chỉnh sửa cấu trúc sơ đồ →
                </button>
              </div>
              <div>
                <label className="form-label">Danh mục & độ tuổi</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Âm nhạc · Biểu diễn nghệ thuật"
                  value={evCategory}
                  onChange={(e) => setEvCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Ảnh poster sự kiện (Banner)</label>
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: '#FAF9F6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', margin: 0, fontWeight: 600 }}
                    >
                      📁 Chọn ảnh từ thiết bị
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (!f.type.startsWith('image/')) {
                              showToast('Vui lòng chọn file hình ảnh (JPG, PNG, WebP...).', 'warning');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const res = ev.target?.result as string;
                              if (res) {
                                setEvPoster(res);
                                showToast('Đã tải lên ảnh poster sự kiện thành công!', 'success');
                              }
                            };
                            reader.readAsDataURL(f);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {evPoster && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#E11D48', fontSize: 12 }}
                        onClick={() => {
                          setEvPoster(null);
                          showToast('Đã gỡ ảnh poster.', 'info');
                        }}
                      >
                        ✕ Xóa ảnh
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: evPoster ? '#18794E' : 'var(--muted)', fontWeight: evPoster ? 600 : 400 }}>
                      {evPoster ? '✓ Đã đính kèm ảnh poster' : 'Chưa tải ảnh lên (khuyến nghị 16:9)'}
                    </span>
                  </div>

                  {/* Preset quick picks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ảnh mẫu gợi ý nhanh:</span>
                    {[
                      { label: 'Acoustic', url: '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg' },
                      { label: 'Concert', url: '/assets/2ba0a1dcc121100d3d8f109009a71fe5b0c24c83.jpg' },
                      { label: 'EDM Fest', url: '/assets/3f342ec49c80bf8bf7c5c9152109747e1638fd36.jpg' },
                      { label: 'Triển lãm', url: '/assets/548d1e4f2d839eceb38b120027ff7b991f6c8222.jpg' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setEvPoster(p.url);
                          showToast(`Đã chọn ảnh mẫu "${p.label}".`, 'success');
                        }}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: evPoster === p.url ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                          background: evPoster === p.url ? '#FDF0EC' : '#FFFFFF',
                          color: evPoster === p.url ? 'var(--brand)' : 'var(--ink)',
                          fontWeight: evPoster === p.url ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSaveDraft}
                >
                  Lưu nháp
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (isCreatingNew && evName.trim()) handleSaveDraft();
                    setScreen('o-session-edit');
                  }}
                >
                  Cấu hình suất diễn
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (isCreatingNew && evName.trim()) handleSaveDraft();
                    setScreen('o-ticket-types');
                  }}
                >
                  Hạng vé & ghế
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 3. o-event-detail */}
      {activeScreen === 'o-event-detail' && (
        <div>
          <FigmaNavyContextBanner
            title={currentEvent?.name || evName}
            subtitle={`${currentEvent?.venueName || evVenue} · Hồ sơ đang xem`}
            badge={currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : currentEvent?.status === 'PENDING' ? 'Chờ duyệt' : 'Bản nháp'}
            image={currentEvent?.poster || evPoster}
          />
          <FigmaContextGrid
            items={[
              { label: 'Sự kiện', value: currentEvent?.name || evName },
              {
                label: 'Địa điểm & sơ đồ',
                value: `${currentEvent?.venueName || evVenue} · ${currentEvent?.layoutName || evLayout}`,
              },
              { label: 'Suất diễn', value: 'Đêm 1 (24/10 · 20:00) · Đêm 2 (25/10 · 20:00)' },
              {
                label: 'Doanh thu tạm tính',
                value: `${currentEvent?.totalRevenue || '0đ'} · ${currentEvent?.ticketsSold || 0} vé đã phát hành`,
              },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('HoSoCapPhepBieuDien_DemNhacMuaThu.pdf')} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-seat-status')}
            >
              Trạng thái ghế theo suất
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-ticket-types')}
            >
              Hạng vé & giá
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-session-detail')}
            >
              Quản lý suất diễn
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-cancel')}
            >
              Yêu cầu hủy sự kiện
            </button>
          </div>
        </div>
      )}

      {/* 4. o-session-edit */}
      {activeScreen === 'o-session-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết suất diễn
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên suất diễn</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Suất 1 · Khai mạc"
                  value={sessName}
                  onChange={(e) => {
                    setSessName(e.target.value);
                    syncCurrentEvent({
                      sessions: [
                        {
                          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
                          name: e.target.value,
                          time: sessTime,
                          saleWindow: sessSaleWindow,
                          gates: sessGates,
                          status: 'ACTIVE',
                        },
                      ],
                    });
                  }}
                />
              </div>
              {/* 1. THỜI GIAN DIỄN RA (CHỌN LỊCH + GIỜ THAY VÌ NHẬP CHỮ) */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  background: '#FAF9F6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📅 Chọn thời gian diễn ra
                  </label>
                  {sessTime ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--brand)',
                        background: '#FDF0EC',
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: '1px solid #F9C3B4',
                      }}
                    >
                      ✓ {sessTime}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Chưa chọn ngày diễn</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Ngày biểu diễn
                    </span>
                    <input
                      type="date"
                      className="form-input"
                      value={sessDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Giờ bắt đầu
                    </span>
                    <input
                      type="time"
                      className="form-input"
                      value={sessStartTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Giờ kết thúc
                    </span>
                    <input
                      type="time"
                      className="form-input"
                      value={sessEndTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Gợi ý chọn nhanh */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Gợi ý nhanh:</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSession('tonight')}
                  >
                    Tối nay (20:00 – 23:00)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSession('weekend')}
                  >
                    Cuối tuần này (19:30 – 22:30)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSession('nextMonth')}
                  >
                    Tháng sau (20:00 – 23:00)
                  </button>
                </div>
              </div>

              {/* 2. THỜI GIAN MỞ BÁN - ĐÓNG BÁN (CHỌN DATETIME THAY VÌ NHẬP) */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  background: '#FAF9F6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🎟️ Chọn thời gian mở bán – đóng bán vé
                  </label>
                  {sessSaleWindow ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#15803d',
                        background: '#f0fdf4',
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      ✓ {sessSaleWindow}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Chưa đặt khung giờ bán</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Bắt đầu mở bán (Ngày & Giờ)
                    </span>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={sessSaleStart}
                      onChange={(e) => handleSaleStartChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      Đóng bán vé (Ngày & Giờ)
                    </span>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={sessSaleEnd}
                      onChange={(e) => handleSaleEndChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Gợi ý chọn nhanh mở bán */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Gợi ý nhanh:</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSale('now')}
                  >
                    Mở bán ngay hôm nay
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSale('twoWeeksBefore')}
                  >
                    Mở bán trước 15 ngày
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6 }}
                    onClick={() => applyPresetSale('closeAtShow')}
                  >
                    Đóng bán trước giờ diễn 2 tiếng
                  </button>
                </div>
              </div>

              {/* 3. CỔNG CHECK-IN ÁP DỤNG (CHỌN NHANH VỚI NÚT / BADGE) */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🚪 Cổng check-in áp dụng
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['Cổng chính G1', 'Cổng phụ G2', 'Cổng VIP', 'Cổng Sảnh A', 'Cổng Sảnh B'].map((gate) => {
                    const isSelected = sessGates.toLowerCase().includes(gate.toLowerCase());
                    return (
                      <button
                        key={gate}
                        type="button"
                        onClick={() => handleToggleGate(gate)}
                        style={{
                          fontSize: 12,
                          padding: '5px 12px',
                          borderRadius: 20,
                          border: isSelected ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                          background: isSelected ? '#FDF0EC' : '#FFFFFF',
                          color: isSelected ? 'var(--brand)' : 'var(--ink)',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {gate}
                      </button>
                    );
                  })}
                </div>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Cổng chính G1, Cổng VIP G2"
                  value={sessGates}
                  onChange={(e) => {
                    setSessGates(e.target.value);
                    syncCurrentEvent({
                      sessions: [
                        {
                          id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
                          name: sessName,
                          time: sessTime,
                          saleWindow: sessSaleWindow,
                          gates: e.target.value,
                          status: 'ACTIVE',
                        },
                      ],
                    });
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã lưu cấu hình suất diễn.', 'success');
                    setScreen('o-ticket-types');
                  }}
                >
                  Tiếp tục: Cấu hình hạng vé & ghế →
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-event-edit')}
                >
                  ← Quay lại thông tin sự kiện
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 5. o-session-detail */}
      {activeScreen === 'o-session-detail' && (
        <div>
          <FigmaNavyContextBanner
            title={currentEvent?.name || evName}
            subtitle={`${currentEvent?.venueName || evVenue} · Chi tiết suất diễn`}
            badge="Đã ghi nhận"
            image={currentEvent?.poster || evPoster}
          />
          <FigmaContextGrid
            items={[
              { label: 'Suất diễn', value: `${sessName} · ${sessTime || '20:00 – 22:30'}` },
              { label: 'Trạng thái mở bán', value: 'Đang mở bán · Đã bán 64 / 80 ghế' },
              { label: 'Giữ nội bộ & Chặn bán', value: '4 ghế giữ nội bộ · 2 ghế chặn kỹ thuật' },
              { label: 'Cổng soát vé', value: `${sessGates} · Sẵn sàng` },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('DanhSachGhe_Dem1_2410.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-seat-status')}
            >
              Mở sơ đồ ghế suất này
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-session-paused')}
            >
              Tạm dừng bán suất này
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-session-2')}
            >
              Chuyển sang Đêm 2
            </button>
          </div>
        </div>
      )}

      {/* 6. o-session-2 */}
      {activeScreen === 'o-session-2' && (
        <div>
          <FigmaNavyContextBanner
            title={currentEvent?.name || evName}
            subtitle={`${currentEvent?.venueName || evVenue} · Chi tiết suất diễn 2`}
            badge="Đang mở bán"
            image={currentEvent?.poster || evPoster}
          />
          <FigmaContextGrid
            items={[
              { label: 'Suất diễn', value: 'Đêm 2 · 25/10/2026 (20:00 – 22:30)' },
              { label: 'Trạng thái mở bán', value: 'Đang mở bán · Đã bán 52 / 80 ghế' },
              { label: 'Giữ nội bộ & Chặn bán', value: '2 ghế giữ nội bộ · 0 ghế chặn kỹ thuật' },
              { label: 'Cổng soát vé', value: 'G1 (Cổng chính), G2 (VIP) · Sẵn sàng' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-seat-status')}
            >
              Mở sơ đồ ghế Đêm 2
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-session-detail')}
            >
              Quay lại Đêm 1
            </button>
          </div>
        </div>
      )}

      {/* 7. o-session-paused */}
      {activeScreen === 'o-session-paused' && (
        <div>
          <FigmaNavyContextBanner
            title={currentEvent?.name || evName}
            subtitle={`${currentEvent?.venueName || evVenue} · Tạm dừng bán`}
            badge="Tạm dừng bán"
            image={currentEvent?.poster || evPoster}
          />
          <FigmaContextGrid
            items={[
              { label: 'Suất diễn', value: 'Đêm 1 · 24/10/2026 (20:00 – 22:30)' },
              { label: 'Trạng thái', value: 'Tạm dừng bán trên kênh khách hàng · Ве đã mua vẫn hợp lệ' },
            ]}
          />
          <FigmaInfoAlert tone="warning">
            Khi tạm dừng bán, khách hàng mới không thể đặt vé nhưng các đơn đã thanh toán và cổng check-in vẫn hoạt động bình thường.
          </FigmaInfoAlert>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                showToast('Đã mở bán lại cho Suất Đêm 1.', 'success');
                setScreen('o-session-detail');
              }}
            >
              Mở bán lại suất diễn
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-event-detail')}
            >
              Quay lại sự kiện
            </button>
          </div>
        </div>
      )}

      {/* 8. o-ticket-types */}
      {activeScreen === 'o-ticket-types' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                className="form-input"
                style={{ width: 280 }}
                placeholder="Tìm theo tên, mã, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-audience-pricing')}
              >
                Giá theo đối tượng
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-promotions')}
              >
                Khuyến mãi
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-seat-pricing')}
              >
                Gán theo hàng ghế
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-ticket-edit')}
              >
                + Tạo mới
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              background: '#F8FAFC',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 12.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>
                📍 Địa điểm tổ chức: <strong style={{ color: 'var(--ink)' }}>{currentEvent?.venueName || evVenue}</strong>
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span>
                🗺️ Sơ đồ chỗ ngồi áp dụng: <strong style={{ color: 'var(--brand)' }}>{currentEvent?.layoutName || evLayout}</strong>
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--primary)', padding: '2px 8px' }}
              onClick={() => navigate('/org/venues?screen=o-layout-editor')}
            >
              Chỉnh sửa sơ đồ trong Thư viện →
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
                Tất cả danh sách
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>4 bản ghi</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>HẠNG VÉ</th>
                    <th>LOẠI HÌNH</th>
                    <th>HÀNG GHẾ GÁN</th>
                    <th>QUOTA TỰ TÍNH</th>
                    <th>GIÁ VÉ</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Standard</td>
                    <td>Trả phí</td>
                    <td>Hàng A, B, E, F</td>
                    <td>40 ghế</td>
                    <td>{stdPrice}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-ticket-edit')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>VIP</td>
                    <td>Trả phí</td>
                    <td>Hàng C, D</td>
                    <td>20 ghế</td>
                    <td>{vipPrice}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-ticket-vip')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Gán ghế
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>COMP · Khách mời</td>
                    <td>Vé mời (COMP)</td>
                    <td>Hàng G</td>
                    <td>10 ghế</td>
                    <td>0đ (Nội bộ)</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-ticket-comp')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Cấu hình
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Vé Sinh viên 0đ</td>
                    <td>Miễn phí</td>
                    <td>Hàng H</td>
                    <td>10 ghế</td>
                    <td>0đ</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-ticket-free')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. o-ticket-edit (Standard) */}
      {activeScreen === 'o-ticket-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Hạng Standard
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên hạng vé</label>
                <input className="form-input" defaultValue="Standard" />
              </div>
              <div>
                <label className="form-label">Giá vé niêm yết</label>
                <input
                  className="form-input"
                  value={stdPrice}
                  onChange={(e) => setStdPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Hàng ghế áp dụng (Quota tự tính)</label>
                <input className="form-input" readOnly value="Hàng A, B, E, F · 40 ghế" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    updateTicketTier('tt-1', { price: stdPrice });
                    showToast('Đã lưu giá vé hạng Standard.', 'success');
                    setScreen('o-ticket-types');
                  }}
                >
                  Lưu hạng vé
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-seat-pricing')}
                >
                  Gán theo hàng ghế
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 10. o-ticket-vip */}
      {activeScreen === 'o-ticket-vip' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Hạng VIP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên hạng vé</label>
                <input className="form-input" defaultValue="VIP · Trung tâm khán phòng" />
              </div>
              <div>
                <label className="form-label">Giá vé niêm yết</label>
                <input
                  className="form-input"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Quyền lợi đi kèm</label>
                <input
                  className="form-input"
                  defaultValue="Lối vào ưu tiên Cổng G2 + Quà tặng merchandise"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    updateTicketTier('tt-2', { price: vipPrice });
                    showToast('Đã cập nhật hạng vé VIP.', 'success');
                    setScreen('o-seat-pricing-vip');
                  }}
                >
                  Gán hàng ghế VIP
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-ticket-types')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 11. o-ticket-comp */}
      {activeScreen === 'o-ticket-comp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Cấu hình hạng vé mời · COMP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên hạng vé</label>
                <input className="form-input" defaultValue="COMP · Khách mời" />
              </div>
              <div>
                <label className="form-label">Hàng ghế dành riêng</label>
                <input className="form-input" defaultValue="Hàng G · 10 ghế" />
              </div>
              <div>
                <label className="form-label">Quy tắc phát hành</label>
                <input
                  className="form-input"
                  value={compNote}
                  onChange={(e) => setCompNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã lưu cấu hình vé COMP.', 'success');
                    setScreen('o-ticket-types');
                  }}
                >
                  Lưu cấu hình COMP
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-ticket-types')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 12. o-ticket-free */}
      {activeScreen === 'o-ticket-free' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Cấu hình hạng vé miễn phí · Vé Sinh viên 0đ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên hạng vé</label>
                <input className="form-input" defaultValue="Vé Sinh viên 0đ" />
              </div>
              <div>
                <label className="form-label">Hàng ghế áp dụng</label>
                <input className="form-input" defaultValue="Hàng H · 10 ghế" />
              </div>
              <div>
                <label className="form-label">Giới hạn đặt vé</label>
                <input
                  className="form-input"
                  value={freeLimit}
                  onChange={(e) => setFreeLimit(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã cập nhật cấu hình Vé Sinh viên 0đ.', 'success');
                    setScreen('o-ticket-types');
                  }}
                >
                  Lưu cấu hình
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-ticket-types')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard
            title={evName || 'Chưa đặt tên sự kiện'}
            subtitle={evVenue || state.orgOnboarding?.orgName || 'Ban tổ chức'}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Bản nháp')}
            image={evPoster}
            onImageChange={(url) => {
              setEvPoster(url || null);
              syncCurrentEvent({ poster: url || null });
            }}
          />
        </div>
      )}

      {/* 13. o-audience-pricing */}
      {activeScreen === 'o-audience-pricing' && (
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
              Chính sách giá theo nhóm đối tượng
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setScreen('o-ticket-types')}
            >
              ← Quay lại hạng vé
            </button>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ĐỐI TƯỢNG KHÁCH</th>
                  <th>HẠNG VÉ ÁP DỤNG</th>
                  <th>MỨC ƯU ĐÃI</th>
                  <th>ĐIỀU KIỆN XÁC THỰC</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Học sinh / Sinh viên</td>
                  <td>Standard</td>
                  <td>Giảm 20% (400.000đ)</td>
                  <td>Xuất trình thẻ SV tại cổng G1</td>
                  <td>
                    <span className="badge badge-success">Đang bật</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Hội viên Early Bird</td>
                  <td>Standard, VIP</td>
                  <td>Giảm 15%</td>
                  <td>Đặt trước 15/10/2026</td>
                  <td>
                    <span className="badge badge-success">Đang bật</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Nhóm từ 4 khách</td>
                  <td>Standard</td>
                  <td>Giảm 10% tổng đơn</td>
                  <td>Tự động khi chọn ≥ 4 ghế</td>
                  <td>
                    <span className="badge badge-success">Đang bật</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 14. o-promotions */}
      {activeScreen === 'o-promotions' && (
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
              Danh sách mã khuyến mãi (Voucher)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => showToast('Đã tạo mã khuyến mãi AUTUMN20 mới.', 'success')}
              >
                + Thêm mã mới
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('o-ticket-types')}
              >
                Quay lại
              </button>
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MÃ VOUCHER</th>
                  <th>MỨC GIẢM</th>
                  <th>LƯỢT DÙNG</th>
                  <th>THỜI HẠN</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>MUATHU50K</td>
                  <td>50.000đ</td>
                  <td>42 / 100</td>
                  <td>01/10 – 24/10/2026</td>
                  <td>
                    <span className="badge badge-success">Đang hoạt động</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>VIPFRIEND15</td>
                  <td>15% (Tối đa 150.000đ)</td>
                  <td>18 / 50</td>
                  <td>05/10 – 24/10/2026</td>
                  <td>
                    <span className="badge badge-success">Đang hoạt động</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 15. o-seat-pricing */}
      {activeScreen === 'o-seat-pricing' && (
        <div>
          <div
            style={{
              padding: '12px 16px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗺️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
                  Phân bổ giá vé theo Sơ đồ chỗ ngồi: {currentEvent?.layoutName || evLayout}
                </div>
                <div style={{ fontSize: 12, color: '#3B82F6' }}>
                  Địa điểm: <strong>{currentEvent?.venueName || evVenue}</strong> · Khán phòng 80 ghế (8 hàng × 10 ghế)
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ background: '#FFFFFF', borderColor: '#93C5FD', color: '#1D4ED8' }}
              onClick={() => navigate('/org/venues?screen=o-layout-editor')}
            >
              Xem sơ đồ gốc tại Thư viện địa điểm →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setScreen('o-seat-pricing')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '2px solid var(--brand)',
                  background: '#FDF0EC',
                  color: 'var(--brand)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                🎟️ Đang gán: Standard ({stdPrice})
              </button>
              <button
                type="button"
                onClick={() => setScreen('o-seat-pricing-vip')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#FFFFFF',
                  color: 'var(--ink)',
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ⭐ Chuyển sang gán: VIP ({vipPrice}) →
              </button>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>
              Chọn hàng ghế áp dụng cho Standard
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Click trực tiếp vào từng hàng để chọn hoặc bỏ chọn hạng vé Standard (có dấu ✓ là đang gán Standard).
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {SEAT_ROWS.map((row) => {
                const isSelected = selectedStandardRows.includes(row);
                const currentTier = isSelected
                  ? 'Standard'
                  : row === 'C' || row === 'D'
                    ? 'VIP'
                    : row === 'G'
                      ? 'COMP'
                      : 'Standard';
                return (
                  <button
                    key={row}
                    type="button"
                    onClick={() => toggleStandardRow(row)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: isSelected ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                      background: isSelected ? '#FDF0EC' : '#FAF7F2',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: isSelected ? 'var(--brand)' : 'var(--ink)',
                    }}
                  >
                    <span>Hàng {row} · 10 ghế</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {currentTier}
                      {isSelected && <Check size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const rowsToApply = selectedStandardRows.length > 0 ? selectedStandardRows : ['A', 'B', 'E', 'F'];
                    applySeatRowTier(rowsToApply, 'Standard');
                    showToast(
                      `Đã áp dụng hạng Standard cho ${rowsToApply.length} hàng ghế (${rowsToApply.length * 10} ghế).`,
                      'success',
                    );
                    setScreen('o-seat-rows-applied');
                  }}
                >
                  Áp dụng cho {selectedStandardRows.length || 4} hàng ({ (selectedStandardRows.length || 4) * 10 } ghế)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-seat-pricing-vip')}
                >
                  Chọn hạng VIP →
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#18794E', borderColor: '#18794E', fontWeight: 700 }}
                onClick={() => setScreen('o-review-submit')}
              >
                Tiếp tục: Kiểm tra & Gửi xét duyệt sự kiện →
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Quota tự tính từ ghế
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Hạng đang gán</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Standard · 500.000đ</div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lựa chọn</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {selectedStandardRows.length * 10} ghế đang chọn
                </div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sơ đồ v4</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>8 hàng × 10 = 80 ghế</div>
              </div>
            </div>
            <FigmaInfoAlert tone="info">
              Chọn một hoặc nhiều hàng; hệ thống tính quota từ số ghế.
            </FigmaInfoAlert>
          </div>
        </div>
        </div>
      )}

      {/* 16. o-seat-pricing-vip */}
      {activeScreen === 'o-seat-pricing-vip' && (
        <div>
          <div
            style={{
              padding: '12px 16px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗺️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
                  Phân bổ giá vé theo Sơ đồ chỗ ngồi: {currentEvent?.layoutName || evLayout}
                </div>
                <div style={{ fontSize: 12, color: '#3B82F6' }}>
                  Địa điểm: <strong>{currentEvent?.venueName || evVenue}</strong> · Khán phòng 80 ghế (8 hàng × 10 ghế)
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ background: '#FFFFFF', borderColor: '#93C5FD', color: '#1D4ED8' }}
              onClick={() => navigate('/org/venues?screen=o-layout-editor')}
            >
              Xem sơ đồ gốc tại Thư viện địa điểm →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setScreen('o-seat-pricing')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#FFFFFF',
                  color: 'var(--ink)',
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ← Chuyển sang gán: Standard ({stdPrice})
              </button>
              <button
                type="button"
                onClick={() => setScreen('o-seat-pricing-vip')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '2px solid var(--brand)',
                  background: '#FDF0EC',
                  color: 'var(--brand)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ⭐ Đang gán: VIP ({vipPrice})
              </button>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>
              Chọn hàng ghế áp dụng cho VIP
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Click trực tiếp vào từng hàng để chọn hoặc bỏ chọn hạng vé VIP (có dấu ✓ là đang gán VIP).
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {SEAT_ROWS.map((row) => {
                const isSelected = selectedVipRows.includes(row);
                const currentTier = isSelected
                  ? 'VIP'
                  : row === 'G'
                    ? 'COMP'
                    : 'Standard';
                return (
                  <button
                    key={row}
                    type="button"
                    onClick={() => toggleVipRow(row)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: isSelected ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                      background: isSelected ? '#FDF0EC' : '#FAF7F2',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: isSelected ? 'var(--brand)' : 'var(--ink)',
                    }}
                  >
                    <span>Hàng {row} · 10 ghế</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {currentTier}
                      {isSelected && <Check size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const rowsToApply = selectedVipRows.length > 0 ? selectedVipRows : ['C', 'D'];
                    applySeatRowTier(rowsToApply, 'VIP');
                    showToast(
                      `Đã áp dụng hạng VIP cho ${rowsToApply.length} hàng ghế (${rowsToApply.length * 10} ghế).`,
                      'success',
                    );
                    setScreen('o-seat-rows-applied');
                  }}
                >
                  Áp dụng VIP cho {selectedVipRows.length || 2} hàng ({ (selectedVipRows.length || 2) * 10 } ghế)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-seat-pricing')}
                >
                  ← Quay lại gán Standard
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#18794E', borderColor: '#18794E', fontWeight: 700 }}
                onClick={() => setScreen('o-review-submit')}
              >
                Tiếp tục: Kiểm tra & Gửi xét duyệt sự kiện →
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Quota tự tính từ ghế
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Hạng đang gán</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>VIP · 900.000đ</div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lựa chọn</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {selectedVipRows.length * 10} ghế đang chọn
                </div>
              </div>
              <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sơ đồ v4</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>8 hàng × 10 = 80 ghế</div>
              </div>
            </div>
            <FigmaInfoAlert tone="info">
              Chọn một hoặc nhiều hàng; hệ thống tính quota từ số ghế.
            </FigmaInfoAlert>
          </div>
        </div>
        </div>
      )}

      {/* 17. o-seat-rows-applied */}
      {activeScreen === 'o-seat-rows-applied' && (
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
            Đã cập nhật phân bổ hạng vé theo hàng ghế
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Toàn bộ 80 ghế của Sơ đồ nhà hát v4 đã được gán hạng vé và tự động đồng bộ hạn mức (Quota) cho cả 2 suất diễn.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            80 / 80 ghế đã định giá
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-review-submit')}
            >
              Tiếp tục gửi duyệt sự kiện
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-ticket-types')}
            >
              Xem bảng hạng vé
            </button>
          </div>
        </div>
      )}

      {/* 18. o-seat-status */}
      {activeScreen === 'o-seat-status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Nhà hát Ánh Trăng</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                  Sơ đồ nhà hát v4
                </div>
              </div>
              <span className="badge badge-warning">Đêm 1 · 24/10</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => showToast('Phóng to bản đồ ghế.', 'info')}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => showToast('Tìm kiếm mã ghế.', 'info')}
              >
                <Search size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedSeats(['A02', 'A03'])}
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedSeats([])}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div
              style={{
                background: '#172A35',
                color: '#FFFFFF',
                textAlign: 'center',
                padding: '9px 0',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                marginBottom: 18,
              }}
            >
              SÂN KHẤU
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              {SEAT_ROWS.map((row) => (
                <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>
                    {row}
                  </span>
                  {SEAT_COLS.map((col) => {
                    const seatCode = `${row}${String(col).padStart(2, '0')}`;
                    const isSelected = selectedSeats.includes(seatCode);
                    const stateStatus = state.seatStatuses[seatCode];
                    const isSold = stateStatus === 'SOLD' || ['A04', 'A05', 'B04', 'B05', 'C05'].includes(seatCode);
                    const isHold = stateStatus === 'HOLD' || ['E01', 'E02'].includes(seatCode);
                    const isBlocked = stateStatus === 'BLOCKED' || ['H09', 'H10'].includes(seatCode);
                    const isVip = row === 'C' || row === 'D';

                    let bg = '#E7F6EC';
                    let border = '#9AD7B0';
                    let color = '#146C3E';
                    if (isSelected) {
                      bg = '#D34528';
                      border = '#D34528';
                      color = '#FFFFFF';
                    } else if (isSold) {
                      bg = '#E2DED8';
                      border = '#CBC5BC';
                      color = '#78716A';
                    } else if (isBlocked) {
                      bg = '#FDE8E8';
                      border = '#F5B5B5';
                      color = '#9E2626';
                    } else if (isHold) {
                      bg = '#E6F4F7';
                      border = '#9BD2DF';
                      color = '#166173';
                    } else if (isVip) {
                      bg = '#FEF3DE';
                      border = '#F3C979';
                      color = '#8C5409';
                    }

                    return (
                      <button
                        key={seatCode}
                        type="button"
                        onClick={() => toggleSeat(seatCode)}
                        style={{
                          width: 30,
                          height: 28,
                          borderRadius: 6,
                          border: `1px solid ${border}`,
                          background: bg,
                          color,
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginRight: col === 5 ? 10 : 0,
                        }}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                fontSize: 11.5,
                color: 'var(--muted)',
              }}
            >
              <span>🟢 Còn trống</span>
              <span>🟠 Đang chọn</span>
              <span>⚪ Đã bán</span>
              <span>🟡 Hạng VIP</span>
              <span>🔵 Giữ nội bộ</span>
              <span>🔴 Chặn bán</span>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thao tác với ghế
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Suất diễn</label>
                <input className="form-input" readOnly value="Đêm 1 · 24/10/2026 20:00" />
              </div>
              <div>
                <label className="form-label">Ghế đã chọn</label>
                <input
                  className="form-input"
                  value={`${selectedSeats.join(', ')} (Standard)`}
                  onChange={(e) =>
                    setSelectedSeats(
                      e.target.value
                        .replace('(Standard)', '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Thao tác</label>
                <select
                  className="form-input"
                  value={seatAction}
                  onChange={(e) => setSeatAction(e.target.value)}
                >
                  <option value="Giữ nội bộ (Hold)">Giữ nội bộ (Hold)</option>
                  <option value="Chặn bán kỹ thuật (Block)">Chặn bán kỹ thuật (Block)</option>
                  <option value="Giải phóng mở bán (Available)">Giải phóng mở bán (Available)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Lý do</label>
                <input
                  className="form-input"
                  value={seatReason}
                  onChange={(e) => setSeatReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    updateSeatStatus(selectedSeats, 'HOLD');
                    setScreen('o-seat-block-confirm');
                  }}
                >
                  Xác nhận giữ {selectedSeats.length || 2} ghế
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    updateSeatStatus(selectedSeats, 'BLOCKED');
                    setScreen('o-seat-block-confirm');
                  }}
                >
                  Chặn bán ghế
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    updateSeatStatus(selectedSeats, 'AVAILABLE');
                    setScreen('o-seat-release-confirm');
                  }}
                >
                  Giải phóng ghế giữ/chặn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 19. o-seat-block-confirm */}
      {activeScreen === 'o-seat-block-confirm' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Đã ghi nhận"
          />
          <FigmaContextGrid
            items={[
              { label: 'Suất diễn', value: 'Đêm 1 · 24/10/2026 20:00' },
              { label: 'Danh sách ghế', value: selectedSeats.join(', ') || 'A02, A03' },
              { label: 'Trạng thái mới', value: seatAction },
              { label: 'Lý do ghi nhận', value: seatReason },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                showToast('Đã cập nhật trạng thái giữ/chặn ghế thành công.', 'success');
                setScreen('o-seat-status');
              }}
            >
              Quay lại sơ đồ suất diễn
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-seat-release-confirm')}
            >
              Giải phóng ghế
            </button>
          </div>
        </div>
      )}

      {/* 20. o-seat-release-confirm */}
      {activeScreen === 'o-seat-release-confirm' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Đã giải phóng"
          />
          <FigmaContextGrid
            items={[
              { label: 'Suất diễn', value: 'Đêm 1 · 24/10/2026 20:00' },
              { label: 'Ghế được mở bán lại', value: selectedSeats.join(', ') || 'A02, A03' },
            ]}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScreen('o-seat-status')}
          >
            Quay lại sơ đồ suất diễn
          </button>
        </div>
      )}

      {/* 21. o-review-submit */}
      {activeScreen === 'o-review-submit' && (
        <div>
          <FigmaNavyContextBanner
            title={evName || 'Sự kiện mới'}
            subtitle={`${evVenue} · Hồ sơ đang xét duyệt mở bán`}
            badge={isCreatingNew ? 'Bản nháp mới' : (currentEvent?.status === 'PUBLISHED' ? 'Đang mở bán' : 'Chờ duyệt')}
            image={evPoster}
          />
          <FigmaContextGrid
            items={[
              { label: 'Sự kiện & địa điểm', value: `${evName || 'Chưa đặt tên sự kiện'} · ${evVenue}` },
              { label: 'Sơ đồ & suất diễn', value: `${evLayout} · ${sessName || 'Suất 1 · Khai mạc'}` },
              { label: 'Cấu hình vé', value: `Standard (${stdPrice}) · VIP (${vipPrice})` },
              { label: 'Giấy phép biểu diễn', value: 'GPBD_SoVanHoa_2026.pdf · Đã đính kèm' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('GPBD_SoVanHoa_2026.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!evName.trim()) {
                  showToast('Vui lòng nhập tên sự kiện trước khi gửi duyệt.', 'warning');
                  setScreen('o-event-edit');
                  return;
                }
                const targetId = selectedEventId || createEvent({
                  name: evName,
                  orgName: state.orgOnboarding?.orgName || 'Ánh Trăng Events',
                  venueName: evVenue,
                  layoutName: evLayout,
                  category: evCategory,
                  poster: evPoster,
                  status: 'DRAFT',
                  sessions: [
                    {
                      id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
                      name: sessName || 'Suất 1 · Khai mạc',
                      time: sessTime || '28/11/2026 · 20:00 – 23:00',
                      saleWindow: sessSaleWindow || '01/11/2026 09:00 → 28/11/2026 19:30',
                      gates: sessGates || 'Cổng chính G1, Cổng VIP G2',
                      status: 'ACTIVE',
                    },
                  ],
                  ticketTiers: [
                    { id: `tt-1`, name: 'Standard', price: stdPrice, quota: 50, sold: 0 },
                    { id: `tt-2`, name: 'VIP', price: vipPrice, quota: 20, sold: 0 },
                    { id: `tt-3`, name: 'COMP', price: '0đ', quota: 10, sold: 0 },
                  ],
                  totalRevenue: '0đ',
                  ticketsSold: 0,
                  totalTickets: 80,
                });
                setSelectedEventId(targetId);
                submitEventForReview(targetId, {
                  name: evName,
                  venueName: evVenue,
                  layoutName: evLayout,
                  category: evCategory,
                  poster: evPoster,
                  sessions: [
                    {
                      id: (currentEvent?.sessions?.[0]?.id || "sess-1"),
                      name: sessName || 'Suất 1 · Khai mạc',
                      time: sessTime || '28/11/2026 · 20:00 – 23:00',
                      saleWindow: sessSaleWindow || '01/11/2026 09:00 → 28/11/2026 19:30',
                      gates: sessGates || 'Cổng chính G1, Cổng VIP G2',
                      status: 'ACTIVE',
                    },
                  ],
                  ticketTiers: [
                    { id: `tt-1`, name: 'Standard', price: stdPrice, quota: 50, sold: 0 },
                    { id: `tt-2`, name: 'VIP', price: vipPrice, quota: 20, sold: 0 },
                    { id: `tt-3`, name: 'COMP', price: '0đ', quota: 10, sold: 0 },
                  ],
                });
                setIsCreatingNew(false);
                showToast(`Đã gửi hồ sơ "${evName}" cho Admin kiểm duyệt thành công!`, 'success');
                setScreen('o-event-pending');
              }}
            >
              Gửi duyệt sự kiện
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-seat-pricing')}
            >
              ← Quay lại chỉnh sửa ghế & vé
            </button>
          </div>
        </div>
      )}

      {/* 22. o-event-pending */}
      {activeScreen === 'o-event-pending' && (
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
            Đã gửi hồ sơ sự kiện "{evName || 'Sự kiện mới'}" chờ Admin phê duyệt
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Sự kiện đã được đẩy sang hàng đợi xét duyệt của Ban quản trị Tickey. Admin sẽ đối chiếu giấy phép biểu diễn, địa điểm và cấu hình vé trước khi kích hoạt mở bán.
          </div>
          <span className="badge badge-warning" style={{ marginBottom: 18 }}>
            Chờ duyệt mở bán
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/admin/events?screen=a-event-review&queueId=ae-${selectedEventId}`)}
            >
              Chuyển sang trang Admin kiểm duyệt sự kiện này →
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-events')}>
              Về danh sách sự kiện Org
            </button>
          </div>
        </div>
      )}

      {/* 23. o-cancel */}
      {activeScreen === 'o-cancel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Yêu cầu hủy sự kiện
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Sự kiện yêu cầu hủy</label>
                <input className="form-input" readOnly value="Đêm nhạc Mùa Thu (2 suất · 214 vé đã bán)" />
              </div>
              <div>
                <label className="form-label">Lý do hủy sự kiện</label>
                <input
                  className="form-input"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Phương án hoàn tiền khách hàng</label>
                <input
                  className="form-input"
                  value={cancelRefundPlan}
                  onChange={(e) => setCancelRefundPlan(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Biên bản / Công văn đính kèm</label>
                <input
                  className="form-input"
                  value={cancelDoc}
                  onChange={(e) => setCancelDoc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    requestEventCancellation(selectedEventId, cancelReason, cancelRefundPlan);
                    showToast('Đã gửi yêu cầu hủy sự kiện tới Admin (cần 2 Admin phê duyệt).', 'warning');
                    setScreen('o-cancel-pending');
                  }}
                >
                  Gửi yêu cầu hủy sự kiện
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-event-detail')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 24. o-cancel-pending */}
      {activeScreen === 'o-cancel-pending' && (
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
            Đã gửi yêu cầu hủy sự kiện
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 500, marginBottom: 14, lineHeight: 1.5 }}>
            Yêu cầu hủy Đêm nhạc Mùa Thu đang chờ quy trình phê duyệt kép (Dual Control) từ 2 Admin trước khi kích hoạt hoàn tiền hàng loạt.
          </div>
          <span className="badge badge-warning" style={{ marginBottom: 18 }}>
            Chờ phê duyệt hủy · AP-015
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('o-events')}>
            Danh sách sự kiện
          </button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Hồ sơ sự kiện"
        />
      )}
    </div>
  );
}
