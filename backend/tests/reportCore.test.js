import { describe, expect, it } from 'vitest';
import { MONTHLY_QTY, PRODUCTS, generateTransactions } from '../prisma/seedData.js';
import {
  aggregateDaily, bucketOf, groupDaily, pctChange, previousRange, productBreakdown, sumTotals,
} from '../src/services/reportCore.js';
import { toDateKey } from '../src/utils/time.js';

const byName = new Map(PRODUCTS.map((p, i) => [p.name, { ...p, id: i + 1 }]));

/** Ubah transaksi hasil generator menjadi bentuk seperti dari database */
function toDbShape(gen) {
  return gen.map((t, idx) => {
    const items = t.items.map((it) => {
      const p = byName.get(it.name);
      return { productId: p.id, productName: p.name, price: p.price, hpp: p.hpp, qty: it.qty, subtotal: p.price * it.qty };
    });
    return {
      id: idx + 1,
      status: 'ACTIVE',
      paymentMethod: t.paymentMethod,
      occurredAt: new Date(`${t.date}T${t.time}:00+07:00`),
      total: items.reduce((s, i) => s + i.subtotal, 0),
      totalHpp: items.reduce((s, i) => s + i.hpp * i.qty, 0),
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      items,
    };
  });
}

const transactions = toDbShape(generateTransactions());
const cashEntries = MONTHLY_QTY.flatMap((m) => Object.entries(m.expenses).map(([category, amount]) => ({
  type: 'PENGELUARAN', category, amount, occurredAt: new Date(`${m.month}-01T08:00:00+07:00`),
})));

describe('seed dummy sesuai Excel UMKM', () => {
  for (const m of MONTHLY_QTY) {
    it(`bulan ${m.month}: omzet, HPP & pendapatan bersih sama dengan Excel`, () => {
      const from = `${m.month}-01`;
      const to = `${m.month}-${String(m.lastDay).padStart(2, '0')}`;
      const totals = sumTotals(aggregateDaily(transactions, cashEntries, from, to));
      expect(totals.sales).toBe(m.excel.sales);
      expect(totals.hpp).toBe(m.excel.hpp);
      // Excel: Pendapatan Bersih = (Pendapatan Kotor − HPP) − biaya operasional
      expect(totals.grossProfit - totals.expense).toBe(m.excel.net);
    });
  }

  it('qty per menu bulan Agustus sama dengan Excel', () => {
    const aug = transactions.filter((t) => toDateKey(t.occurredAt).startsWith('2026-08'));
    const products = productBreakdown(aug);
    for (const [name, qty] of Object.entries(MONTHLY_QTY[0].qty)) {
      expect(products.find((p) => p.name === name)?.qty).toBe(qty);
    }
  });
});

describe('pengelompokan rekap', () => {
  const from = '2026-08-01';
  const to = '2026-10-31';
  const daily = aggregateDaily(transactions, cashEntries, from, to);
  const grand = sumTotals(daily);

  for (const groupBy of ['day', '5day', 'week', 'month']) {
    it(`groupBy=${groupBy}: jumlah semua bucket = total keseluruhan`, () => {
      const buckets = groupDaily(daily, groupBy, from, to);
      const sum = (k) => buckets.reduce((s, b) => s + b[k], 0);
      expect(sum('sales')).toBe(grand.sales);
      expect(sum('expense')).toBe(grand.expense);
      expect(sum('net')).toBe(grand.net);
      expect(sum('cups')).toBe(grand.cups);
      expect(buckets.reduce((s, b) => s + b.days, 0)).toBe(92);
    });
  }

  it('bucket 5 hari: 1–5, 6–10, …, 26–akhir bulan', () => {
    expect(bucketOf('2026-08-03', '5day')).toMatchObject({ start: '2026-08-01', end: '2026-08-05' });
    expect(bucketOf('2026-08-10', '5day')).toMatchObject({ start: '2026-08-06', end: '2026-08-10' });
    expect(bucketOf('2026-08-31', '5day')).toMatchObject({ start: '2026-08-26', end: '2026-08-31' });
    expect(bucketOf('2026-09-30', '5day')).toMatchObject({ start: '2026-09-26', end: '2026-09-30' });
    expect(groupDaily(daily, '5day', from, to)).toHaveLength(18);
  });

  it('bucket minggu dimulai hari Senin', () => {
    // 13 Nov 2026 = Jumat
    expect(bucketOf('2026-11-13', 'week')).toMatchObject({ start: '2026-11-09', end: '2026-11-15' });
    expect(bucketOf('2026-11-09', 'week').start).toBe('2026-11-09');
  });

  it('label bucket dipotong sesuai rentang filter', () => {
    const d = aggregateDaily(transactions, cashEntries, '2026-08-03', '2026-08-12');
    const b = groupDaily(d, '5day', '2026-08-03', '2026-08-12');
    expect(b.map((x) => x.label)).toEqual(['3–5 Agu 2026', '6–10 Agu 2026', '11–12 Agu 2026']);
  });

  it('transaksi VOID tidak dihitung', () => {
    const t = { ...transactions[0], status: 'VOID' };
    const d = aggregateDaily([t], [], toDateKey(t.occurredAt), toDateKey(t.occurredAt));
    expect(sumTotals(d).sales).toBe(0);
  });
});

describe('perbandingan periode', () => {
  it('periode sebelumnya punya panjang yang sama', () => {
    expect(previousRange('2026-11-09', '2026-11-13')).toEqual({ from: '2026-11-04', to: '2026-11-08' });
    expect(previousRange('2026-11-01', '2026-11-30')).toEqual({ from: '2026-10-02', to: '2026-10-31' });
  });
  it('persentase perubahan', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});
