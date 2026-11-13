import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { J, dateKey, validate } from '../middleware/validate.js';
import { asyncHandler, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { rangeToDates, toDateKey, todayKey } from '../utils/time.js';
import { emitChange } from '../realtime.js';

const router = Router();

const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000; // antrean offline maksimal 7 hari
const MAX_FUTURE_MS = 5 * 60 * 1000;

const createSchema = J.object({
  clientId: J.string().trim().min(8).max(64).required().label('ID transaksi'),
  items: J.array()
    .items(
      J.object({
        productId: J.number().integer().positive().required().label('Menu'),
        qty: J.number().integer().min(1).max(500).required().label('Jumlah pesanan'),
      }),
    )
    .min(1)
    .max(50)
    .unique('productId')
    .required()
    .label('Daftar pesanan'),
  paymentMethod: J.string().valid('TUNAI', 'QRIS', 'TRANSFER').default('TUNAI').label('Metode bayar'),
  note: J.string().trim().max(200).allow('', null).label('Catatan'),
  occurredAt: J.date().iso().label('Waktu transaksi'),
});

const listSchema = J.object({
  from: dateKey().label('Tanggal awal'),
  to: dateKey().label('Tanggal akhir'),
  q: J.string().trim().max(60).allow(''),
  status: J.string().valid('ACTIVE', 'VOID', 'ALL').default('ALL'),
  page: J.number().integer().min(1).default(1),
  pageSize: J.number().integer().min(1).max(100).default(20),
});

const serialize = (t) => ({
  id: t.id,
  code: t.code,
  occurredAt: t.occurredAt,
  paymentMethod: t.paymentMethod,
  total: t.total,
  totalHpp: t.totalHpp,
  itemCount: t.itemCount,
  note: t.note,
  status: t.status,
  voidReason: t.voidReason,
  voidedAt: t.voidedAt,
  cashier: t.cashier ? { id: t.cashier.id, name: t.cashier.name } : undefined,
  cashierId: t.cashierId,
  items: t.items?.map((i) => ({
    productId: i.productId, productName: i.productName, price: i.price, qty: i.qty, subtotal: i.subtotal,
  })),
});

const includeAll = { items: true, cashier: { select: { id: true, name: true } } };

function makeCode(date) {
  const k = toDateKey(date).replaceAll('-', '').slice(2);
  return `TRX-${k}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { clientId, items, paymentMethod, note, occurredAt } = req.valid.body;

    // Autosave idempoten: clientId unik di DB. Kirim ulang dengan clientId sama -> data lama dikembalikan
    // (ditangani lewat error P2002 di bawah agar tidak menambah query di jalur normal).

    const now = Date.now();
    let when = new Date(now);
    if (occurredAt) {
      const t = new Date(occurredAt).getTime();
      if (t > now + MAX_FUTURE_MS || t < now - MAX_BACKDATE_MS) {
        throw unprocessable('Waktu transaksi tidak valid (maksimal 7 hari ke belakang).', { occurredAt: 'Waktu transaksi di luar batas' });
      }
      when = new Date(t);
    }

    const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const errors = {};
    items.forEach((it, idx) => {
      const p = byId.get(it.productId);
      if (!p) errors[`items.${idx}.productId`] = 'Menu tidak ditemukan';
      else if (!p.isActive) errors[`items.${idx}.productId`] = `Menu "${p.name}" sudah tidak dijual`;
    });
    if (Object.keys(errors).length) throw unprocessable(`Pesanan tidak valid: ${Object.values(errors)[0]}.`, errors);

    const lines = items.map((it) => {
      const p = byId.get(it.productId);
      return { productId: p.id, productName: p.name, price: p.price, hpp: p.hpp, qty: it.qty, subtotal: p.price * it.qty };
    });

    const data = {
      clientId,
      occurredAt: when,
      cashierId: req.user.id,
      paymentMethod,
      note: note || null,
      total: lines.reduce((s, l) => s + l.subtotal, 0),
      totalHpp: lines.reduce((s, l) => s + l.hpp * l.qty, 0),
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
      items: { create: lines },
    };

    let trx;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await prisma.transaction.create({ data: { ...data, code: makeCode(when) } });
        trx = { ...created, items: lines, cashier: { id: req.user.id, name: req.user.name } };
        break;
      } catch (err) {
        // P2002 di clientId = request paralel yang sama sudah tersimpan
        if (err.code === 'P2002' && String(err.meta?.target).includes('clientId')) {
          const dup = await prisma.transaction.findUnique({ where: { clientId }, include: includeAll });
          return res.status(200).json({ status: 'success', message: 'Transaksi sudah tersimpan.', data: { transaction: serialize(dup), duplicate: true } });
        }
        if (err.code !== 'P2002' || attempt === 2) throw err;
      }
    }

    emitChange('transaction', { date: toDateKey(when) });
    res.status(201).json({ status: 'success', message: 'Transaksi tersimpan.', data: { transaction: serialize(trx) } });
  }),
);

router.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { q, status, page, pageSize } = req.valid.query;
    const from = req.valid.query.from || todayKey();
    const to = req.valid.query.to || from;
    const { start, end } = rangeToDates(from <= to ? from : to, from <= to ? to : from);

    const where = {
      occurredAt: { gte: start, lt: end },
      ...(status !== 'ALL' ? { status } : {}),
      ...(q
        ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { note: { contains: q, mode: 'insensitive' } },
            { items: { some: { productName: { contains: q, mode: 'insensitive' } } } },
          ],
        }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where, include: includeAll, orderBy: { occurredAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);

    res.json({
      status: 'success',
      data: { transactions: rows.map(serialize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
    });
  }),
);

router.get(
  '/:id',
  validate({ params: J.object({ id: J.number().integer().positive().required() }) }),
  asyncHandler(async (req, res) => {
    const trx = await prisma.transaction.findUnique({ where: { id: req.valid.params.id }, include: includeAll });
    if (!trx) throw notFound('Transaksi tidak ditemukan.');
    res.json({ status: 'success', data: { transaction: serialize(trx) } });
  }),
);

router.patch(
  '/:id/void',
  validate({
    params: J.object({ id: J.number().integer().positive().required() }),
    body: J.object({ reason: J.string().trim().min(3).max(200).required().label('Alasan pembatalan') }),
  }),
  asyncHandler(async (req, res) => {
    const trx = await prisma.transaction.findUnique({ where: { id: req.valid.params.id } });
    if (!trx) throw notFound('Transaksi tidak ditemukan.');
    if (trx.status === 'VOID') throw unprocessable('Transaksi ini sudah dibatalkan sebelumnya.');

    if (req.user.role !== 'OWNER') {
      const sameDay = toDateKey(trx.occurredAt) === todayKey();
      if (trx.cashierId !== req.user.id || !sameDay) {
        throw forbidden('Kasir hanya bisa membatalkan transaksi miliknya sendiri pada hari yang sama. Hubungi pemilik.');
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: trx.id },
      data: { status: 'VOID', voidReason: req.valid.body.reason, voidedAt: new Date(), voidedById: req.user.id },
      include: includeAll,
    });
    emitChange('transaction', { date: toDateKey(trx.occurredAt) });
    res.json({ status: 'success', message: 'Transaksi dibatalkan.', data: { transaction: serialize(updated) } });
  }),
);

export default router;
