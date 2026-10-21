import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StaffItem {
  id: string;
  name: string;
  email: string;
  role: string;
  assignment: string;
  status: string;
}

export interface GateDevice {
  id: string;
  name: string;
  staff: string;
  status: string;
}

export interface GateItem {
  id: string;
  name: string;
  zones: string[];
  devices: GateDevice[];
  scannedCount: number;
  totalExpected: number;
}

export interface OrderItem {
  id: string;
  customer: string;
  email: string;
  event: string;
  tier: string;
  quantity: number;
  total: string;
  paymentMethod: string;
  time: string;
  status: string;
}

export interface PayoutItem {
  id: string;
  organizer: string;
  eventName: string;
  grossAmount: string;
  feeAmount: string;
  netPayout: string;
  bankInfo: string;
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'COMPLETED';
  createdAt?: string;
}

export interface ReportItem {
  id: string;
  customer: string;
  session: string;
  topic: string;
  content: string;
  status: 'Chờ phản hồi' | 'Đã giải quyết' | 'Đã phản hồi';
  time: string;
  replies?: { sender: string; text: string; time: string }[];
}

export interface DisputeItem {
  id: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  eventName: string;
  issue: string;
  submittedAt: string;
  status: 'OPEN' | 'RESOLVED' | 'IN_PROGRESS';
  resolutionNote?: string;
  replies?: { sender: string; text: string; time: string }[];
}

export interface EventItem {
  id: string;
  name: string;
  orgName: string;
  venueId?: string;
  venueName: string;
  layoutId?: string;
  layoutName: string;
  category: string;
  poster?: string | null;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCEL_REQUESTED' | 'CANCELLED' | 'REJECTED';
  rejectionReason?: string;
  cancellationReason?: string;
  sessions: {
    id: string;
    name: string;
    time: string;
    saleWindow?: string;
    gates?: string;
    status: 'ACTIVE' | 'PAUSED' | 'SOLD_OUT';
  }[];
  ticketTiers: {
    id: string;
    name: string;
    price: string;
    quota: number;
    sold: number;
  }[];
  totalRevenue?: string;
  ticketsSold?: number;
  totalTickets?: number;
}

export interface FigmaPortalDomainState {
  orgOnboarding: {
    orgName: string;
    taxCode: string;
    email: string;
    phone: string;
    gpkdFile: string;
    cccdFile: string;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'NEED_INFO' | 'REJECTED';
    rejectionReason?: string;
  };
  events: EventItem[];
  venues: {
    id: string;
    name: string;
    city: string;
    address?: string;
    type: string;
    layoutsCount: number;
    status: 'VERIFIED' | 'PENDING';
    documentName?: string;
  }[];
  layouts: {
    id: string;
    name: string;
    venueName: string;
    structure: string;
    totalSeats: string;
    status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  }[];
  seatRowPricing: Record<string, string>;
  seatStatuses: Record<string, 'AVAILABLE' | 'HOLD' | 'BLOCKED' | 'SOLD'>;
  members: {
    id: string;
    name: string;
    email: string;
    role: string;
    scope: string;
    status: 'ACTIVE' | 'INVITED';
  }[];
  staffAssignments: {
    id: string;
    staffName: string;
    sessionName: string;
    gateName: string;
    shift: string;
  }[];
  gates: {
    id: string;
    code: string;
    name: string;
    allowedTiers: string;
    devicesCount: number;
  }[];
  devices: {
    id: string;
    code: string;
    model: string;
    gateCode: string;
    staffName: string;
    status: 'ONLINE' | 'REVOKED';
  }[];
  orders: {
    id: string;
    code: string;
    customerName: string;
    sessionName: string;
    seats: string;
    total: string;
    status: 'PAID' | 'COMP' | 'REFUND_REQUESTED';
  }[];
  compTickets: {
    id: string;
    code: string;
    guestName: string;
    email: string;
    seat: string;
    note: string;
  }[];
  orgBank: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    status: 'VERIFIED' | 'PENDING';
  };
  disputes: {
    id: string;
    code: string;
    orderCode: string;
    topic: string;
    sla: string;
    status: 'OPEN' | 'RESPONDED' | 'RESOLVED';
  }[];
  refunds: {
    id: string;
    code: string;
    orderCode: string;
    customerName: string;
    amount: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED';
  }[];
  adminKycQueue: {
    id: string;
    orgName: string;
    taxCode: string;
    docsCount: number;
    submittedAt: string;
    status: 'PENDING' | 'APPROVED' | 'NEED_INFO' | 'REJECTED';
  }[];
  adminOrgs: {
    id: string;
    name: string;
    taxCode: string;
    eventsCount: number;
    status: 'ACTIVE' | 'SUSPENDED';
  }[];
  adminVenueQueue: {
    id: string;
    venueName: string;
    orgName: string;
    city: string;
    docName: string;
    status: 'PENDING' | 'VERIFIED';
  }[];
  adminEventsQueue: {
    id: string;
    eventName: string;
    orgName: string;
    venueName: string;
    layoutName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  }[];
  adminApprovals: {
    id: string;
    code: string;
    type: string;
    target: string;
    firstAdmin: string;
    secondAdmin?: string;
    status: 'PENDING_2ND' | 'APPROVED_2_OF_2' | 'REJECTED';
  }[];
  adminPayouts: {
    id: string;
    code: string;
    orgName: string;
    settlementCode: string;
    amount: string;
    status: 'PENDING' | 'PAID' | 'CANCELLED';
  }[];
  auditLogs: {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    target: string;
  }[];
}

const initialFigmaState: FigmaPortalDomainState = {
  orgOnboarding: {
    orgName: 'Ánh Trăng Events',
    taxCode: '0312456789',
    email: 'ops@anhtrangevents.vn',
    phone: '0901 234 567',
    gpkdFile: 'GPKD_AnhTrang_2026.pdf · 2.4 MB',
    cccdFile: 'CCCD_Rep_2026.pdf · 1.1 MB',
    status: 'APPROVED',
  },
  events: [
    {
      id: 'ev-1',
      name: 'Đêm nhạc Mùa Thu',
      orgName: 'Ánh Trăng Events',
      venueId: 'v-1',
      venueName: 'Nhà hát Ánh Trăng',
      layoutId: 'l-1',
      layoutName: 'Sơ đồ nhà hát v4 · 80 ghế',
      category: 'Âm nhạc · Biểu diễn nghệ thuật',
      status: 'PENDING',
      sessions: [
        {
          id: 'sess-1',
          name: 'Đêm 1 · Khai màn',
          time: '24/10/2026 · 20:00 – 22:30',
          saleWindow: '01/10/2026 09:00 → 24/10/2026 19:30',
          gates: 'Cổng chính G1, Cổng phụ G2',
          status: 'ACTIVE',
        },
        {
          id: 'sess-2',
          name: 'Đêm 2 · Bế mạc',
          time: '25/10/2026 · 20:00 – 22:30',
          saleWindow: '01/10/2026 09:00 → 25/10/2026 19:30',
          gates: 'Cổng chính G1',
          status: 'ACTIVE',
        },
      ],
      ticketTiers: [
        { id: 'tt-1', name: 'Standard', price: '500.000đ', quota: 50, sold: 34 },
        { id: 'tt-2', name: 'VIP', price: '900.000đ', quota: 20, sold: 18 },
        { id: 'tt-3', name: 'COMP', price: '0đ', quota: 10, sold: 6 },
      ],
      totalRevenue: '33.200.000đ',
      ticketsSold: 58,
      totalTickets: 80,
    },
    {
      id: 'ev-2',
      name: 'Hội thảo Công nghệ AI & Tương lai',
      orgName: 'Ánh Trăng Events',
      venueId: 'v-3',
      venueName: 'Nhà thi đấu Phú Thọ',
      layoutId: 'l-arena',
      layoutName: 'Sơ đồ Arena v2 · 1.400 chỗ',
      category: 'Hội thảo · Công nghệ',
      status: 'PUBLISHED',
      sessions: [
        {
          id: 'sess-ai-1',
          name: 'Phiên toàn thể',
          time: '15/11/2026 · 08:30 – 17:30',
          status: 'ACTIVE',
        },
      ],
      ticketTiers: [
        { id: 'tt-ai-1', name: 'Vé tham dự', price: '250.000đ', quota: 1200, sold: 980 },
        { id: 'tt-ai-2', name: 'Vé VIP Networking', price: '1.200.000đ', quota: 200, sold: 195 },
      ],
      totalRevenue: '479.000.000đ',
      ticketsSold: 1175,
      totalTickets: 1400,
    },
  ],
  venues: [
    {
      id: 'v-1',
      name: 'Nhà hát Ánh Trăng',
      city: 'TP.HCM',
      type: 'Khán phòng · 320 ghế',
      layoutsCount: 2,
      status: 'VERIFIED',
    },
    {
      id: 'v-2',
      name: 'Sân khấu Bến Sông',
      city: 'TP. Thủ Đức',
      type: 'Ngoài trời · 2.500 khách',
      layoutsCount: 1,
      status: 'PENDING',
    },
    {
      id: 'v-3',
      name: 'Nhà thi đấu Phú Thọ',
      city: 'TP.HCM',
      type: 'Arena đa năng · 1.400 ghế',
      layoutsCount: 1,
      status: 'VERIFIED',
    },
  ],
  layouts: [
    {
      id: 'l-1',
      name: 'Sơ đồ nhà hát v4',
      venueName: 'Nhà hát Ánh Trăng',
      structure: '8 hàng × 10 ghế',
      totalSeats: '80 ghế',
      status: 'PUBLISHED',
    },
    {
      id: 'l-2',
      name: 'Sơ đồ nhà hát v3',
      venueName: 'Nhà hát Ánh Trăng',
      structure: '8 hàng × 10 ghế',
      totalSeats: '80 ghế',
      status: 'ARCHIVED',
    },
    {
      id: 'l-3',
      name: 'Sơ đồ khu đứng v1',
      venueName: 'Sân khấu Bến Sông',
      structure: '4 khu đứng (Standing)',
      totalSeats: '2.500 chỗ',
      status: 'DRAFT',
    },
    {
      id: 'l-4',
      name: 'Sơ đồ Arena v1',
      venueName: 'Nhà thi đấu Phú Thọ',
      structure: '4 Khán đài A-B-C-D',
      totalSeats: '1.400 chỗ',
      status: 'PUBLISHED',
    },
  ],
  seatRowPricing: {
    A: 'Standard',
    B: 'Standard',
    C: 'VIP',
    D: 'VIP',
    E: 'Standard',
    F: 'Standard',
    G: 'COMP',
    H: 'Free',
  },
  seatStatuses: {
    A04: 'SOLD',
    A05: 'SOLD',
    B04: 'SOLD',
    B05: 'SOLD',
    C05: 'SOLD',
    E01: 'HOLD',
    E02: 'HOLD',
    H09: 'BLOCKED',
    H10: 'BLOCKED',
  },
  members: [
    {
      id: 'm-1',
      name: 'Nguyễn Phước Lâm',
      email: 'owner@anhtrangevents.vn',
      role: 'Owner',
      scope: 'Toàn bộ workspace',
      status: 'ACTIVE',
    },
    {
      id: 'm-2',
      name: 'Lê Minh Khoa',
      email: 'khoa.le@anhtrangevents.vn',
      role: 'Check-in Lead',
      scope: 'Cổng G1, G2',
      status: 'ACTIVE',
    },
    {
      id: 'm-3',
      name: 'Trần Quốc Bảo',
      email: 'bao.tran@anhtrangevents.vn',
      role: 'Check-in Staff',
      scope: 'Cổng chính G1',
      status: 'INVITED',
    },
  ],
  staffAssignments: [
    {
      id: 'sa-1',
      staffName: 'Lê Minh Khoa',
      sessionName: 'Đêm nhạc Mùa Thu · Đêm 1 (24/10)',
      gateName: 'Cổng phụ G2 · VIP',
      shift: '18:30 – 22:30',
    },
    {
      id: 'sa-2',
      staffName: 'Trần Quốc Bảo',
      sessionName: 'Đêm nhạc Mùa Thu · Đêm 1 (24/10)',
      gateName: 'Cổng chính G1',
      shift: '18:30 – 22:30',
    },
  ],
  gates: [
    {
      id: 'g-1',
      code: 'G1',
      name: 'Cổng chính G1 · Sảnh A',
      allowedTiers: 'Standard, Vé Sinh viên 0đ',
      devicesCount: 2,
    },
    {
      id: 'g-2',
      code: 'G2',
      name: 'Cổng phụ G2 · Lối vào VIP',
      allowedTiers: 'VIP, COMP · Khách mời',
      devicesCount: 1,
    },
  ],
  devices: [
    {
      id: 'd-1',
      code: 'DEV-G1-01',
      model: 'Sunmi V2 Pro · POS',
      gateCode: 'G1',
      staffName: 'Trần Quốc Bảo',
      status: 'ONLINE',
    },
    {
      id: 'd-2',
      code: 'DEV-G1-02',
      model: 'iPhone 15 Pro · Staff App',
      gateCode: 'G1',
      staffName: 'Nguyễn Văn An',
      status: 'ONLINE',
    },
    {
      id: 'd-3',
      code: 'DEV-G2-01',
      model: 'iPad Mini 6 · VIP Scanner',
      gateCode: 'G2',
      staffName: 'Lê Minh Khoa',
      status: 'ONLINE',
    },
  ],
  orders: [
    {
      id: 'o-1',
      code: 'TK-1024',
      customerName: 'Nguyễn Minh Anh',
      sessionName: 'Đêm 1 · 24/10/2026',
      seats: 'C04, C05 (VIP)',
      total: '1.800.000đ',
      status: 'PAID',
    },
    {
      id: 'o-2',
      code: 'TK-1025',
      customerName: 'Trần Hoàng Nam',
      sessionName: 'Đêm 1 · 24/10/2026',
      seats: 'A06, A07 (Standard)',
      total: '1.000.000đ',
      status: 'PAID',
    },
    {
      id: 'o-3',
      code: 'TK-COMP-01',
      customerName: 'Võ Bích Ngọc',
      sessionName: 'Đêm 1 · 24/10/2026',
      seats: 'G01 (COMP)',
      total: '0đ',
      status: 'COMP',
    },
  ],
  compTickets: [
    {
      id: 'c-1',
      code: 'COMP-801',
      guestName: 'Võ Bích Ngọc',
      email: 'ngoc.vo@press.vn',
      seat: 'G01',
      note: 'Báo chí truyền thông',
    },
    {
      id: 'c-2',
      code: 'COMP-802',
      guestName: 'Đặng Quốc Khánh',
      email: 'khanh.dang@sponsor.vn',
      seat: 'G02',
      note: 'Nhà tài trợ Kim Cương',
    },
  ],
  orgBank: {
    bankName: 'Vietcombank · CN TP.HCM',
    accountNumber: '0071001234567',
    accountHolder: 'CONG TY TNHH ANH TRANG EVENTS',
    status: 'VERIFIED',
  },
  disputes: [
    {
      id: 'dp-1',
      code: 'DP-09',
      orderCode: 'TK-1024',
      topic: 'Báo lỗi quét mã QR tại Cổng G1',
      sla: 'Còn 4 giờ',
      status: 'OPEN',
    },
    {
      id: 'dp-2',
      code: 'DP-12',
      orderCode: 'TK-1028',
      topic: 'Phản ánh tầm nhìn ghế Hàng E',
      sla: 'Còn 12 giờ',
      status: 'RESPONDED',
    },
  ],
  refunds: [
    {
      id: 'rf-1',
      code: 'RF-024',
      orderCode: 'TK-1024',
      customerName: 'Nguyễn Minh Anh',
      amount: '1.800.000đ',
      reason: 'Đổi lịch công tác trước 96h',
      status: 'PENDING',
    },
    {
      id: 'rf-2',
      code: 'RF-019',
      orderCode: 'TK-1012',
      customerName: 'Lê Thanh Tùng',
      amount: '500.000đ',
      reason: 'Đặt trùng suất diễn',
      status: 'TRANSFERRED',
    },
  ],
  adminKycQueue: [
    {
      id: 'kyc-1',
      orgName: 'Sóng Việt Events',
      taxCode: '0318899221',
      docsCount: 2,
      submittedAt: '21/10/2026 · 08:30',
      status: 'PENDING',
    },
    {
      id: 'kyc-2',
      orgName: 'Ánh Trăng Events',
      taxCode: '0312456789',
      docsCount: 2,
      submittedAt: '10/10/2026 · 14:20',
      status: 'APPROVED',
    },
  ],
  adminOrgs: [
    {
      id: 'org-1',
      name: 'Ánh Trăng Events',
      taxCode: '0312456789',
      eventsCount: 3,
      status: 'ACTIVE',
    },
    {
      id: 'org-2',
      name: 'Sóng Việt Events',
      taxCode: '0318899221',
      eventsCount: 1,
      status: 'ACTIVE',
    },
  ],
  adminVenueQueue: [
    {
      id: 'vq-1',
      venueName: 'Sân khấu Bến Sông',
      orgName: 'Ánh Trăng Events',
      city: 'TP. Thủ Đức',
      docName: 'GiayPhepSuDungMatBang_BenSong.pdf',
      status: 'PENDING',
    },
    {
      id: 'vq-2',
      venueName: 'Nhà hát Ánh Trăng',
      orgName: 'Ánh Trăng Events',
      city: 'TP.HCM',
      docName: 'GPKD_NhaHat_AnhTrang.pdf',
      status: 'VERIFIED',
    },
  ],
  adminEventsQueue: [
    {
      id: 'ae-1',
      eventName: 'Đêm nhạc Mùa Thu',
      orgName: 'Ánh Trăng Events',
      venueName: 'Nhà hát Ánh Trăng',
      layoutName: 'Sơ đồ nhà hát v4',
      status: 'APPROVED',
    },
    {
      id: 'ae-2',
      eventName: 'Hội thảo Công nghệ AI',
      orgName: 'Ánh Trăng Events',
      venueName: 'Nhà thi đấu Phú Thọ',
      layoutName: 'Sơ đồ Arena v2',
      status: 'APPROVED',
    },
  ],
  adminApprovals: [
    {
      id: 'ap-1',
      code: 'AP-014',
      type: 'Giải ngân chi trả > 50M',
      target: 'PO-8821 · 64.200.000đ',
      firstAdmin: 'admin-ops@tickey.vn',
      status: 'PENDING_2ND',
    },
    {
      id: 'ap-2',
      code: 'AP-015',
      type: 'Hủy sự kiện & Hoàn hàng loạt',
      target: 'Đêm nhạc Mùa Thu · 214 vé',
      firstAdmin: 'admin-ops@tickey.vn',
      status: 'PENDING_2ND',
    },
    {
      id: 'ap-3',
      code: 'AP-016',
      type: 'Tạm giữ quỹ đối soát',
      target: 'Sóng Việt Events · 14 ngày',
      firstAdmin: 'admin-risk@tickey.vn',
      status: 'PENDING_2ND',
    },
  ],
  adminPayouts: [
    {
      id: 'po-1',
      code: 'PO-8821',
      orgName: 'Ánh Trăng Events',
      settlementCode: 'STL-2026-10A',
      amount: '64.200.000đ',
      status: 'PENDING',
    },
    {
      id: 'po-2',
      code: 'PO-8790',
      orgName: 'Ánh Trăng Events',
      settlementCode: 'STL-2026-09B',
      amount: '82.500.000đ',
      status: 'PAID',
    },
  ],
  auditLogs: [
    {
      id: 'al-1',
      timestamp: '21/10/2026 11:20:05',
      actor: 'admin-ops@tickey.vn',
      action: 'Ký duyệt lớp 1 (Dual Control)',
      target: 'Phiếu AP-014 · Giải ngân PO-8821',
    },
    {
      id: 'al-2',
      timestamp: '21/10/2026 10:42:18',
      actor: 'owner@anhtrangevents.vn',
      action: 'Phát hành phiên bản sơ đồ ghế',
      target: 'Nhà hát Ánh Trăng · Sơ đồ nhà hát v4',
    },
    {
      id: 'al-3',
      timestamp: '21/10/2026 09:15:00',
      actor: 'admin-kyc@tickey.vn',
      action: 'Xác minh pháp lý địa điểm',
      target: 'Nhà hát Ánh Trăng (v-1)',
    },
  ],
};

interface MockStoreState {
  state: FigmaPortalDomainState;
  updateOrgOnboarding: (patch: Partial<FigmaPortalDomainState['orgOnboarding']>) => void;
  submitOrgKyc: (
    gpkdFile: string,
    cccdFile: string,
    orgDetails?: { orgName?: string; taxCode?: string; email?: string; phone?: string },
  ) => void;
  createVenue: (venue: {
    name: string;
    city: string;
    address?: string;
    type: string;
    documentName?: string;
  }) => void;
  deleteVenue: (venueId: string) => void;
  submitVenueVerification: (venueId: string, docName: string) => void;
  publishLayout: (layoutId: string) => void;
  updateTicketTier: (tierId: string, patch: { price: string }) => void;
  applySeatRowTier: (rows: string[], tier: string) => void;
  updateSeatStatus: (
    seats: string[],
    status: 'AVAILABLE' | 'HOLD' | 'BLOCKED' | 'SOLD',
  ) => void;
  createEvent: (event: Omit<EventItem, 'id'>) => string;
  updateEvent: (eventId: string, patch: Partial<EventItem>) => void;
  submitEventForReview: (eventId: string, patch?: Partial<EventItem>) => void;
  reviewAdminEvent: (eventQueueId: string, approve: boolean, reason?: string) => void;
  requestEventCancellation: (eventId: string, reason: string, refundPlan?: string) => void;
  inviteMember: (member: {
    name: string;
    email: string;
    role: string;
    scope: string;
    status?: 'ACTIVE' | 'INVITED';
  }) => void;
  assignStaffShift: (assignment: {
    staffName: string;
    sessionName: string;
    gateName: string;
    shift: string;
  }) => void;
  createGate: (data: { code?: string; name: string; allowedTiers: string }) => string;
  updateGate: (gateId: string, patch: { name: string; allowedTiers: string }) => void;
  createDevice: (data: { code?: string; model: string; gateCode: string; staffName: string }) => string;
  revokeDevice: (deviceId: string) => void;
  reactivateDevice: (deviceId: string) => void;
  issueCompTicket: (data: {
    guestName?: string;
    customer?: string;
    email: string;
    seat?: string;
    event?: string;
    tier?: string;
    quantity?: number;
    note?: string;
  }) => { id: string };
  importCompCsv: () => void;
  requestBankChange: (bankName: string, accountNumber: string, accountHolder: string) => void;
  respondDispute: (disputeId: string, reply: string) => void;
  reviewOrgRefund: (refundId: string, approve: boolean) => void;
  reviewAdminKyc: (
    kycId: string,
    status: 'APPROVED' | 'NEED_INFO' | 'REJECTED',
    note?: string,
  ) => void;
  updateAdminOrgStatus: (orgId: string, status: 'ACTIVE' | 'SUSPENDED') => void;
  reviewAdminVenue: (venueQueueId: string, verified: boolean) => void;
  signDualApproval: (approvalId: string, approve: boolean) => void;
  resolveAdminDispute: (disputeId: string, verdict: string) => void;
  executeAdminRefundTransfer: (refundId: string) => void;
  processAdminPayout: (payoutId: string, status: 'PAID' | 'CANCELLED') => void;
  approveAdminBank: () => void;
  runAdminReconciliationImport: (fileName: string) => void;

  // Legacy fields preserved for any other consumers
  staffList: StaffItem[];
  addStaff: (staff: Omit<StaffItem, 'id'>) => void;
  updateStaff: (id: string, updates: Partial<StaffItem>) => void;
  gates: GateItem[];
  addDeviceToGate: (gateId: string, device: Omit<GateDevice, 'id'>) => void;
  orders: OrderItem[];
  payouts: PayoutItem[];
  requestPayout: (data: {
    amount: number;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    note?: string;
    organizer?: string;
    eventName?: string;
  }) => { id: string };
  reports: ReportItem[];
  disputes: DisputeItem[];
}

export const useMockStore = create<MockStoreState>()(
  persist(
    (set) => ({
      state: initialFigmaState,

      updateOrgOnboarding: (patch) =>
        set((curr) => ({
          state: {
            ...curr.state,
            orgOnboarding: { ...curr.state.orgOnboarding, ...patch },
          },
        })),

      submitOrgKyc: (gpkdFile, cccdFile, orgDetails) =>
        set((curr) => {
          const orgName = orgDetails?.orgName || curr.state.orgOnboarding.orgName || 'Ánh Trăng Events';
          const taxCode = orgDetails?.taxCode || curr.state.orgOnboarding.taxCode || '0312456789';
          const existingKyc = curr.state.adminKycQueue.find((k) => k.orgName === orgName);
          const kycId = existingKyc ? existingKyc.id : `kyc-${Date.now()}`;
          const updatedKycItem = {
            id: kycId,
            orgName,
            taxCode,
            docsCount: 2,
            submittedAt: 'Vừa xong',
            status: 'PENDING' as const,
          };
          const nextQueue = existingKyc
            ? curr.state.adminKycQueue.map((k) => (k.id === kycId ? updatedKycItem : k))
            : [updatedKycItem, ...curr.state.adminKycQueue];

          const orgExists = curr.state.adminOrgs.some((o) => o.name === orgName);
          const nextOrgs = orgExists
            ? curr.state.adminOrgs
            : [
                ...curr.state.adminOrgs,
                {
                  id: `org-${Date.now()}`,
                  name: orgName,
                  taxCode,
                  eventsCount: 0,
                  status: 'ACTIVE' as const,
                },
              ];

          return {
            state: {
              ...curr.state,
              orgOnboarding: {
                ...curr.state.orgOnboarding,
                ...orgDetails,
                gpkdFile,
                cccdFile,
                status: 'PENDING',
                rejectionReason: undefined,
              },
              adminKycQueue: nextQueue,
              adminOrgs: nextOrgs,
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Nộp hồ sơ xác minh KYC doanh nghiệp',
                  target: `${orgName} (MST: ${taxCode})`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      createVenue: (venue) =>
        set((curr) => {
          const newVenueId = `v-${Date.now()}`;
          const newVenue = {
            id: newVenueId,
            name: venue.name,
            city: venue.city,
            address: venue.address || '',
            type: venue.type,
            layoutsCount: 0,
            status: 'PENDING' as const,
            documentName: venue.documentName || 'giay-phep-dia-diem.pdf',
          };
          const newVenueQueueItem = {
            id: `vq-${newVenueId}`,
            venueName: venue.name,
            orgName: curr.state.orgOnboarding.orgName || 'Ánh Trăng Events',
            city: venue.city,
            docName: venue.documentName || 'giay-phep-dia-diem.pdf',
            status: 'PENDING' as const,
          };

          return {
            state: {
              ...curr.state,
              venues: [newVenue, ...curr.state.venues],
              adminVenueQueue: [newVenueQueueItem, ...curr.state.adminVenueQueue],
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Tạo địa điểm mới & gửi hồ sơ xác minh',
                  target: `${venue.name} · ${venue.city}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      deleteVenue: (venueId) =>
        set((curr) => {
          const target = curr.state.venues.find((v) => v.id === venueId);
          return {
            state: {
              ...curr.state,
              venues: curr.state.venues.filter((v) => v.id !== venueId),
              adminVenueQueue: curr.state.adminVenueQueue.filter((q) => q.venueName !== target?.name),
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Xóa địa điểm',
                  target: target ? `${target.name} · ${target.city}` : venueId,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      submitVenueVerification: (venueId, docName) =>
        set((curr) => {
          const targetVenue = curr.state.venues.find((v) => v.id === venueId);
          const venueName = targetVenue ? targetVenue.name : 'Địa điểm';
          const existingQueue = curr.state.adminVenueQueue.find((vq) => vq.venueName === venueName);
          const vqId = existingQueue ? existingQueue.id : `vq-${venueId}`;
          const queueItem = {
            id: vqId,
            venueName,
            orgName: curr.state.orgOnboarding.orgName || 'Ánh Trăng Events',
            city: targetVenue?.city || 'TP.HCM',
            docName,
            status: 'PENDING' as const,
          };

          return {
            state: {
              ...curr.state,
              venues: curr.state.venues.map((v) =>
                v.id === venueId ? { ...v, documentName: docName, status: 'PENDING' } : v,
              ),
              adminVenueQueue: existingQueue
                ? curr.state.adminVenueQueue.map((vq) => (vq.id === vqId ? queueItem : vq))
                : [queueItem, ...curr.state.adminVenueQueue],
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Gửi bổ sung hồ sơ xác minh địa điểm',
                  target: `${venueName} (${docName})`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      publishLayout: (layoutId) =>
        set((curr) => {
          const target = curr.state.layouts.find((l) => l.id === layoutId);
          return {
            state: {
              ...curr.state,
              layouts: curr.state.layouts.map((l) =>
                l.id === layoutId ? { ...l, status: 'PUBLISHED' } : l,
              ),
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Phát hành phiên bản sơ đồ ghế',
                  target: `${target?.venueName || 'Địa điểm'} · ${target?.name || 'Sơ đồ'}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      updateTicketTier: () =>
        set((curr) => ({
          state: { ...curr.state },
        })),

      applySeatRowTier: (rows, tier) =>
        set((curr) => {
          const nextMap = { ...curr.state.seatRowPricing };
          rows.forEach((r) => {
            nextMap[r] = tier;
          });
          return {
            state: {
              ...curr.state,
              seatRowPricing: nextMap,
            },
          };
        }),

      updateSeatStatus: (seats, status) =>
        set((curr) => {
          const nextSeats = { ...curr.state.seatStatuses };
          seats.forEach((s) => {
            nextSeats[s] = status;
          });
          return {
            state: {
              ...curr.state,
              seatStatuses: nextSeats,
            },
          };
        }),

      createEvent: (eventData) => {
        const newId = `ev-${Date.now()}`;
        const newEvent: EventItem = {
          ...eventData,
          id: newId,
          status: 'DRAFT',
        };
        set((curr) => ({
          state: {
            ...curr.state,
            events: [newEvent, ...curr.state.events],
          },
        }));
        return newId;
      },

      updateEvent: (eventId, patch) =>
        set((curr) => ({
          state: {
            ...curr.state,
            events: curr.state.events.map((e) =>
              e.id === eventId ? { ...e, ...patch } : e,
            ),
          },
        })),

      submitEventForReview: (eventId, patch) =>
        set((curr) => {
          const ev = curr.state.events.find((e) => e.id === eventId);
          const evName = patch?.name?.trim() || ev?.name || 'Sự kiện mới';
          const orgName = ev?.orgName || curr.state.orgOnboarding.orgName || 'Ánh Trăng Events';
          const venueName = patch?.venueName || ev?.venueName || 'Nhà hát Ánh Trăng';
          const layoutName = patch?.layoutName || ev?.layoutName || 'Sơ đồ nhà hát v4';

          const queueId = `ae-${eventId}`;
          const queueItem = {
            id: queueId,
            eventName: evName,
            orgName,
            venueName,
            layoutName,
            status: 'PENDING' as const,
          };

          const nextEvents = ev
            ? curr.state.events.map((e) =>
                e.id === eventId
                  ? { ...e, ...patch, name: evName, status: 'PENDING' as const, rejectionReason: undefined }
                  : e,
              )
            : [
                {
                  id: eventId,
                  name: evName,
                  orgName,
                  venueName,
                  layoutName,
                  category: patch?.category || 'Âm nhạc',
                  poster: patch?.poster || null,
                  status: 'PENDING' as const,
                  sessions: patch?.sessions || [],
                  ticketTiers: patch?.ticketTiers || [],
                },
                ...curr.state.events,
              ];

          const otherQueues = curr.state.adminEventsQueue.filter(
            (q) => q.id !== queueId && q.eventName !== evName,
          );
          const nextQueue = [queueItem, ...otherQueues];

          return {
            state: {
              ...curr.state,
              events: nextEvents,
              adminEventsQueue: nextQueue,
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Gửi xét duyệt mở bán sự kiện',
                  target: `${evName} (${orgName})`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      reviewAdminEvent: (eventQueueId, approve, reason) =>
        set((curr) => {
          const queueItem = curr.state.adminEventsQueue.find((q) => q.id === eventQueueId);
          const evName = queueItem?.eventName;

          return {
            state: {
              ...curr.state,
              adminEventsQueue: curr.state.adminEventsQueue.map((q) =>
                q.id === eventQueueId
                  ? { ...q, status: approve ? 'APPROVED' : 'REJECTED' }
                  : q,
              ),
              events: curr.state.events.map((e) =>
                e.name === evName || e.id === eventQueueId.replace('ae-', '')
                  ? {
                      ...e,
                      status: approve ? 'PUBLISHED' : 'REJECTED',
                      rejectionReason: !approve ? reason : undefined,
                    }
                  : e,
              ),
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'admin-events@tickey.vn',
                  action: approve ? 'Phê duyệt mở bán sự kiện' : 'Từ chối mở bán sự kiện',
                  target: `${evName || eventQueueId} · ${approve ? 'Đã duyệt' : reason || 'Chưa đạt chuẩn'}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      requestEventCancellation: (eventId, reason) =>
        set((curr) => {
          const ev = curr.state.events.find((e) => e.id === eventId);
          const evName = ev ? ev.name : 'Đêm nhạc Mùa Thu';
          const approvalTicketId = `ap-cancel-${Date.now()}`;
          const approvalCode = `AP-${Math.floor(100 + Math.random() * 900)}`;

          const newApproval = {
            id: approvalTicketId,
            code: approvalCode,
            type: 'Hủy sự kiện & Hoàn hàng loạt',
            target: `${evName} · ${reason}`,
            firstAdmin: 'admin-ops@tickey.vn',
            status: 'PENDING_2ND' as const,
          };

          return {
            state: {
              ...curr.state,
              events: curr.state.events.map((e) =>
                e.id === eventId ? { ...e, status: 'CANCEL_REQUESTED', cancellationReason: reason } : e,
              ),
              adminApprovals: [newApproval, ...curr.state.adminApprovals],
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'owner@tickey.vn',
                  action: 'Gửi yêu cầu hủy sự kiện (Tạo phiếu duyệt kép)',
                  target: `${evName} · ${reason}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      inviteMember: (member) =>
        set((curr) => ({
          state: {
            ...curr.state,
            members: [
              {
                id: `m-${curr.state.members.length + 1}`,
                name: member.name,
                email: member.email,
                role: member.role,
                scope: member.scope,
                status: member.status || 'ACTIVE',
              },
              ...curr.state.members,
            ],
          },
        })),

      assignStaffShift: (assignment) =>
        set((curr) => ({
          state: {
            ...curr.state,
            staffAssignments: [
              {
                id: `sa-${curr.state.staffAssignments.length + 1}`,
                ...assignment,
              },
              ...curr.state.staffAssignments,
            ],
          },
        })),

      createGate: (data) => {
        const newId = `g-${Date.now()}`;
        set((curr) => {
          const nextIndex = curr.state.gates.length + 1;
          const code = data.code || `G${nextIndex}`;
          return {
            state: {
              ...curr.state,
              gates: [
                ...curr.state.gates,
                {
                  id: newId,
                  code,
                  name: data.name,
                  allowedTiers: data.allowedTiers || 'Tất cả hạng vé',
                  devicesCount: 0,
                },
              ],
            },
          };
        });
        return newId;
      },

      updateGate: (gateId, patch) =>
        set((curr) => ({
          state: {
            ...curr.state,
            gates: curr.state.gates.map((g) => (g.id === gateId ? { ...g, ...patch } : g)),
          },
        })),

      createDevice: (data) => {
        const newId = `d-${Date.now()}`;
        set((curr) => {
          const nextIndex = curr.state.devices.length + 1;
          const code = data.code || `DEV-${data.gateCode || 'G1'}-0${nextIndex}`;
          const nextDevices = [
            ...curr.state.devices,
            {
              id: newId,
              code,
              model: data.model,
              gateCode: data.gateCode,
              staffName: data.staffName || 'Chưa gán',
              status: 'ONLINE' as const,
              appVersion: 'v2.4.0 (Build 88)',
              ipAddress: `192.168.1.1${nextIndex}`,
              lastSync: 'Vừa kết nối',
            },
          ];
          const nextGates = curr.state.gates.map((g) =>
            g.code === data.gateCode ? { ...g, devicesCount: (g.devicesCount || 0) + 1 } : g,
          );
          return {
            state: {
              ...curr.state,
              devices: nextDevices,
              gates: nextGates,
            },
          };
        });
        return newId;
      },

      revokeDevice: (deviceId) =>
        set((curr) => ({
          state: {
            ...curr.state,
            devices: curr.state.devices.map((d) =>
              d.id === deviceId ? { ...d, status: 'REVOKED' } : d,
            ),
          },
        })),

      reactivateDevice: (deviceId) =>
        set((curr) => ({
          state: {
            ...curr.state,
            devices: curr.state.devices.map((d) =>
              d.id === deviceId ? { ...d, status: 'ONLINE', lastSync: 'Vừa kết nối lại' } : d,
            ),
          },
        })),

      issueCompTicket: (data) => {
        const newId = `COMP-80${Math.floor(10 + Math.random() * 89)}`;
        set((curr) => ({
          state: {
            ...curr.state,
            compTickets: [
              {
                id: `c-${curr.state.compTickets.length + 1}`,
                code: newId,
                guestName: data.guestName || data.customer || 'Khách mời VIP',
                email: data.email,
                seat: data.seat || 'G04',
                note: data.note || 'Vé mời BTC',
              },
              ...curr.state.compTickets,
            ],
          },
        }));
        return { id: newId };
      },

      importCompCsv: () =>
        set((curr) => ({
          state: {
            ...curr.state,
            compTickets: [
              {
                id: `c-${Date.now()}-1`,
                code: 'COMP-805',
                guestName: 'Trịnh Gia Huy',
                email: 'huy.trinh@artist.vn',
                seat: 'G07',
                note: 'Nhập từ CSV',
              },
              ...curr.state.compTickets,
            ],
          },
        })),

      requestBankChange: (bankName, accountNumber, accountHolder) =>
        set((curr) => ({
          state: {
            ...curr.state,
            orgBank: {
              bankName,
              accountNumber,
              accountHolder,
              status: 'PENDING',
            },
          },
        })),

      respondDispute: (disputeId) =>
        set((curr) => ({
          state: {
            ...curr.state,
            disputes: curr.state.disputes.map((d) =>
              d.id === disputeId ? { ...d, status: 'RESPONDED' } : d,
            ),
          },
        })),

      reviewOrgRefund: (refundId, approve) =>
        set((curr) => ({
          state: {
            ...curr.state,
            refunds: curr.state.refunds.map((r) =>
              r.id === refundId ? { ...r, status: approve ? 'APPROVED' : 'REJECTED' } : r,
            ),
          },
        })),

      reviewAdminKyc: (kycId, status, note) =>
        set((curr) => {
          const targetKyc = curr.state.adminKycQueue.find((k) => k.id === kycId);
          const orgName = targetKyc ? targetKyc.orgName : 'Ánh Trăng Events';
          const isCurrentOrg = curr.state.orgOnboarding.orgName === orgName;

          const orgExists = curr.state.adminOrgs.some((o) => o.name === orgName);
          const nextOrgs =
            status === 'APPROVED'
              ? orgExists
                ? curr.state.adminOrgs.map((o) => (o.name === orgName ? { ...o, status: 'ACTIVE' as const } : o))
                : [
                    ...curr.state.adminOrgs,
                    {
                      id: `org-${Date.now()}`,
                      name: orgName,
                      taxCode: targetKyc?.taxCode || '0312345678',
                      eventsCount: 0,
                      status: 'ACTIVE' as const,
                    },
                  ]
              : curr.state.adminOrgs;

          return {
            state: {
              ...curr.state,
              adminKycQueue: curr.state.adminKycQueue.map((k) =>
                k.id === kycId ? { ...k, status } : k,
              ),
              adminOrgs: nextOrgs,
              orgOnboarding: isCurrentOrg
                ? {
                    ...curr.state.orgOnboarding,
                    status,
                    rejectionReason: status !== 'APPROVED' ? note : undefined,
                  }
                : curr.state.orgOnboarding,
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'admin-kyc@tickey.vn',
                  action: `Xét duyệt hồ sơ KYC: ${status}`,
                  target: `${orgName} · ${note || 'Hợp lệ'}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      updateAdminOrgStatus: (orgId, status) =>
        set((curr) => ({
          state: {
            ...curr.state,
            adminOrgs: curr.state.adminOrgs.map((o) =>
              o.id === orgId ? { ...o, status } : o,
            ),
          },
        })),

      reviewAdminVenue: (venueQueueId, verified) =>
        set((curr) => {
          const targetQueue = curr.state.adminVenueQueue.find((vq) => vq.id === venueQueueId);
          const venueName = targetQueue ? targetQueue.venueName : '';

          return {
            state: {
              ...curr.state,
              adminVenueQueue: curr.state.adminVenueQueue.map((vq) =>
                vq.id === venueQueueId
                  ? { ...vq, status: verified ? 'VERIFIED' : 'PENDING' }
                  : vq,
              ),
              venues: curr.state.venues.map((v) =>
                v.name === venueName || v.id === venueQueueId.replace('vq-', '')
                  ? { ...v, status: verified ? 'VERIFIED' : 'PENDING' }
                  : v,
              ),
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'admin-kyc@tickey.vn',
                  action: verified ? 'Xác minh hợp lệ địa điểm' : 'Yêu cầu kiểm tra lại địa điểm',
                  target: `${venueName}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      signDualApproval: (approvalId, approve) =>
        set((curr) => {
          const targetApproval = curr.state.adminApprovals.find((ap) => ap.id === approvalId);
          const target = targetApproval ? targetApproval.target : '';
          const isCancelEvent = targetApproval?.type.includes('Hủy sự kiện');
          const isPayout = targetApproval?.type.includes('Giải ngân') || targetApproval?.type.includes('chi trả');

          return {
            state: {
              ...curr.state,
              adminApprovals: curr.state.adminApprovals.map((ap) =>
                ap.id === approvalId
                  ? {
                      ...ap,
                      secondAdmin: 'admin-finance@tickey.vn',
                      status: approve ? 'APPROVED_2_OF_2' : 'REJECTED',
                    }
                  : ap,
              ),
              events: isCancelEvent
                ? curr.state.events.map((e) =>
                    target.includes(e.name)
                      ? { ...e, status: approve ? 'CANCELLED' : 'PUBLISHED' }
                      : e,
                  )
                : curr.state.events,
              adminPayouts: isPayout
                ? curr.state.adminPayouts.map((p) =>
                    target.includes(p.code)
                      ? { ...p, status: approve ? 'PAID' : 'CANCELLED' }
                      : p,
                  )
                : curr.state.adminPayouts,
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'admin-finance@tickey.vn',
                  action: approve ? 'Ký duyệt lớp 2 (Dual Control Thành công)' : 'Từ chối duyệt lớp 2',
                  target: `${targetApproval?.code || approvalId} · ${target}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      resolveAdminDispute: (disputeId) =>
        set((curr) => ({
          state: {
            ...curr.state,
            disputes: curr.state.disputes.map((d) =>
              d.id === disputeId ? { ...d, status: 'RESOLVED' } : d,
            ),
          },
        })),

      executeAdminRefundTransfer: (refundId) =>
        set((curr) => ({
          state: {
            ...curr.state,
            refunds: curr.state.refunds.map((r) =>
              r.id === refundId ? { ...r, status: 'TRANSFERRED' } : r,
            ),
          },
        })),

      processAdminPayout: (payoutId, status) =>
        set((curr) => {
          const target = curr.state.adminPayouts.find((p) => p.id === payoutId);
          return {
            state: {
              ...curr.state,
              adminPayouts: curr.state.adminPayouts.map((p) =>
                p.id === payoutId ? { ...p, status } : p,
              ),
              payouts: curr.payouts.map((p) =>
                p.id === payoutId ? { ...p, status: status === 'PAID' ? 'COMPLETED' : p.status } : p,
              ),
              auditLogs: [
                {
                  id: `al-${Date.now()}`,
                  timestamp: new Date().toLocaleString('vi-VN'),
                  actor: 'admin-finance@tickey.vn',
                  action: status === 'PAID' ? 'Hoàn tất chuyển khoản quyết toán' : 'Hủy lệnh chi trả',
                  target: `${target?.code || payoutId} · ${target?.amount || ''}`,
                },
                ...curr.state.auditLogs,
              ],
            },
          };
        }),

      approveAdminBank: () =>
        set((curr) => ({
          state: {
            ...curr.state,
            orgBank: { ...curr.state.orgBank, status: 'VERIFIED' },
          },
        })),

      runAdminReconciliationImport: (fileName) =>
        set((curr) => ({
          state: {
            ...curr.state,
            auditLogs: [
              {
                id: `al-${Date.now()}`,
                timestamp: new Date().toLocaleString('vi-VN'),
                actor: 'admin-finance@tickey.vn',
                action: 'Đối chiếu sao kê cổng thanh toán',
                target: fileName,
              },
              ...curr.state.auditLogs,
            ],
          },
        })),

      staffList: [],
      addStaff: () => {},
      updateStaff: () => {},
      gates: [],
      addDeviceToGate: () => {},
      orders: [],
      payouts: [
        {
          id: 'po-1',
          organizer: 'Ánh Trăng Events',
          eventName: 'Đêm nhạc Mùa Thu',
          grossAmount: '71.300.000đ',
          feeAmount: '7.100.000đ',
          netPayout: '64.200.000đ',
          bankInfo: 'Vietcombank · CN TP.HCM (0071001234567)',
          status: 'PENDING_FIRST',
        },
      ],
      requestPayout: (data) => {
        const newCode = `PO-${Math.floor(8000 + Math.random() * 999)}`;
        const newId = `po-${Date.now()}`;
        const newPayoutItem: PayoutItem = {
          id: newId,
          organizer: data.organizer || 'Ánh Trăng Events',
          eventName: data.eventName || 'Đêm nhạc Mùa Thu',
          grossAmount: `${(data.amount * 1.1).toLocaleString('vi-VN')}đ`,
          feeAmount: `${(data.amount * 0.1).toLocaleString('vi-VN')}đ`,
          netPayout: `${data.amount.toLocaleString('vi-VN')}đ`,
          bankInfo: `${data.bankName} (${data.accountNumber})`,
          status: 'PENDING_FIRST',
          createdAt: new Date().toLocaleString('vi-VN'),
        };

        const adminPayoutItem = {
          id: newId,
          code: newCode,
          orgName: data.organizer || 'Ánh Trăng Events',
          settlementCode: `STL-2026-${Math.floor(10 + Math.random() * 80)}`,
          amount: `${data.amount.toLocaleString('vi-VN')}đ`,
          status: 'PENDING' as const,
        };

        const newApprovalItem =
          data.amount >= 50000000
            ? {
                id: `ap-po-${Date.now()}`,
                code: `AP-${Math.floor(100 + Math.random() * 900)}`,
                type: 'Giải ngân chi trả > 50M',
                target: `${newCode} · ${data.amount.toLocaleString('vi-VN')}đ`,
                firstAdmin: 'admin-ops@tickey.vn',
                status: 'PENDING_2ND' as const,
              }
            : null;

        set((curr) => ({
          payouts: [newPayoutItem, ...curr.payouts],
          state: {
            ...curr.state,
            adminPayouts: [adminPayoutItem, ...curr.state.adminPayouts],
            adminApprovals: newApprovalItem
              ? [newApprovalItem, ...curr.state.adminApprovals]
              : curr.state.adminApprovals,
            auditLogs: [
              {
                id: `al-${Date.now()}`,
                timestamp: new Date().toLocaleString('vi-VN'),
                actor: 'owner@tickey.vn',
                action: 'Gửi yêu cầu quyết toán doanh thu',
                target: `${newCode} · ${data.amount.toLocaleString('vi-VN')}đ`,
              },
              ...curr.state.auditLogs,
            ],
          },
        }));

        return { id: newCode };
      },
      reports: [],
      disputes: [],
    }),
    {
      name: 'tickey-portal-figma-store-v4',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<MockStoreState> | undefined;
        const persistedDomain = persisted?.state;
        return {
          ...currentState,
          ...persisted,
          state: {
            ...initialFigmaState,
            ...(persistedDomain || {}),
            events:
              persistedDomain?.events && persistedDomain.events.length > 0
                ? persistedDomain.events
                : initialFigmaState.events,
            venues:
              persistedDomain?.venues && persistedDomain.venues.length > 0
                ? persistedDomain.venues
                : initialFigmaState.venues,
            adminEventsQueue:
              persistedDomain?.adminEventsQueue && persistedDomain.adminEventsQueue.length > 0
                ? persistedDomain.adminEventsQueue
                : initialFigmaState.adminEventsQueue,
            adminKycQueue:
              persistedDomain?.adminKycQueue && persistedDomain.adminKycQueue.length > 0
                ? persistedDomain.adminKycQueue
                : initialFigmaState.adminKycQueue,
            adminApprovals:
              persistedDomain?.adminApprovals && persistedDomain.adminApprovals.length > 0
                ? persistedDomain.adminApprovals
                : initialFigmaState.adminApprovals,
            adminPayouts:
              persistedDomain?.adminPayouts && persistedDomain.adminPayouts.length > 0
                ? persistedDomain.adminPayouts
                : initialFigmaState.adminPayouts,
          },
        };
      },
    },
  ),
);

export function exportToCsv(
  arg1: string | ReadonlyArray<object>,
  arg2: string[] | string,
  arg3?: (string | number)[][],
) {
  let filename: string;
  let headers: string[];
  let rows: (string | number)[][];

  if (typeof arg1 === 'string' && Array.isArray(arg2)) {
    filename = arg1;
    headers = arg2;
    rows = arg3 ?? [];
  } else if (Array.isArray(arg1) && typeof arg2 === 'string') {
    filename = arg2;
    const first = arg1[0] as Record<string, unknown> | undefined;
    headers = first ? Object.keys(first) : [];
    rows = arg1.map((item) => {
      const rec = item as Record<string, unknown>;
      return headers.map((k) => String(rec[k] ?? ''));
    });
  } else {
    return;
  }
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows: string[] = [];
  csvRows.push(headers.map(escapeCell).join(','));

  for (const row of rows) {
    csvRows.push(row.map(escapeCell).join(','));
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
