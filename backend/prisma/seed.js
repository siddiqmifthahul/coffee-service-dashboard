// Seed database: akun demo, menu dari Excel UMKM, dan transaksi DUMMY Agustus–12 November 2026.
// Jalankan: npm run db:seed            (aman diulang; data seed lama tidak diduplikasi)
//           npm run db:seed -- --reset (hapus data seed lama lalu buat ulang)
//           npm run db:seed -- --no-transactions (hanya akun + menu, untuk pemakaian nyata)

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { MONTHLY_QTY, PRODUCTS, generateTransactions } from './seedData.js';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const SEED_NOTE = 'Data dummy (dibangkitkan dari rekap bulanan Excel UMKM)';

async function main() {
  console.log('→ Akun demo');
  const [owner, kasir] = await Promise.all([
    prisma.user.upsert({
      where: { username: 'owner' },
      update: {},
      create: { name: 'Rahmat (Owner)', username: 'owner', role: 'OWNER', passwordHash: await bcrypt.hash('owner123', 10) },
    }),
    prisma.user.upsert({
      where: { username: 'kasir' },
      update: {},
      create: { name: 'Kasir 1', username: 'kasir', role: 'KASIR', passwordHash: await bcrypt.hash('kasir123', 10) },
    }),
  ]);

  console.log('→ Menu (18 item)');
  for (const [i, p] of PRODUCTS.entries()) {
    await prisma.product.upsert({ where: { name: p.name }, update: {}, create: { ...p, sortOrder: i + 1 } });
  }

  if (args.has('--no-transactions')) return;

  if (args.has('--reset')) {
    console.log('→ Menghapus data seed lama');
    await prisma.transaction.deleteMany({ where: { clientId: { startsWith: 'seed-' } } });
    await prisma.cashEntry.deleteMany({ where: { clientId: { startsWith: 'seed-' } } });
  } else if (await prisma.transaction.count({ where: { clientId: { startsWith: 'seed-' } } })) {
    console.log('✓ Data transaksi seed sudah ada (pakai --reset untuk membuat ulang).');
    return;
  }

  const products = await prisma.product.findMany();
  const byName = new Map(products.map((p) => [p.name, p]));
  const generated = generateTransactions();

  console.log(`→ ${generated.length} transaksi dummy`);
  const trxRows = generated.map((t, idx) => {
    const lines = t.items.map((it) => ({ p: byName.get(it.name), qty: it.qty }));
    return {
      clientId: `seed-${String(idx + 1).padStart(5, '0')}`,
      code: `TRX-${t.date.replaceAll('-', '').slice(2)}-S${String(idx + 1).padStart(4, '0')}`,
      occurredAt: new Date(`${t.date}T${t.time}:00+07:00`),
      cashierId: kasir.id,
      paymentMethod: t.paymentMethod,
      note: SEED_NOTE,
      total: lines.reduce((s, l) => s + l.p.price * l.qty, 0),
      totalHpp: lines.reduce((s, l) => s + l.p.hpp * l.qty, 0),
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
    };
  });

  for (let i = 0; i < trxRows.length; i += 500) {
    await prisma.transaction.createMany({ data: trxRows.slice(i, i + 500) });
  }

  const saved = await prisma.transaction.findMany({
    where: { clientId: { startsWith: 'seed-' } },
    select: { id: true, clientId: true },
  });
  const idByClient = new Map(saved.map((s) => [s.clientId, s.id]));

  const itemRows = generated.flatMap((t, idx) => t.items.map((it) => {
    const p = byName.get(it.name);
    return {
      transactionId: idByClient.get(`seed-${String(idx + 1).padStart(5, '0')}`),
      productId: p.id,
      productName: p.name,
      price: p.price,
      hpp: p.hpp,
      qty: it.qty,
      subtotal: p.price * it.qty,
    };
  }));
  for (let i = 0; i < itemRows.length; i += 1000) {
    await prisma.transactionItem.createMany({ data: itemRows.slice(i, i + 1000) });
  }

  console.log('→ Biaya operasional bulanan');
  const cashRows = MONTHLY_QTY.flatMap((m) => Object.entries(m.expenses).map(([category, amount]) => ({
    clientId: `seed-${m.month}-${category}`,
    type: 'PENGELUARAN',
    category,
    amount,
    description: 'Biaya bulanan (dari Excel UMKM)',
    occurredAt: new Date(`${m.month}-01T08:00:00+07:00`),
    createdById: owner.id,
  })));
  await prisma.cashEntry.createMany({ data: cashRows, skipDuplicates: true });

  console.log('✓ Seed selesai. Login demo: owner/owner123 dan kasir/kasir123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
