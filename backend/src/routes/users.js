import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { J, validate } from '../middleware/validate.js';
import { asyncHandler, notFound, unprocessable } from '../utils/errors.js';
import { invalidateUserCache } from '../middleware/auth.js';

const router = Router(); // dipasang dengan ownerOnly di app.js

const select = { id: true, name: true, username: true, role: true, active: true, createdAt: true };

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    res.json({ status: 'success', data: { users } });
  }),
);

router.post(
  '/',
  validate({
    body: J.object({
      name: J.string().trim().min(2).max(50).required().label('Nama'),
      username: J.string().trim().lowercase().pattern(/^[a-z0-9_.]{3,30}$/).required().label('Username'),
      password: J.string().min(6).max(72).required().label('Password'),
      role: J.string().valid('OWNER', 'KASIR').default('KASIR').label('Peran'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.valid.body;
    if (await prisma.user.findUnique({ where: { username: rest.username } })) {
      throw unprocessable('Username sudah dipakai.', { username: 'Username sudah dipakai' });
    }
    const user = await prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) }, select });
    res.status(201).json({ status: 'success', message: 'Akun berhasil dibuat.', data: { user } });
  }),
);

router.patch(
  '/:id',
  validate({
    params: J.object({ id: J.number().integer().positive().required() }),
    body: J.object({
      name: J.string().trim().min(2).max(50).label('Nama'),
      role: J.string().valid('OWNER', 'KASIR').label('Peran'),
      active: J.boolean().label('Status aktif'),
      password: J.string().min(6).max(72).label('Password baru'),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw notFound('Akun tidak ditemukan.');
    const { password, ...rest } = req.valid.body;
    if (id === req.user.id && (rest.active === false || rest.role === 'KASIR')) {
      throw unprocessable('Anda tidak bisa menonaktifkan atau menurunkan peran akun sendiri.');
    }
    const user = await prisma.user.update({
      where: { id },
      data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      select,
    });
    invalidateUserCache(id);
    res.json({ status: 'success', message: 'Akun diperbarui.', data: { user } });
  }),
);

export default router;
