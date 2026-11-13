import { Router } from 'express';
import { J, dateKey, validate } from '../middleware/validate.js';
import { asyncHandler, unprocessable } from '../utils/errors.js';
import { EXPORT_DATASETS, buildExportData, toCsv, toXlsx } from '../services/exportService.js';
import { checkRange } from './reports.js';

const router = Router();

const querySchema = J.object({
  from: dateKey().required().label('Tanggal awal'),
  to: dateKey().required().label('Tanggal akhir'),
  format: J.string().valid('xlsx', 'csv').default('xlsx').label('Format'),
  include: J.string().default(EXPORT_DATASETS.join(',')).label('Isi data'),
  groupBy: J.string().valid('5day', 'week', 'month').default('5day'),
});

function parseInclude(raw) {
  const list = [...new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean))];
  const bad = list.filter((s) => !EXPORT_DATASETS.includes(s));
  if (!list.length || bad.length) {
    throw unprocessable('Pilih minimal satu isi data yang valid.', { include: `Pilihan: ${EXPORT_DATASETS.join(', ')}` });
  }
  return list;
}

// Ringkasan jumlah data sebelum diunduh (dipakai halaman Export untuk pratinjau)
router.get(
  '/preview',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.valid.query;
    checkRange(from, to);
    const data = await buildExportData(from, to);
    res.json({
      status: 'success',
      data: {
        totals: data.totals,
        counts: { ...data.counts, barisTransaksi: data.datasets.transaksi.rows.length, menu: data.datasets.produk.rows.length },
      },
    });
  }),
);

router.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const { from, to, format, groupBy } = req.valid.query;
    checkRange(from, to);
    const include = parseInclude(req.valid.query.include);
    const data = await buildExportData(from, to);
    const base = `coffee-service_${from}_sd_${to}`;

    if (format === 'csv') {
      if (include.length !== 1) {
        throw unprocessable('Format CSV hanya bisa berisi satu jenis data. Pilih satu, atau gunakan format Excel (.xlsx).', {
          include: 'Pilih satu isi data untuk CSV',
        });
      }
      const { content } = toCsv(data, include[0], groupBy);
      const suffix = include[0] === 'periode' ? `periode-${groupBy}` : include[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}_${suffix}.csv"`);
      return res.send(content);
    }

    const buffer = await toXlsx(data, include);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    res.send(buffer);
  }),
);

export default router;
