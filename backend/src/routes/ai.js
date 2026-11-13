import { Router } from 'express';
import { prisma } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { J, dateKey, validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/errors.js';
import { addDays, todayKey } from '../utils/time.js';
import { buildSummary, dailyHistory } from '../services/reportService.js';
import { AiUnavailableError, callAi } from '../services/aiClient.js';
import { checkRange } from './reports.js';

const router = Router(); // semua endpoint AI hanya untuk owner (dipasang di app.js)
router.use(ownerOnly);

const UNAVAILABLE = 'Layanan AI sedang tidak tersedia. Data penjualan Anda tetap aman — silakan coba beberapa saat lagi.';

async function log(type, request, response, isFallback, userId) {
  try {
    await prisma.aiLog.create({ data: { type, request, response, isFallback, userId } });
  } catch (err) {
    console.warn('[ai] gagal menyimpan log:', err.message);
  }
}

async function proxy(req, res, type, path, payload, logRequest = payload) {
  try {
    const result = await callAi(path, payload);
    await log(type, logRequest, result, Boolean(result.is_fallback), req.user.id);
    res.json({ status: 'success', data: { available: true, ...result } });
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) throw err;
    console.warn('[ai]', err.message);
    await log(type, logRequest, { error: err.message }, true, req.user.id);
    res.json({ status: 'success', data: { available: false, message: UNAVAILABLE } });
  }
}

const compactSummary = (s) => ({
  period: { from: s.range.from, to: s.range.to },
  totals: s.totals,
  previous_totals: s.previousTotals,
  change_pct: s.change,
  top_products: s.products.slice(0, 5).map((p) => ({ name: p.name, qty: p.qty, sales: p.sales })),
  least_products: s.products.slice(-3).map((p) => ({ name: p.name, qty: p.qty, sales: p.sales })),
  expense_by_category: s.expenseByCategory,
  payments: s.payments,
});

router.post(
  '/insight',
  validate({ body: J.object({ from: dateKey().required().label('Tanggal awal'), to: dateKey().required().label('Tanggal akhir') }) }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.valid.body;
    checkRange(from, to);
    const summary = await buildSummary(from, to, 'day');
    await proxy(req, res, 'insight', '/generate-insight', compactSummary(summary));
  }),
);

router.post(
  '/forecast',
  validate({ body: J.object({ horizon: J.number().integer().min(1).max(14).default(7).label('Jumlah hari') }) }),
  asyncHandler(async (req, res) => {
    const end = addDays(todayKey(), -1);
    const history = await dailyHistory(addDays(end, -55), end);
    await proxy(req, res, 'forecast', '/predict-sales', { history, horizon: req.valid.body.horizon }, { days: history.length, horizon: req.valid.body.horizon });
  }),
);

router.post(
  '/chat',
  validate({ body: J.object({ message: J.string().trim().min(1).max(500).required().label('Pesan') }) }),
  asyncHandler(async (req, res) => {
    const today = todayKey();
    const monthStart = `${today.slice(0, 7)}-01`;
    const [todaySum, monthSum, products] = await Promise.all([
      buildSummary(today, today, 'day'),
      buildSummary(monthStart, today, 'week'),
      prisma.product.findMany({ where: { isActive: true }, select: { name: true, price: true, category: true } }),
    ]);
    const payload = {
      message: req.valid.body.message,
      context: {
        today: { date: today, ...compactSummary(todaySum) },
        this_month: compactSummary(monthSum),
        menu: products,
      },
    };
    await proxy(req, res, 'chat', '/chat', payload, { message: payload.message });
  }),
);

router.get(
  '/history',
  validate({ query: J.object({ type: J.string().valid('insight', 'forecast', 'chat').default('chat'), limit: J.number().integer().min(1).max(50).default(20) }) }),
  asyncHandler(async (req, res) => {
    const logs = await prisma.aiLog.findMany({
      where: { type: req.valid.query.type, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: req.valid.query.limit,
    });
    res.json({ status: 'success', data: { logs: logs.reverse() } });
  }),
);

export default router;
