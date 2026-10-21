/**
 * Tệp CSV khách mời COMP. Cột theo mẫu: HoTen, Email, MaGhe, DonVi.
 * Tên cột được so khớp không dấu và không phân biệt hoa thường, nên "Họ tên" và "HoTen"
 * đều dùng được; tệp không có hàng tiêu đề thì đọc theo thứ tự cột cố định.
 */

export interface CompCsvRow {
  /** Số dòng trong tệp (tính cả hàng tiêu đề), để báo lỗi cho đúng chỗ. */
  line: number;
  name: string;
  email: string;
  seatCode: string;
  note: string;
}

export interface CompCsvIssue {
  line: number;
  field: 'name' | 'email' | 'seat' | 'row';
  message: string;
}

export interface CompCsvResult {
  rows: CompCsvRow[];
  issues: CompCsvIssue[];
}

/** Bỏ dấu và ký tự lạ, để so khớp tên cột. Đ không tách dấu nên phải đổi riêng. */
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const NAME_COLUMNS = ['hoten', 'ten', 'tenkhach', 'fullname', 'nguoinhan', 'khachmoi', 'nguoimua'];
const EMAIL_COLUMNS = ['email', 'emailnhanve', 'emailnhan', 'mail', 'emailkhach'];
const SEAT_COLUMNS = ['mage', 'ghe', 'seat', 'seaticode', 'maseat', 'maghe'];
const NOTE_COLUMNS = ['donvi', 'nhom', 'nhomkhach', 'ghichu', 'chucvu', 'note', 'donvitc'];

const findColumn = (headers: string[], aliases: string[]) =>
  headers.findIndex((header) => aliases.includes(normalize(header)));

/** Tách một dòng CSV theo dấu phân cách, hiểu dấu nháy kép và nháy kép lặp lại (""). */
const splitLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') {
        current += char;
      } else if (line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

/**
 * Tách tệp thành các dòng ghi, không phân biệt \n và \r\n; dòng trong nháy kép giữ nguyên.
 * Dòng rỗng vẫn giữ lại để số dòng báo lỗi khớp với tệp gốc.
 */
const splitRecords = (text: string): string[] => {
  const records: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      records.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records.map((record) => record.trim());
};

/** Dấu phân cách: ưu tiên dấu phẩy, nhưng tệp xuất từ Excel Việt Nam hay dùng dấu chấm phẩy. */
const detectDelimiter = (record: string) => {
  const cells = splitLine(record, ',');
  const semicolons = cells.length > 1 ? 0 : (record.match(/;/g) ?? []).length;
  const commas = (record.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Đọc tệp CSV khách mời COMP. Trả về các dòng hợp lệ về mặt hình thức và các lỗi cần sửa
 * (thiếu tên, thiếu hoặc sai email, thiếu mã ghế, ghế lặp trong tệp).
 */
export function parseCompCsv(text: string): CompCsvResult {
  const records = splitRecords(text.replace(/^\uFEFF/, ''));
  const firstIndex = records.findIndex((record) => record.length > 0);
  if (firstIndex < 0) {
    return { rows: [], issues: [{ line: 0, field: 'row', message: 'Tệp CSV trống.' }] };
  }

  const delimiter = detectDelimiter(records[firstIndex]);
  const firstCells = splitLine(records[firstIndex], delimiter);
  const hasHeader = firstCells.some((cell) => EMAIL_COLUMNS.includes(normalize(cell)));

  let nameIndex = 0;
  let emailIndex = 1;
  let seatIndex = 2;
  let noteIndex = 3;
  let startIndex = firstIndex;
  if (hasHeader) {
    nameIndex = findColumn(firstCells, NAME_COLUMNS);
    emailIndex = findColumn(firstCells, EMAIL_COLUMNS);
    seatIndex = findColumn(firstCells, SEAT_COLUMNS);
    noteIndex = findColumn(firstCells, NOTE_COLUMNS);
    startIndex = firstIndex + 1;
  }

  const rows: CompCsvRow[] = [];
  const issues: CompCsvIssue[] = [];
  const seenSeats = new Map<string, { line: number; code: string }>();

  for (let i = startIndex; i < records.length; i += 1) {
    const line = i + 1;
    if (!records[i]) continue;
    const cells = splitLine(records[i], delimiter);
    const name = (nameIndex >= 0 ? (cells[nameIndex] ?? '') : '').trim();
    const email = (emailIndex >= 0 ? (cells[emailIndex] ?? '') : '').trim().toLowerCase();
    const seatCode = (seatIndex >= 0 ? (cells[seatIndex] ?? '') : '').trim();
    const note = (noteIndex >= 0 ? (cells[noteIndex] ?? '') : '').trim();

    if (!name && !email && !seatCode) continue;

    let valid = true;
    if (!name) {
      issues.push({ line, field: 'name', message: 'Thiếu họ tên khách mời.' });
      valid = false;
    }
    if (!email) {
      issues.push({ line, field: 'email', message: 'Thiếu email nhận vé.' });
      valid = false;
    } else if (!EMAIL_PATTERN.test(email)) {
      issues.push({ line, field: 'email', message: `Email "${email}" không hợp lệ.` });
      valid = false;
    }
    if (!seatCode) {
      issues.push({ line, field: 'seat', message: 'Thiếu mã ghế.' });
      valid = false;
    } else {
      const key = seatCode.toUpperCase();
      const first = seenSeats.get(key);
      if (first) {
        issues.push({ line, field: 'seat', message: `Ghế ${first.code} đã có ở dòng ${first.line}.` });
        valid = false;
      } else {
        seenSeats.set(key, { line, code: seatCode });
      }
    }

    if (valid) rows.push({ line, name, email, seatCode, note });
  }

  if (!rows.length && !issues.length) {
    issues.push({ line: 0, field: 'row', message: 'Tệp CSV không có dòng dữ liệu nào.' });
  }

  return { rows, issues };
}

export interface CompSeat {
  code: string;
  free: boolean;
  /** Ghế không thuộc khu vực của hạng vé COMP đang chọn. */
  allowed?: boolean;
}

/**
 * Đối chiếu mã ghế trong tệp với sơ đồ của suất diễn: ghế phải tồn tại, còn trống và thuộc
 * khu vực của hạng vé COMP (điều kiện của create_booking).
 */
export function checkCompSeats(rows: CompCsvRow[], seats: CompSeat[]): CompCsvIssue[] {
  const issues: CompCsvIssue[] = [];
  const byCode = new Map(seats.map((seat) => [seat.code.trim().toUpperCase(), seat]));
  for (const row of rows) {
    const seat = byCode.get(row.seatCode.toUpperCase());
    if (!seat) {
      issues.push({ line: row.line, field: 'seat', message: `Không tìm thấy ghế ${row.seatCode}.` });
    } else if (seat.allowed === false) {
      issues.push({
        line: row.line,
        field: 'seat',
        message: `Ghế ${row.seatCode} không thuộc khu vực của hạng vé COMP.`,
      });
    } else if (!seat.free) {
      issues.push({ line: row.line, field: 'seat', message: `Ghế ${row.seatCode} đã có người khác giữ.` });
    }
  }
  return issues;
}

/** Mã ghế trong tệp không phân biệt hoa thường. */
export const seatKey = (code: string) => code.trim().toUpperCase();
