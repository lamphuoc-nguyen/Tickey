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

interface MockStoreState {
  staffList: StaffItem[];
  addStaff: (staff: Omit<StaffItem, 'id'>) => void;
  removeStaff: (id: string) => void;
  updateStaff: (id: string, updates: Partial<StaffItem>) => void;

  gates: GateItem[];
  addGate: (gate: Omit<GateItem, 'id' | 'scannedCount'>) => void;
  removeGate: (id: string) => void;
  addDeviceToGate: (gateId: string, device: Omit<GateDevice, 'id'>) => void;

  orders: OrderItem[];
  addOrder: (order: OrderItem) => void;
  issueCompTicket: (data: {
    customer: string;
    email: string;
    event: string;
    tier: string;
    quantity: number;
    note?: string;
  }) => OrderItem;

  payouts: PayoutItem[];
  requestPayout: (data: {
    amount: number;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    note?: string;
    organizer?: string;
    eventName?: string;
  }) => PayoutItem;
  approveFirstPayout: (id: string) => void;
  approveSecondPayout: (id: string) => void;

  reports: ReportItem[];
  replyReport: (id: string, replyText: string, newStatus?: 'Chờ phản hồi' | 'Đã giải quyết' | 'Đã phản hồi') => void;

  disputes: DisputeItem[];
  resolveDispute: (id: string, note?: string) => void;
  replyDispute: (id: string, replyText: string, newStatus?: 'OPEN' | 'RESOLVED' | 'IN_PROGRESS') => void;
}

const initialStaff: StaffItem[] = [
  {
    id: 'STF-01',
    name: 'Lê Minh Khoa',
    email: 'khoa.le@dev.local',
    role: 'Nhân viên soát vé',
    assignment: 'Cổng G1 · Đêm nhạc Mùa Thu',
    status: 'Đang hoạt động',
  },
  {
    id: 'STF-02',
    name: 'Nguyễn Văn An',
    email: 'an.nguyen@dev.local',
    role: 'Thu ngân quầy POS',
    assignment: 'Quầy vé sảnh A',
    status: 'Đang hoạt động',
  },
  {
    id: 'STF-03',
    name: 'Trần Thị Bích',
    email: 'bich.tran@dev.local',
    role: 'Nhân viên soát vé',
    assignment: 'Cổng G2 · Đêm nhạc Mùa Thu',
    status: 'Đã gửi lời mời',
  },
];

const initialGates: GateItem[] = [
  {
    id: 'G1',
    name: 'Cổng chính G1 · Sảnh Mặt Tiền',
    zones: ['Khu VIP', 'Khu Standard (Hàng D - J)'],
    devices: [
      { id: 'DEV-01', name: 'Máy quét cầm tay POS-01', staff: 'Lê Minh Khoa', status: 'Online' },
      { id: 'DEV-02', name: 'Điện thoại Staff Android-02', staff: 'Trần Thị Bích', status: 'Online' },
    ],
    scannedCount: 42,
    totalExpected: 140,
  },
  {
    id: 'G2',
    name: 'Cổng phụ G2 · Lối Vào Tầng 2',
    zones: ['Khu Balcony Tầng 2', 'Khu đứng (Standing)'],
    devices: [
      { id: 'DEV-03', name: 'Máy quét cầm tay POS-03', staff: 'Nguyễn Văn An', status: 'Online' },
    ],
    scannedCount: 22,
    totalExpected: 60,
  },
];

const initialOrders: OrderItem[] = [
  {
    id: 'TK-1024',
    customer: 'Trần Văn Hoàng',
    email: 'hoang.tran@gmail.com',
    event: 'Đêm nhạc Mùa Thu (Đêm 1)',
    tier: 'Khu VIP · Hàng A',
    quantity: 2,
    total: '1.700.000đ',
    paymentMethod: 'Chuyển khoản QR',
    time: '19/10/2026 14:20',
    status: 'Đã thanh toán',
  },
  {
    id: 'TK-1025',
    customer: 'Lê Thị Mai',
    email: 'mai.le@gmail.com',
    event: 'Đêm nhạc Mùa Thu (Đêm 1)',
    tier: 'Khu Standard · Hàng D',
    quantity: 1,
    total: '450.000đ',
    paymentMethod: 'Thẻ ATM nội địa',
    time: '19/10/2026 13:45',
    status: 'Đã thanh toán',
  },
  {
    id: 'TK-1026',
    customer: 'Phạm Minh Đức',
    email: 'duc.pham@gmail.com',
    event: 'Hòa Nhạc Acoustic Bên Sông',
    tier: 'Khu Đứng',
    quantity: 3,
    total: '450.000đ',
    paymentMethod: 'Ví MoMo',
    time: '19/10/2026 11:10',
    status: 'Đã thanh toán',
  },
  {
    id: 'TK-1027',
    customer: 'Ngô Bảo Châu',
    email: 'chau.ngo@gmail.com',
    event: 'Đêm nhạc Mùa Thu (Đêm 2)',
    tier: 'Vé mời Ban Tổ Chức (COMP)',
    quantity: 2,
    total: '0đ',
    paymentMethod: 'Vé mời (COMP)',
    time: '18/10/2026 16:30',
    status: 'Đã cấp vé',
  },
];

const initialPayouts: PayoutItem[] = [
  {
    id: 'PO-014',
    organizer: 'Ánh Trăng Events',
    eventName: 'Indie Soul Acoustic Night',
    grossAmount: '331.600.000 VNĐ',
    feeAmount: '11.600.000 VNĐ (3.5%)',
    netPayout: '320.000.000 VNĐ',
    bankInfo: '0071009876543 · Vietcombank Nam Sài Gòn',
    status: 'PENDING_SECOND',
    createdAt: '19/10/2026 10:15',
  },
  {
    id: 'PO-015',
    organizer: 'Sóng Việt Events',
    eventName: 'Đêm nhạc Mùa Thu (Tạm ứng đợt 1)',
    grossAmount: '518.000.000 VNĐ',
    feeAmount: '18.000.000 VNĐ (3.5%)',
    netPayout: '500.000.000 VNĐ',
    bankInfo: '0071001234567 · Vietcombank TP.HCM',
    status: 'PENDING_FIRST',
    createdAt: '19/10/2026 09:30',
  },
  {
    id: 'PO-011',
    organizer: 'Royal Music Vietnam',
    eventName: 'Hòa nhạc Thính phòng Mùa Hạ',
    grossAmount: '186.400.000 VNĐ',
    feeAmount: '6.400.000 VNĐ (3.5%)',
    netPayout: '180.000.000 VNĐ',
    bankInfo: '19034567890123 · Techcombank Thăng Long',
    status: 'COMPLETED',
    createdAt: '15/10/2026 14:00',
  },
];

const initialReports: ReportItem[] = [
  {
    id: 'RP-018',
    customer: 'Vũ Minh Tuấn',
    session: 'Đêm nhạc Mùa Thu (Đêm 1)',
    topic: 'Yêu cầu đổi chỗ ngồi khu VIP',
    content: 'Tôi muốn đổi từ ghế A-04 sang ghế A-06 do đi cùng bạn bè.',
    status: 'Chờ phản hồi',
    time: '19/10/2026 10:15',
    replies: [],
  },
  {
    id: 'RP-019',
    customer: 'Hoàng Lan Anh',
    session: 'Đêm nhạc Mùa Thu (Đêm 1)',
    topic: 'Hỏi về quy định mang trẻ em',
    content: 'Chương trình có giới hạn độ tuổi không? Trẻ em 5 tuổi có cần mua vé riêng không ạ?',
    status: 'Đã giải quyết',
    time: '18/10/2026 15:30',
    replies: [
      {
        sender: 'Ban Tổ Chức (Ánh Trăng)',
        text: 'Chào bạn Lan Anh, theo quy định trẻ em dưới 6 tuổi không cần mua vé riêng nếu ngồi cùng ghế với bố mẹ. Chúc bạn và bé có trải nghiệm âm nhạc vui vẻ!',
        time: '18/10/2026 16:00',
      },
    ],
  },
];

const initialDisputes: DisputeItem[] = [
  {
    id: 'DS-018',
    customerName: 'Hoàng Minh Đức',
    customerEmail: 'duc.hoang@gmail.com',
    orderId: 'TK-84920',
    eventName: 'Đêm nhạc Mùa Thu - Live in Saigon',
    issue: 'Đã trừ tiền MoMo thành công nhưng chưa nhận được mã vé QR qua email sau 15 phút.',
    submittedAt: '19/10/2026 10:12',
    status: 'OPEN',
    replies: [],
  },
  {
    id: 'DS-019',
    customerName: 'Nguyễn Thị Bích',
    customerEmail: 'bich.nguyen@yahoo.com',
    orderId: 'TK-84905',
    eventName: 'Rock Fest 2026',
    issue: 'Mua nhầm 2 vé khán đài B, muốn đổi sang khán đài A hoặc hỗ trợ hoàn tiền chênh lệch.',
    submittedAt: '18/10/2026 18:30',
    status: 'IN_PROGRESS',
    replies: [
      {
        sender: 'Tickey Admin Hỗ trợ',
        text: 'Đang liên hệ Ban Tổ Chức Rock Fest để hỗ trợ đổi khán đài cho khách hàng.',
        time: '18/10/2026 19:00',
      },
    ],
  },
  {
    id: 'DS-012',
    customerName: 'Trần Văn Cường',
    customerEmail: 'cuong.tran@outlook.com',
    orderId: 'TK-83411',
    eventName: 'Indie Soul Acoustic Night',
    issue: 'Mã vé báo đã check-in tại Gate 1 khi khách chưa tới cổng.',
    submittedAt: '15/10/2026 19:45',
    status: 'RESOLVED',
    resolutionNote: 'Đã kiểm tra lại camera cổng G1 và cấp lại vé QR thay thế cho khách.',
    replies: [
      {
        sender: 'Tickey Admin',
        text: 'Đã gửi lại mã vé QR thay thế qua email cuong.tran@outlook.com. Xin lỗi anh vì sự cố.',
        time: '15/10/2026 20:00',
      },
    ],
  },
];

export const useMockStore = create<MockStoreState>()(
  persist(
    (set, get) => ({
      staffList: initialStaff,
      addStaff: (staff) =>
        set((state) => {
          const nextIndex = state.staffList.length + 1;
          const newId = `STF-${String(nextIndex).padStart(2, '0')}`;
          return {
            staffList: [
              ...state.staffList,
              {
                id: newId,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                assignment: staff.assignment || 'Chưa phân công ca',
                status: staff.status || 'Đã gửi lời mời',
              },
            ],
          };
        }),
      removeStaff: (id) =>
        set((state) => ({
          staffList: state.staffList.filter((s) => s.id !== id),
        })),
      updateStaff: (id, updates) =>
        set((state) => ({
          staffList: state.staffList.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      gates: initialGates,
      addGate: (gate) =>
        set((state) => {
          const nextId = `G${state.gates.length + 1}`;
          return {
            gates: [
              ...state.gates,
              {
                id: nextId,
                name: gate.name,
                zones: gate.zones,
                devices: gate.devices,
                scannedCount: 0,
                totalExpected: gate.totalExpected || 100,
              },
            ],
          };
        }),
      removeGate: (id) =>
        set((state) => ({
          gates: state.gates.filter((g) => g.id !== id),
        })),
      addDeviceToGate: (gateId, device) =>
        set((state) => ({
          gates: state.gates.map((g) => {
            if (g.id !== gateId) return g;
            const devId = `DEV-${String(g.devices.length + 1).padStart(2, '0')}`;
            return {
              ...g,
              devices: [...g.devices, { ...device, id: devId }],
            };
          }),
        })),

      orders: initialOrders,
      addOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders],
        })),
      issueCompTicket: ({ customer, email, event, tier, quantity, note }) => {
        const orderId = `TK-COMP-${Math.floor(1000 + Math.random() * 9000)}`;
        const now = new Date();
        const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(
          now.getMonth() + 1
        ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(
          2,
          '0'
        )}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newOrder: OrderItem = {
          id: orderId,
          customer,
          email,
          event,
          tier: `${tier} ${note ? `(${note})` : ''}`,
          quantity,
          total: '0đ',
          paymentMethod: 'Vé mời (COMP)',
          time: timeStr,
          status: 'Đã cấp vé',
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        return newOrder;
      },

      payouts: initialPayouts,
      requestPayout: ({
        amount,
        bankName,
        accountNumber,
        accountHolder,
        organizer = 'Ánh Trăng Events',
        eventName = 'Đêm nhạc Mùa Thu (Đợt đối soát 1)',
      }) => {
        const nextId = `PO-0${get().payouts.length + 14}`;
        const grossStr = `${amount.toLocaleString('vi-VN')} VNĐ`;
        const fee = Math.round(amount * 0.035);
        const feeStr = `${fee.toLocaleString('vi-VN')} VNĐ (3.5%)`;
        const net = amount - fee;
        const netStr = `${net.toLocaleString('vi-VN')} VNĐ`;
        const now = new Date();
        const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(
          now.getMonth() + 1
        ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(
          2,
          '0'
        )}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newPayout: PayoutItem = {
          id: nextId,
          organizer,
          eventName,
          grossAmount: grossStr,
          feeAmount: feeStr,
          netPayout: netStr,
          bankInfo: `${accountNumber} · ${bankName} (${accountHolder.toUpperCase()})`,
          status: 'PENDING_FIRST',
          createdAt: timeStr,
        };

        set((state) => ({
          payouts: [newPayout, ...state.payouts],
        }));

        return newPayout;
      },
      approveFirstPayout: (id) =>
        set((state) => ({
          payouts: state.payouts.map((p) =>
            p.id === id ? { ...p, status: 'PENDING_SECOND' } : p
          ),
        })),
      approveSecondPayout: (id) =>
        set((state) => ({
          payouts: state.payouts.map((p) =>
            p.id === id ? { ...p, status: 'COMPLETED' } : p
          ),
        })),

      reports: initialReports,
      replyReport: (id, replyText, newStatus = 'Đã phản hồi') =>
        set((state) => {
          const now = new Date();
          const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(
            now.getMonth() + 1
          ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(
            2,
            '0'
          )}:${String(now.getMinutes()).padStart(2, '0')}`;

          return {
            reports: state.reports.map((r) => {
              if (r.id !== id) return r;
              const prevReplies = r.replies || [];
              return {
                ...r,
                status: newStatus,
                replies: [
                  ...prevReplies,
                  {
                    sender: 'Ban Tổ Chức (Ánh Trăng)',
                    text: replyText,
                    time: timeStr,
                  },
                ],
              };
            }),
          };
        }),

      disputes: initialDisputes,
      resolveDispute: (id, note) =>
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'RESOLVED',
                  resolutionNote: note || 'Đã giải quyết thỏa đáng khiếu nại của khách hàng.',
                }
              : d
          ),
        })),
      replyDispute: (id, replyText, newStatus = 'IN_PROGRESS') =>
        set((state) => {
          const now = new Date();
          const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(
            now.getMonth() + 1
          ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(
            2,
            '0'
          )}:${String(now.getMinutes()).padStart(2, '0')}`;

          return {
            disputes: state.disputes.map((d) => {
              if (d.id !== id) return d;
              const prevReplies = d.replies || [];
              return {
                ...d,
                status: newStatus,
                replies: [
                  ...prevReplies,
                  {
                    sender: 'Tickey Admin Hỗ trợ',
                    text: replyText,
                    time: timeStr,
                  },
                ],
              };
            }),
          };
        }),
    }),
    {
      name: 'tickey-portal-mock-store-v1',
    }
  )
);

/**
 * Utility to download CSV with UTF-8 BOM so Excel opens Vietnamese characters cleanly
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
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
