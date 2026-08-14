import ExcelJS from 'exceljs';
import type { DataTablePayload } from '../types.js';

/** RFC-4180-ish CSV escaping: quote cells containing commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Simple CSV serializer. Includes a UTF-8 BOM so Excel opens the file with the
 * right encoding. One row per structured row, cells aligned to `columns`.
 */
export function renderDataTableCsv(payload: DataTablePayload): string {
  const { columns, rows } = payload;
  const lines: string[] = [];
  lines.push(columns.map(csvEscape).join(','));
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c] ?? '')).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Render a table to a real .xlsx workbook via exceljs (bold header, frozen row, sensible column widths). */
export async function renderDataTableXlsx(payload: DataTablePayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');

  sheet.columns = payload.columns.map((c) => ({
    header: c,
    key: c,
    width: Math.max(12, Math.min(40, c.length + 8)),
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of payload.rows) {
    sheet.addRow(row);
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}