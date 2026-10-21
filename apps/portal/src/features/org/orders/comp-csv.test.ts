import { describe, expect, it } from 'vitest';
import { checkCompSeats, parseCompCsv, seatKey } from './comp-csv';

describe('parseCompCsv', () => {
  it('reads the sample header HoTen, Email, MaGhe, DonVi', () => {
    const result = parseCompCsv('HoTen,Email,MaGhe,DonVi\nĐặng Quốc Khánh,khanh.dang@sponsor.vn,G05,Nhà tài trợ');

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        line: 2,
        name: 'Đặng Quốc Khánh',
        email: 'khanh.dang@sponsor.vn',
        seatCode: 'G05',
        note: 'Nhà tài trợ',
      },
    ]);
  });

  it('matches headers without diacritics and in any order', () => {
    const result = parseCompCsv('Đơn vị;Mã ghế;E-mail;Họ tên\nBáo chí;G07;ngoc.vo@press.vn;Võ Bích Ngọc');

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: 'Võ Bích Ngọc',
      email: 'ngoc.vo@press.vn',
      seatCode: 'G07',
      note: 'Báo chí',
    });
  });

  it('reads a file without a header row as name, email, seat, note', () => {
    const result = parseCompCsv('Trịnh Gia Huy,huy.trinh@artist.vn,G07,Đại diện nghệ sĩ');

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: 'Trịnh Gia Huy', seatCode: 'G07' });
  });

  it('keeps commas inside quoted values and lower-cases the email', () => {
    const result = parseCompCsv('HoTen,Email,MaGhe\n"Nguyễn, Thị An","AN.NGUYEN@Partner.VN",G09');

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: 'Nguyễn, Thị An', email: 'an.nguyen@partner.vn' });
  });

  it('handles a BOM, CRLF line endings and blank lines', () => {
    const result = parseCompCsv('﻿HoTen,Email,MaGhe\r\n\r\nVõ Bích Ngọc,ngoc.vo@press.vn,G06\r\n');

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].line).toBe(3);
  });

  it('reports the line of a missing name, a missing email and an invalid email', () => {
    const result = parseCompCsv('HoTen,Email,MaGhe\n,khanh.dang@sponsor.vn,G05\nĐặng Khánh,,G06\nVõ Ngọc,khong-phai-email,G07');

    expect(result.issues).toEqual([
      { line: 2, field: 'name', message: 'Thiếu họ tên khách mời.' },
      { line: 3, field: 'email', message: 'Thiếu email nhận vé.' },
      { line: 4, field: 'email', message: 'Email "khong-phai-email" không hợp lệ.' },
    ]);
    expect(result.rows).toEqual([]);
  });

  it('reports a missing seat code and a seat repeated in the same file', () => {
    const result = parseCompCsv('HoTen,Email,MaGhe\nĐặng Khánh,khanh.dang@sponsor.vn,\nVõ Ngọc,ngoc.vo@press.vn,G05\nTrịnh Huy,huy.trinh@artist.vn,g05');

    expect(result.issues).toEqual([
      { line: 2, field: 'seat', message: 'Thiếu mã ghế.' },
      { line: 4, field: 'seat', message: 'Ghế G05 đã có ở dòng 3.' },
    ]);
    expect(result.rows).toHaveLength(1);
  });

  it('flags an empty file', () => {
    expect(parseCompCsv('   ').issues).toEqual([{ line: 0, field: 'row', message: 'Tệp CSV trống.' }]);
  });
});

describe('checkCompSeats', () => {
  const rows = parseCompCsv('HoTen,Email,MaGhe\nĐặng Khánh,khanh.dang@sponsor.vn,G05\nVõ Ngọc,ngoc.vo@press.vn,G06').rows;

  it('accepts seats that are free', () => {
    const issues = checkCompSeats(rows, [
      { code: 'G05', free: true },
      { code: 'G06', free: true },
    ]);

    expect(issues).toEqual([]);
  });

  it('ignores the case of the seat code', () => {
    const issues = checkCompSeats(rows, [
      { code: 'g05', free: true },
      { code: 'G06', free: true },
    ]);

    expect(issues).toEqual([]);
  });

  it('reports a seat that is taken and a seat that is not on the map', () => {
    const issues = checkCompSeats(rows, [
      { code: 'G05', free: false },
      { code: 'STD-C-10', free: true },
    ]);

    expect(issues).toEqual([
      { line: 2, field: 'seat', message: 'Ghế G05 đã có người khác giữ.' },
      { line: 3, field: 'seat', message: 'Không tìm thấy ghế G06.' },
    ]);
  });

  it('reports a seat that is outside the zone of the COMP ticket type', () => {
    const issues = checkCompSeats(rows, [
      { code: 'G05', free: true, allowed: false },
      { code: 'G06', free: true, allowed: true },
    ]);

    expect(issues).toEqual([
      { line: 2, field: 'seat', message: 'Ghế G05 không thuộc khu vực của hạng vé COMP.' },
    ]);
  });
});

describe('seatKey', () => {
  it('normalises a seat code', () => {
    expect(seatKey(' g05 ')).toBe('G05');
  });
});
