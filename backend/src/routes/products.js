import { Router } from 'express';
import { prisma } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { J, validate } from '../middleware/validate.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { emitChange } from '../realtime.js';

const router = Router();

const productBody = J.object({
  name: J.string().trim().min(2).max(60).required().label('Nama menu'),
  category: J.string().valid('KOPI', 'NON_KOPI', 'TAMBAHAN').required().label('Kategori'),
  price: J.number().integer().min(0).max(10_000_000).required().label('Harga jual'),
  hpp: J.number().integer().min(0).max(10_000_000).required().label('HPP'),
  isActive: J.boolean().default(true).label('Status aktif'),
  sortOrder: J.number().integer().min(0).default(0).label('Urutan'),
});

const idParam = J.object({ id: J.number().integer().positive().required().label('ID') });

router.get(
  '/',
  validate({ query: J.object({ includeInactive: J.boolean().default(false) }) }),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: req.valid.query.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ status: 'success', data: { products } });
  }),
);

router.post(
  '/',
  ownerOnly,
  validate({ body: productBody }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({ data: req.valid.body });
    emitChange('product');
    res.status(201).json({ status: 'success', message: 'Menu berhasil ditambahkan.', data: { product } });
  }),
);

router.put(
  '/:id',
  ownerOnly,
  validate({ params: idParam, body: productBody }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw notFound('Menu tidak ditemukan.');
    const product = await prisma.product.update({ where: { id }, data: req.valid.body });
    emitChange('product');
    res.json({ status: 'success', message: 'Menu berhasil diperbarui.', data: { product } });
  }),
);

// Menu tidak dihapus permanen agar riwayat transaksi tetap utuh -> dinonaktifkan.
router.delete(
  '/:id',
  ownerOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw notFound('Menu tidak ditemukan.');
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    emitChange('product');
    res.json({ status: 'success', message: 'Menu dinonaktifkan dan tidak tampil lagi di kasir.' });
  }),
);

export default router;
