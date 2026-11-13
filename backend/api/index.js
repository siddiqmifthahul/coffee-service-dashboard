// Entry point serverless untuk Vercel.
// Semua request di-rewrite ke sini (lihat vercel.json) lalu ditangani aplikasi Express yang sama.
// Catatan: Socket.IO tidak tersedia di serverless; frontend memakai mode auto-refresh (VITE_REALTIME=polling).
import { createApp } from '../src/app.js';

export default createApp();
