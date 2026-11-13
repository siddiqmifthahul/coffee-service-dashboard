import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { forbidden, unauthorized } from '../utils/errors.js';

// Cache singkat data user agar tiap request tidak perlu query DB (latensi ke Supabase).
const USER_CACHE_MS = 60_000;
const userCache = new Map();
export const invalidateUserCache = (id) => (id ? userCache.delete(Number(id)) : userCache.clear());

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Sesi Anda sudah berakhir. Silakan login ulang.');
    }

    const id = Number(payload.sub);
    let user = userCache.get(id);
    if (!user || user.expires < Date.now()) {
      const row = await prisma.user.findUnique({ where: { id } });
      user = row && { id: row.id, name: row.name, username: row.username, role: row.role, active: row.active, expires: Date.now() + USER_CACHE_MS };
      if (user) userCache.set(id, user);
    }
    if (!user || !user.active) throw unauthorized('Akun tidak aktif. Hubungi pemilik usaha.');

    req.user = { id: user.id, name: user.name, username: user.username, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};

export const ownerOnly = requireRole('OWNER');
