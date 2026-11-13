import ExcelJS from 'exceljs';
import { fetchRange } from './reportService.js';
import { aggregateDaily, groupDaily, productBreakdown, sumTotals } from './reportCore.js';
import { formatDateId, formatTimeWib, toDateKey } from '../utils/time.js';

export const EXPORT_DATASETS = ['harian', 'periode', 'produk', 'transaksi', 'kas'];

const PAYMENT_LABEL = { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer' };

const periodColumns = (firstHeader) => [
  { header: firstHeader, key: 'label', width: 22 },
  { header: 'Transaksi', key: 'transactions', type: 'int', width: 11 },
  { header: 'Cup Terjual', key: 'cups', type: 'int', width: 12 },
  { header: 'Penjualan', key: 'sales', type: 'money', width: 15 },
  { header: 'HPP', key: 'hpp', type: 'money', width: 14 },
  { header: 'Laba Kotor', key: 'grossProfit', type: 'money', width: 15 },
  { header: 'Pemasukan Lain', key: 'otherIncome', type: 'money', width: 15 },
  { header: 'Total Pemasukan', key: 'income', type: 'money', width: 16 },
  { header: 'Pengeluaran', key: 'expense', type: 'money', width: 15 },
  { header: 'Saldo Bersih', key: 'net', type: 'money', width: 15 },
];

/** Susun semua dataset untuk rentang tanggal tertentu */
export async function buildExportData(from, to) {
  const { transactions: all, cashEntries } = await fetchRange(from, to, { includeVoid: true });
  const active = all.filter((t) => t.status === 'ACTIVE');
  const daily = aggregateDaily(active, cashEntries, from, to);
  const totals = sumTotals(daily);

  const datasets = {
    harian: {
      title: 'Rekap Harian',
      columns: [{ ...periodColumns('Tanggal')[0], header: 'Tanggal', key: 'date', width: 12 }, ...periodColumns('').slice(1)],
      rows: groupDaily(daily, 'day', from, to).map((b) => ({ ...b, date: b.key })),
      totalRow: true,
    },
    periode5: {
      title: 'Rekap 5 Harian',
      columns: periodColumns('Periode (5 hari)'),
      rows: groupDaily(daily, '5day', from, to),
      totalRow: true,
    },
    mingguan: {
      title: 'Rekap Mingguan',
      columns: periodColumns('Minggu (Senin–Minggu)'),
      rows: groupDaily(daily, 'week', from, to),
      totalRow: true,
    },
    bulanan: {
      title: 'Rekap Bulanan',
      columns: periodColumns('Bulan'),
      rows: groupDaily(daily, 'month', from, to),
      totalRow: true,
    },
    produk: {
      title: 'Per Menu',
      columns: [
        { header: 'Nama Menu', key: 'name', width: 24 },
        { header: 'Qty', key: 'qty', type: 'int', width: 8 },
        { header: 'HPP / Cup', key: 'unitHpp', type: 'money', width: 13 },
        { header: 'Total HPP', key: 'hpp', type: 'money', width: 14 },
        { header: 'Harga Jual', key: 'price', type: 'money', width: 13 },
        { header: 'Pendapatan Kotor', key: 'sales', type: 'money', width: 17 },
        { header: 'Laba Kotor', key: 'grossProfit', type: 'money', width: 14 },
      ],
      rows: productBreakdown(active),
      totalRow: true,
    },
    transaksi: {
      title: 'Detail Transaksi',
      columns: [
        { header: 'Tanggal', key: 'date', width: 12 },
        { header: 'Jam', key: 'time', width: 7 },
        { header: 'Kode', key: 'code', width: 20 },
        { header: 'Kasir', key: 'cashier', width: 14 },
        { header: 'Metode Bayar', key: 'payment', width: 13 },
        { header: 'Menu', key: 'product', width: 24 },
        { header: 'Qty', key: 'qty', type: 'int', width: 7 },
        { header: 'Harga', key: 'price', type: 'money', width: 12 },
        { header: 'Subtotal', key: 'subtotal', type: 'money', width: 13 },
        { header: 'Status', key: 'status', width: 11 },
        { header: 'Catatan', key: 'note', width: 30 },
      ],
      rows: all.flatMap((t) => t.items.map((i) => ({
        date: toDateKey(t.occurredAt),
        time: formatTimeWib(t.occurredAt),
        code: t.code,
        cashier: t.cashier?.name || '',
        payment: PAYMENT_LABEL[t.paymentMethod] || t.paymentMethod,
        product: i.productName,
        qty: i.qty,
        price: i.price,
        subtotal: i.subtotal,
        status: t.status === 'VOID' ? 'Dibatalkan' : 'Selesai',
        note: t.status === 'VOID' ? `Batal: ${t.voidReason || ''}` : t.note || '',
      }))),
    },
    kas: {
      title: 'Pemasukan & Pengeluaran',
      columns: [
        { header: 'Tanggal', key: 'date', width: 12 },
        { header: 'Jam', key: 'time', width: 7 },
        { header: 'Jenis', key: 'type', width: 13 },
        { header: 'Kategori', key: 'category', width: 18 },
        { header: 'Nominal', key: 'amount', type: 'money', width: 14 },
        { header: 'Keterangan', key: 'description', width: 34 },
        { header: 'Dicatat Oleh', key: 'createdBy', width: 14 },
      ],
      rows: cashEntries.map((e) => ({
        date: toDateKey(e.occurredAt),
        time: formatTimeWib(e.occurredAt),
        type: e.type === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran',
        category: e.category,
        amount: e.type === 'PEMASUKAN' ? e.amount : -e.amount,
        description: e.description || '',
        createdBy: e.createdBy?.name || '',
      })),
    },
  };

  return { from, to, totals, datasets, counts: { transaksi: active.length, dibatalkan: all.length - active.length, kas: cashEntries.length, hari: daily.size } };
}

const DATASET_SHEETS = {
  harian: ['harian'],
  periode: ['periode5', 'mingguan', 'bulanan'],
  produk: ['produk'],
  transaksi: ['transaksi'],
  kas: ['kas'],
};

const MONEY_FMT = '"Rp"#,##0;[Red]-"Rp"#,##0';

function totalsFor(ds) {
  const row = {};
  ds.columns.forEach((c, idx) => {
    if (idx === 0) row[c.key] = 'TOTAL';
    else if (c.type === 'money' || c.type === 'int') {
      if (['unitHpp', 'price'].includes(c.key)) return;
      row[c.key] = ds.rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    }
  });
  return row;
}

function addSheet(wb, ds) {
  const ws = wb.addWorksheet(ds.title, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = ds.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6F4E37' } };
  ws.getRow(1).alignment = { vertical: 'middle' };
  ws.addRows(ds.rows.map((r) => Object.fromEntries(ds.columns.map((c) => [c.key, r[c.key] ?? '']))));
  if (ds.totalRow && ds.rows.length) {
    const tr = ws.addRow(totalsFor(ds));
    tr.font = { bold: true };
    tr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E9DD' } };
  }
  ds.columns.forEach((c, i) => {
    if (c.type === 'money') ws.getColumn(i + 1).numFmt = MONEY_FMT;
    if (c.type === 'int') ws.getColumn(i + 1).numFmt = '#,##0';
  });
  if (ds.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ds.columns.length } };
  return ws;
}

export async function toXlsx(data, include) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Coffee Service Dashboard';
  wb.created = new Date();

  const t = data.totals;
  const ws = wb.addWorksheet('Ringkasan');
  ws.columns = [{ width: 28 }, { width: 22 }];
  ws.addRow(['Laporan Keuangan Coffee Service']).font = { bold: true, size: 14 };
  ws.addRow([`Periode: ${formatDateId(data.from)} s/d ${formatDateId(data.to)}`]);
  ws.addRow([`Dibuat: ${toDateKey(new Date())} ${formatTimeWib(new Date())} WIB`]);
  ws.addRow([]);
  const lines = [
    ['Penjualan (omzet)', t.sales],
    ['Pemasukan lain', t.otherIncome],
    ['Total pemasukan', t.income],
    ['Total pengeluaran', t.expense],
    ['Saldo bersih (pemasukan − pengeluaran)', t.net],
    [],
    ['HPP (estimasi)', t.hpp],
    ['Laba kotor (penjualan − HPP)', t.grossProfit],
    [],
    ['Jumlah transaksi', t.transactions],
    ['Cup terjual', t.cups],
    ['Rata-rata per transaksi', t.avgTicket],
  ];
  for (const [label, value] of lines) {
    const row = ws.addRow(label ? [label, value] : []);
    if (label && !['Jumlah transaksi', 'Cup terjual'].includes(label)) row.getCell(2).numFmt = MONEY_FMT;
    if (label && label.startsWith('Saldo')) row.font = { bold: true };
  }

  for (const key of include) {
    for (const sheet of DATASET_SHEETS[key] || []) addSheet(wb, data.datasets[sheet]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV untuk satu dataset (Google Sheets: File > Impor). groupBy dipakai untuk dataset 'periode'. */
export function toCsv(data, dataset, groupBy = '5day') {
  const key = dataset === 'periode' ? { '5day': 'periode5', week: 'mingguan', month: 'bulanan' }[groupBy] || 'periode5' : dataset;
  const ds = data.datasets[key];
  const rows = [...ds.rows];
  if (ds.totalRow && rows.length) rows.push(totalsFor(ds));
  const lines = [ds.columns.map((c) => csvCell(c.header)).join(',')];
  for (const r of rows) lines.push(ds.columns.map((c) => csvCell(r[c.key])).join(','));
  return { title: ds.title, content: `﻿${lines.join('\r\n')}\r\n` };
}
