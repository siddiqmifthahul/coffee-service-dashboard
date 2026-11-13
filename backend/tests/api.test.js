// Tes API. Bagian pertama tidak butuh database.
// Bagian kedua (integrasi DB) hanya jalan lewat `npm run test:db` (butuh DATABASE_URL di .env) —
// data uji memakai prefix 'test-' dan dibersihkan setelah selesai.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';

try { process.loadEnvFile('.env'); } catch { /* .env opsional */ }
process.env.DATABASE_URL ||= 'postgresql://x:y@127.0.0.1:1/none';
process.env.DIRECT_URL ||= process.env.DATABASE_URL;

const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/middleware/auth.js');
const app = createApp();

describe('API tanpa database', () => {
  it('endpoint tidak dikenal -> 404 dengan pesan jelas', async () => {
    const res = await request(app).get('/api/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/tidak ditemukan/);
  });

  it('tanpa token -> 401', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/login/i);
  });

  it('login dengan body kosong -> 422 + pesan per field (Bahasa Indonesia)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.errors.username).toBe('Username wajib diisi');
    expect(res.body.errors.password).toBe('Password wajib diisi');
  });

  it('JSON rusak -> 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
  });
});

const RUN_DB = process.env.RUN_DB_TESTS === '1' || import.meta.env.MODE === 'db';

const { prisma } = await import('../src/db.js');
const { todayKey } = await import('../src/utils/time.js');

describe.runIf(RUN_DB)('API dengan database (integrasi)', { timeout: 30000 }, () => {
  let kasir;
  let owner;
  let product;
  const auth = (u) => ({ Authorization: `Bearer ${signToken(u)}` });
  const today = todayKey();

  beforeAll(async () => {
    await prisma.$connect();
    owner = await prisma.user.upsert({ where: { username: 'test_owner' }, update: { active: true }, create: { name: 'Test Owner', username: 'test_owner', role: 'OWNER', passwordHash: 'x' } });
    kasir = await prisma.user.upsert({ where: { username: 'test_kasir' }, update: { active: true }, create: { name: 'Test Kasir', username: 'test_kasir', role: 'KASIR', passwordHash: 'x' } });
    product = await prisma.product.upsert({ where: { name: 'Test Kopi' }, update: { isActive: true, price: 18000, hpp: 7000 }, create: { name: 'Test Kopi', category: 'KOPI', price: 18000, hpp: 7000 } });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { clientId: { startsWith: 'test-' } } });
    await prisma.cashEntry.deleteMany({ where: { clientId: { startsWith: 'test-' } } });
    await prisma.aiLog.deleteMany({ where: { userId: { in: [owner.id, kasir.id] } } });
    await prisma.product.deleteMany({ where: { name: 'Test Kopi' } });
    await prisma.user.deleteMany({ where: { username: { in: ['test_owner', 'test_kasir'] } } });
    await prisma.$disconnect();
  });

  it('qty kosong/0 ditolak 422', async () => {
    const res = await request(app).post('/api/v1/transactions').set(auth(kasir))
      .send({ clientId: 'test-invalid-0001', items: [{ productId: product.id, qty: 0 }] });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Jumlah pesanan minimal 1/);
  });

  it('simpan transaksi + autosave idempoten (clientId sama = 1 transaksi)', async () => {
    const body = { clientId: 'test-idem-0001', items: [{ productId: product.id, qty: 3 }], paymentMethod: 'QRIS' };
    const first = await request(app).post('/api/v1/transactions').set(auth(kasir)).send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.transaction.total).toBe(54000);
    const second = await request(app).post('/api/v1/transactions').set(auth(kasir)).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(await prisma.transaction.count({ where: { clientId: 'test-idem-0001' } })).toBe(1);
  });

  it('pengeluaran tercatat & rekap harian ter-update', async () => {
    const before = (await request(app).get(`/api/v1/reports/daily?date=${today}`).set(auth(kasir))).body.data.totals;
    const res = await request(app).post('/api/v1/cash-entries').set(auth(kasir))
      .send({ clientId: 'test-cash-0001', type: 'PENGELUARAN', category: 'Bahan Baku', amount: 25000, description: 'Susu' });
    expect(res.status).toBe(201);
    const after = (await request(app).get(`/api/v1/reports/daily?date=${today}`).set(auth(kasir))).body.data.totals;
    expect(after.expense - before.expense).toBe(25000);
    expect(after.net - before.net).toBe(-25000);
  });

  it('kasir tidak boleh akses rekap periode / export (403)', async () => {
    expect((await request(app).get(`/api/v1/reports/summary?from=${today}&to=${today}`).set(auth(kasir))).status).toBe(403);
    expect((await request(app).get(`/api/v1/exports?from=${today}&to=${today}`).set(auth(kasir))).status).toBe(403);
  });

  it('summary 5 hari: total bucket = total keseluruhan', async () => {
    const res = await request(app).get(`/api/v1/reports/summary?from=${today.slice(0, 7)}-01&to=${today}&groupBy=5day`).set(auth(owner));
    expect(res.status).toBe(200);
    const { buckets, totals } = res.body.data;
    expect(buckets.reduce((s, b) => s + b.net, 0)).toBe(totals.net);
  });

  it('void transaksi -> tidak dihitung di rekap', async () => {
    const trx = await prisma.transaction.findUnique({ where: { clientId: 'test-idem-0001' } });
    const before = (await request(app).get(`/api/v1/reports/daily?date=${today}`).set(auth(owner))).body.data.totals.sales;
    const res = await request(app).patch(`/api/v1/transactions/${trx.id}/void`).set(auth(kasir)).send({ reason: 'Salah input' });
    expect(res.status).toBe(200);
    const after = (await request(app).get(`/api/v1/reports/daily?date=${today}`).set(auth(owner))).body.data.totals.sales;
    expect(before - after).toBe(54000);
  });

  it('export xlsx berisi sheet yang dipilih', async () => {
    const res = await request(app).get(`/api/v1/exports?from=${today}&to=${today}&format=xlsx&include=harian,kas`)
      .set(auth(owner)).buffer(true).parse((r, cb) => { const d = []; r.on('data', (c) => d.push(c)); r.on('end', () => cb(null, Buffer.concat(d))); });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Ringkasan', 'Rekap Harian', 'Pemasukan & Pengeluaran']);
  });

  it('export csv lebih dari 1 isi data ditolak 422', async () => {
    const res = await request(app).get(`/api/v1/exports?from=${today}&to=${today}&format=csv&include=harian,kas`).set(auth(owner));
    expect(res.status).toBe(422);
  });

  it('AI insight selalu 200 (available=false bila AI service mati)', async () => {
    const res = await request(app).post('/api/v1/ai/insight').set(auth(owner)).send({ from: today, to: today });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.available).toBe('boolean');
  });
});
