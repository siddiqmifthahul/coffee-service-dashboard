// Ekspor data mentah transaksi (per item) dari database untuk pipeline ML & analisis Data Science.
// Format kolom SAMA dengan CSV "Detail transaksi" di halaman Export aplikasi.
//
// Pemakaian:  npm run export:training [-- --from 2026-08-01 --to 2026-11-13 --out ../ai-service/data/raw/transaksi.csv]

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/db.js';
import { buildExportData, toCsv } from '../src/services/exportService.js';
import { addDays, toDateKey, todayKey } from '../src/utils/time.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const first = await prisma.transaction.findFirst({ orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } });
if (!first) {
  console.error('Belum ada transaksi di database.');
  process.exit(1);
}

const from = arg('from', toDateKey(first.occurredAt));
// default sampai KEMARIN: hari ini belum lengkap sehingga tidak dipakai untuk training
const to = arg('to', addDays(todayKey(), -1));
const out = path.resolve(arg('out', '../ai-service/data/raw/transaksi.csv'));

const data = await buildExportData(from, to);
const { content } = toCsv(data, 'transaksi');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, content);

console.log(`✓ ${data.datasets.transaksi.rows.length} baris item (${data.counts.transaksi} transaksi aktif, ${data.counts.dibatalkan} batal)`);
console.log(`  Periode ${from} s/d ${to} → ${out}`);
await prisma.$disconnect();
