import { Router } from 'express';
import { ownerOnly } from '../middleware/auth.js';
import { J, dateKey, validate } from '../middleware/validate.js';
import { asyncHandler, unprocessable } from '../utils/errors.js';
import { diffDays, todayKey } from '../utils/time.js';
import { buildDaily, buildSummary } from '../services/reportService.js';
import { GROUP_BY } from '../services/reportCore.js';

const router = Router();

export const MAX_RANGE_DAYS = 400;

export function checkRange(from, to) {
  if (from > to) throw unprocessable('Tanggal awal tidak boleh setelah tanggal akhir.', { from: 'Tanggal awal > tanggal akhir' });
  if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) {
    throw unprocessable(`Rentang maksimal ${MAX_RANGE_DAYS} hari.`, { to: 'Rentang terlalu panjang' });
  }
}

// Rekap harian boleh diakses kasir (untuk "Rekap Hari Ini")
router.get(
  '/daily',
  validate({ query: J.object({ date: dateKey().label('Tanggal') }) }),
  asyncHandler(async (req, res) => {
    const date = req.valid.query.date || todayKey();
    res.json({ status: 'success', data: await buildDaily(date) });
  }),
);

router.get(
  '/summary',
  ownerOnly,
  validate({
    query: J.object({
      from: dateKey().required().label('Tanggal awal'),
      to: dateKey().required().label('Tanggal akhir'),
      groupBy: J.string().valid(...GROUP_BY).default('day').label('Pengelompokan'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { from, to, groupBy } = req.valid.query;
    checkRange(from, to);
    res.json({ status: 'success', data: await buildSummary(from, to, groupBy) });
  }),
);

export default router;
