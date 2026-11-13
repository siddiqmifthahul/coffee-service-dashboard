const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diisi di environment production.');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  isProd,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-ganti-di-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Beberapa origin bisa dipisah koma, mis. "http://localhost:5173,https://coffee.vercel.app"
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 15000,
};
