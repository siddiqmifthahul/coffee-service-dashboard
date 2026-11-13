import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { initRealtime } from './realtime.js';

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

server.listen(config.port, () => {
  console.log(`☕ Coffee Service API berjalan di http://localhost:${config.port}`);
  console.log(`   CORS origin: ${config.corsOrigins.join(', ')} | AI service: ${config.aiServiceUrl}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
