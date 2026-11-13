import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { J, validate } from '../middleware/validate.js';
import { asyncHandler, unauthorized } from '../utils/errors.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Terlalu banyak percobaan login. Coba lagi 15 menit lagi.' },
});

const loginSchema = J.object({
  username: J.string().trim().lowercase().required().label('Username'),
  password: J.string().required().label('Password'),
});

const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role });

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.valid.body;
    const user = await prisma.user.findUnique({ where: { username } });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw unauthorized('Username atau password salah.');
    if (!user.active) throw unauthorized('Akun tidak aktif. Hubungi pemilik usaha.');
    res.json({ status: 'success', data: { token: signToken(user), user: publicUser(user) } });
  }),
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ status: 'success', data: { user: req.user } });
});

const passwordSchema = J.object({
  currentPassword: J.string().required().label('Password lama'),
  newPassword: J.string().min(6).max(72).required().label('Password baru'),
});

router.patch(
  '/password',
  requireAuth,
  validate({ body: passwordSchema }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.valid.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw unauthorized('Password lama salah.');
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    res.json({ status: 'success', message: 'Password berhasil diganti.' });
  }),
);

export default router;
