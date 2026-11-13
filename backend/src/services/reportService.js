import { prisma } from '../db.js';
import { rangeToDates, toDateKey, formatTimeWib } from '../utils/time.js';
import {
  aggregateDaily, cashByCategory, groupDaily, paymentBreakdown, pctChange, previousRange,
  productBreakdown, sumTotals,
} from './reportCore.js';

export async function fetchRange(fromKey, toKey, { includeVoid = false } = {}) {
  const { start, end } = rangeToDates(fromKey, toKey);
  const [transactions, cashEntries] = await Promise.all([
    prisma.transaction.findMany({
      where: { occurredAt: { gte: start, lt: end }, ...(includeVoid ? {} : { status: 'ACTIVE' }) },
      include: { items: true, cashier: { select: { name: true } } },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.cashEntry.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      include: { createdBy: { select: { name: true } } },
      orderBy: { occurredAt: 'asc' },
    }),
  ]);
  return { transactions, cashEntries };
}

export async function buildSummary(fromKey, toKey, groupBy = 'day') {
  const prev = previousRange(fromKey, toKey);
  const [curr, before] = await Promise.all([fetchRange(fromKey, toKey), fetchRange(prev.from, prev.to)]);

  const daily = aggregateDaily(curr.transactions, curr.cashEntries, fromKey, toKey);
  const totals = sumTotals(daily);
  const prevTotals = sumTotals(aggregateDaily(before.transactions, before.cashEntries, prev.from, prev.to));

  const compareKeys = ['income', 'expense', 'net', 'sales', 'grossProfit', 'transactions', 'cups', 'avgTicket'];
  const change = Object.fromEntries(compareKeys.map((k) => [k, pctChange(totals[k], prevTotals[k])]));

  return {
    range: { from: fromKey, to: toKey, groupBy },
    previousRange: prev,
    totals,
    previousTotals: prevTotals,
    change,
    buckets: groupDaily(daily, groupBy, fromKey, toKey),
    products: productBreakdown(curr.transactions),
    payments: paymentBreakdown(curr.transactions),
    expenseByCategory: cashByCategory(curr.cashEntries, 'PENGELUARAN'),
    incomeByCategory: cashByCategory(curr.cashEntries, 'PEMASUKAN'),
  };
}

export async function buildDaily(dateKey) {
  const { transactions, cashEntries } = await fetchRange(dateKey, dateKey, { includeVoid: true });
  const active = transactions.filter((t) => t.status === 'ACTIVE');
  const totals = sumTotals(aggregateDaily(active, cashEntries, dateKey, dateKey));

  // Jam tersibuk
  const hours = new Map();
  for (const t of active) {
    const h = formatTimeWib(t.occurredAt).slice(0, 2);
    hours.set(h, (hours.get(h) || 0) + t.itemCount);
  }

  return {
    date: dateKey,
    totals,
    products: productBreakdown(active),
    payments: paymentBreakdown(active),
    cashEntries: cashEntries.map((e) => ({
      id: e.id,
      type: e.type,
      category: e.category,
      amount: e.amount,
      description: e.description,
      occurredAt: e.occurredAt,
      createdBy: e.createdBy?.name,
      createdById: e.createdById,
    })),
    voidedCount: transactions.length - active.length,
    hourly: [...hours.entries()].map(([hour, cups]) => ({ hour, cups })).sort((a, b) => a.hour.localeCompare(b.hour)),
  };
}

/** Riwayat harian untuk forecasting (N hari terakhir sampai kemarin/hari ini) */
export async function dailyHistory(fromKey, toKey) {
  const { transactions, cashEntries } = await fetchRange(fromKey, toKey);
  const daily = aggregateDaily(transactions, cashEntries, fromKey, toKey);
  return [...daily.entries()].map(([date, t]) => ({ date, sales: t.sales, cups: t.cups, transactions: t.transactions }));
}

export { toDateKey };
