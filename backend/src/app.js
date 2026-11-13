import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { ownerOnly, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import transactionRoutes from './routes/transactions.js';
import cashRoutes from './routes/cashEntries.js';
import reportRoutes from './routes/reports.js';
import exportRoutes from './routes/exports.js';
import aiRoutes from './routes/ai.js';
import userRoutes from './routes/users.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/', (_req, res) => res.json({ name: 'Coffee Service API', version: 'v1', docs: '/api/v1/health' }));
  app.get('/api/v1/health', async (_req, res) => {
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'success' : 'error', data: { api: 'ok', db, time: new Date().toISOString() } });
  });

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/products', requireAuth, productRoutes);
  v1.use('/transactions', requireAuth, transactionRoutes);
  v1.use('/cash-entries', requireAuth, cashRoutes);
  v1.use('/reports', requireAuth, reportRoutes);
  v1.use('/exports', requireAuth, ownerOnly, exportRoutes);
  v1.use('/ai', requireAuth, aiRoutes);
  v1.use('/users', requireAuth, ownerOnly, userRoutes);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
