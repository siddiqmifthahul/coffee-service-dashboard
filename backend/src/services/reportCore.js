// Logika rekap murni (tanpa database) agar mudah diuji.
// Input: daftar transaksi (dengan items) & entri kas yang sudah difilter rentang tanggalnya.

import {
  addDays, daysInMonth, diffDays, eachDay, formatDateId, formatMonthId, toDateKey, weekdayIndex,
} from '../utils/time.js';

export const GROUP_BY = ['day', '5day', 'week', 'month'];

function emptyTotals() {
  return {
    sales: 0, // omzet penjualan
    hpp: 0,
    otherIncome: 0, // pemasukan lain (CashEntry PEMASUKAN)
    expense: 0, // pengeluaran (CashEntry PENGELUARAN)
    transactions: 0,
    cups: 0,
  };
}

function finalize(t) {
  const income = t.sales + t.otherIncome;
  return {
    ...t,
    income,
    net: income - t.expense,
    grossProfit: t.sales - t.hpp,
    avgTicket: t.transactions ? Math.round(t.sales / t.transactions) : 0,
  };
}

function addInto(target, src) {
  for (const k of Object.keys(target)) target[k] += src[k] || 0;
}

/** Agregasi per hari (key = YYYY-MM-DD WIB) */
export function aggregateDaily(transactions, cashEntries, fromKey, toKey) {
  const days = new Map(eachDay(fromKey, toKey).map((k) => [k, emptyTotals()]));

  for (const trx of transactions) {
    if (trx.status && trx.status !== 'ACTIVE') continue;
    const d = days.get(toDateKey(trx.occurredAt));
    if (!d) continue;
    d.sales += trx.total;
    d.hpp += trx.totalHpp;
    d.transactions += 1;
    d.cups += trx.itemCount ?? (trx.items || []).reduce((s, i) => s + i.qty, 0);
  }

  for (const e of cashEntries) {
    const d = days.get(toDateKey(e.occurredAt));
    if (!d) continue;
    if (e.type === 'PEMASUKAN') d.otherIncome += e.amount;
    else d.expense += e.amount;
  }

  return days;
}

/** Kunci & label bucket untuk sebuah tanggal */
export function bucketOf(key, groupBy) {
  const [y, m, d] = key.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  switch (groupBy) {
    case '5day': {
      // 1–5, 6–10, 11–15, 16–20, 21–25, 26–akhir bulan
      const idx = Math.min(Math.floor((d - 1) / 5), 5);
      const startDay = idx * 5 + 1;
      const endDay = idx === 5 ? daysInMonth(y, m) : startDay + 4;
      return {
        key: `${y}-${mm}-${String(startDay).padStart(2, '0')}`,
        start: `${y}-${mm}-${String(startDay).padStart(2, '0')}`,
        end: `${y}-${mm}-${String(endDay).padStart(2, '0')}`,
      };
    }
    case 'week': {
      const start = addDays(key, -weekdayIndex(key));
      return { key: start, start, end: addDays(start, 6) };
    }
    case 'month': {
      const last = daysInMonth(y, m);
      return { key: `${y}-${mm}`, start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
    }
    default:
      return { key, start: key, end: key };
  }
}

function bucketLabel(b, groupBy, fromKey, toKey) {
  // label memakai rentang yang terpotong sesuai filter
  const s = b.start < fromKey ? fromKey : b.start;
  const e = b.end > toKey ? toKey : b.end;
  if (groupBy === 'day') return formatDateId(s);
  if (groupBy === 'month') return formatMonthId(b.key);
  const sameMonth = s.slice(0, 7) === e.slice(0, 7);
  if (s === e) return formatDateId(s);
  return sameMonth
    ? `${Number(s.slice(8))}–${formatDateId(e)}`
    : `${formatDateId(s, { withYear: false })} – ${formatDateId(e)}`;
}

/** Kelompokkan agregat harian menjadi bucket (hari/5 hari/minggu/bulan) */
export function groupDaily(dailyMap, groupBy, fromKey, toKey) {
  const buckets = new Map();
  for (const [key, totals] of dailyMap) {
    const b = bucketOf(key, groupBy);
    if (!buckets.has(b.key)) {
      buckets.set(b.key, { ...b, totals: emptyTotals(), days: 0 });
    }
    const target = buckets.get(b.key);
    addInto(target.totals, totals);
    target.days += 1;
  }
  return [...buckets.values()].map((b) => ({
    key: b.key,
    start: b.start < fromKey ? fromKey : b.start,
    end: b.end > toKey ? toKey : b.end,
    label: bucketLabel(b, groupBy, fromKey, toKey),
    days: b.days,
    ...finalize(b.totals),
  }));
}

export function sumTotals(dailyMap) {
  const t = emptyTotals();
  for (const v of dailyMap.values()) addInto(t, v);
  return finalize(t);
}

/** Rekap per menu (mirip sheet Excel UMKM) */
export function productBreakdown(transactions) {
  const map = new Map();
  for (const trx of transactions) {
    if (trx.status && trx.status !== 'ACTIVE') continue;
    for (const it of trx.items || []) {
      const key = it.productId;
      if (!map.has(key)) {
        map.set(key, { productId: it.productId, name: it.productName, qty: 0, sales: 0, hpp: 0, prices: new Set() });
      }
      const p = map.get(key);
      p.qty += it.qty;
      p.sales += it.subtotal;
      p.hpp += it.hpp * it.qty;
      p.prices.add(it.price);
    }
  }
  return [...map.values()]
    .map(({ prices, ...p }) => ({
      ...p,
      price: prices.size === 1 ? [...prices][0] : Math.round(p.sales / p.qty),
      unitHpp: Math.round(p.hpp / p.qty),
      grossProfit: p.sales - p.hpp,
    }))
    .sort((a, b) => b.qty - a.qty || b.sales - a.sales);
}

export function paymentBreakdown(transactions) {
  const out = { TUNAI: { count: 0, amount: 0 }, QRIS: { count: 0, amount: 0 }, TRANSFER: { count: 0, amount: 0 } };
  for (const trx of transactions) {
    if (trx.status && trx.status !== 'ACTIVE') continue;
    const p = out[trx.paymentMethod] || (out[trx.paymentMethod] = { count: 0, amount: 0 });
    p.count += 1;
    p.amount += trx.total;
  }
  return out;
}

export function cashByCategory(cashEntries, type) {
  const map = new Map();
  for (const e of cashEntries) {
    if (e.type !== type) continue;
    map.set(e.category, (map.get(e.category) || 0) + e.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function previousRange(fromKey, toKey) {
  const len = diffDays(fromKey, toKey) + 1;
  return { from: addDays(fromKey, -len), to: addDays(fromKey, -1) };
}

export function pctChange(curr, prev) {
  if (!prev) return curr ? null : 0; // null = tidak bisa dibandingkan (sebelumnya 0)
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}
