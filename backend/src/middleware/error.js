import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ status: 'fail', message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: 'fail',
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'fail', message: 'Format data (JSON) tidak valid.' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ status: 'fail', message: 'Data dengan nilai tersebut sudah ada.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ status: 'fail', message: 'Data tidak ditemukan.' });
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('[db]', err.message);
    return res.status(503).json({
      status: 'error',
      message: 'Database sedang tidak dapat dihubungi. Data Anda belum hilang — coba lagi sebentar lagi.',
    });
  }

  console.error('[error]', err);
  res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
}
