import { Router } from 'express';
import { prisma } from '../db.js';
import { J, dateKey, validate } from '../middleware/validate.js';
import { asyncHandler, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { rangeToDates, toDateKey, todayKey } from '../utils/time.js';
import { emitChange } from '../realtime.js';

const router = Router();

export const CASH_CATEGORIES = {
  PENGELUARAN: ['Bahan Baku', 'Gaji Barista', 'Token Listrik', 'PDAM', 'Sewa Toko', 'Perlengkapan', 'Lainnya'],
  PEMASUKAN: ['Modal / Setoran', 'Penjualan Lain', 'Lainnya'],
};

const MAX_BACKDATE_MS = 31 * 24 * 60 * 60 * 1000;

const bodySchema = J.object({
  clientId: J.string().trim().min(8).max(64).label('ID entri'),
  type: J.string().valid('PEMASUKAN', 'PENGELUARAN').required().label('Jenis'),
  category: J.string().trim().min(2).max(40).required().label('Kategori'),
  amount: J.number().integer().min(1).max(1_000_000_000).required().label('Nominal'),
  description: J.string().trim().max(200).allow('', null).label('Keterangan'),
  occurredAt: J.date().iso().label('Waktu'),
});

const idParam = J.object({ id: J.number().integer().positive().required() });

const serialize = (e) => ({
  id: e.id,
  type: e.type,
  category: e.category,
  amount: e.amount,
  description: e.description,
  occurredAt: e.occurredAt,
  createdById: e.createdById,
  createdBy: e.createdBy?.name,
});

function checkWhen(occurredAt) {
  if (!occurredAt) return new Date();
  const t = new Date(occurredAt).getTime();
  if (t > Date.now() + 5 * 60 * 1000 || t < Date.now() - MAX_BACKDATE_MS) {
    throw unprocessable('Tanggal entri tidak valid (maksimal 31 hari ke belakang dan tidak boleh di masa depan).', {
      occurredAt: 'Tanggal di luar batas',
    });
  }
  return new Date(t);
}

function canModify(user, entry) {
  if (user.role === 'OWNER') return;
  if (entry.createdById !== user.id || toDateKey(entry.occurredAt) !== todayKey()) {
    throw forbidden('Kasir hanya bisa mengubah entri miliknya sendiri pada hari yang sama.');
  }
}

router.get('/categories', (_req, res) => {
  res.json({ status: 'success', data: { categories: CASH_CATEGORIES } });
});

router.get(
  '/',
  validate({
    query: J.object({
      from: dateKey(), to: dateKey(), type: J.string().valid('PEMASUKAN', 'PENGELUARAN'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const from = req.valid.query.from || todayKey();
    const to = req.valid.query.to || from;
    const { start, end } = rangeToDates(from, to);
    const entries = await prisma.cashEntry.findMany({
      where: { occurredAt: { gte: start, lt: end }, ...(req.valid.query.type ? { type: req.valid.query.type } : {}) },
      include: { createdBy: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
    });
    res.json({ status: 'success', data: { entries: entries.map(serialize) } });
  }),
);

router.post(
  '/',
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const { clientId, occurredAt, ...rest } = req.valid.body;
    if (clientId) {
      const dup = await prisma.cashEntry.findUnique({ where: { clientId }, include: { createdBy: { select: { name: true } } } });
      if (dup) return res.json({ status: 'success', message: 'Entri sudah tersimpan.', data: { entry: serialize(dup), duplicate: true } });
    }
    const when = checkWhen(occurredAt);
    const entry = await prisma.cashEntry.create({
      data: { ...rest, description: rest.description || null, clientId: clientId || null, occurredAt: when, createdById: req.user.id },
      include: { createdBy: { select: { name: true } } },
    });
    emitChange('cash', { date: toDateKey(when) });
    const label = entry.type === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran';
    res.status(201).json({ status: 'success', message: `${label} tersimpan.`, data: { entry: serialize(entry) } });
  }),
);

router.put(
  '/:id',
  validate({ params: idParam, body: bodySchema }),
  asyncHandler(async (req, res) => {
    const entry = await prisma.cashEntry.findUnique({ where: { id: req.valid.params.id } });
    if (!entry) throw notFound('Entri tidak ditemukan.');
    canModify(req.user, entry);
    const { clientId: _ignored, occurredAt, ...rest } = req.valid.body;
    const updated = await prisma.cashEntry.update({
      where: { id: entry.id },
      data: { ...rest, description: rest.description || null, ...(occurredAt ? { occurredAt: checkWhen(occurredAt) } : {}) },
      include: { createdBy: { select: { name: true } } },
    });
    emitChange('cash', { date: toDateKey(updated.occurredAt) });
    res.json({ status: 'success', message: 'Entri diperbarui.', data: { entry: serialize(updated) } });
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const entry = await prisma.cashEntry.findUnique({ where: { id: req.valid.params.id } });
    if (!entry) throw notFound('Entri tidak ditemukan.');
    canModify(req.user, entry);
    await prisma.cashEntry.delete({ where: { id: entry.id } });
    emitChange('cash', { date: toDateKey(entry.occurredAt) });
    res.json({ status: 'success', message: 'Entri dihapus.' });
  }),
);

export default router;
