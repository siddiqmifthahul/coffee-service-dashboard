import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { rupiah, rupiahShort } from '../lib/format';
import { cx } from './ui';

// Palet tervalidasi (slot kategorikal 1 & 2): biru = pemasukan, oranye = pengeluaran
export const SERIES = { income: '#2a78d6', expense: '#eb6834' };
const INK = { primary: '#1c1917', secondary: '#57534e', muted: '#a8a29e', grid: '#ece9e4' };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-semibold text-stone-900">{row.fullLabel || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-stone-600">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.name}
          </span>
          <span className="font-semibold text-stone-900">{rupiah(p.value)}</span>
        </div>
      ))}
      <div className="tabular mt-1 flex justify-between gap-4 border-t border-stone-100 pt-1 text-stone-600">
        <span>Saldo</span><span className={cx('font-semibold', row.net < 0 ? 'text-red-600' : 'text-stone-900')}>{rupiah(row.net)}</span>
      </div>
    </div>
  );
}

/** Grafik batang berkelompok: pemasukan vs pengeluaran per periode (satu sumbu Rupiah) */
export function IncomeExpenseChart({ buckets, height = 280 }) {
  const data = buckets.map((b) => ({
    label: b.label.replace(/ \d{4}$/, ''),
    fullLabel: b.label,
    income: b.income,
    expense: b.expense,
    net: b.net,
  }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: INK.grid }} tick={{ fill: INK.secondary, fontSize: 12 }} minTickGap={8} />
          <YAxis tickFormatter={rupiahShort} tickLine={false} axisLine={false} tick={{ fill: INK.secondary, fontSize: 12 }} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(120,113,108,0.08)' }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, color: INK.secondary, paddingTop: 8 }} />
          <Bar dataKey="income" name="Pemasukan" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expense" name="Pengeluaran" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daftar batang horizontal sederhana (satu seri, label & nilai sebagai teks) */
export function BarList({ items, valueFormat = rupiah, color = SERIES.income, emptyText = 'Belum ada data' }) {
  const [hover, setHover] = useState(null);
  if (!items.length) return <p className="py-6 text-center text-sm text-stone-500">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it, idx) => (
        <li key={it.label} onMouseEnter={() => setHover(idx)} onMouseLeave={() => setHover(null)} title={`${it.label}: ${valueFormat(it.value)}${it.hint ? ` · ${it.hint}` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-stone-800">{it.label}</span>
            <span className="tabular shrink-0 font-semibold text-stone-900">
              {valueFormat(it.value)}{it.hint && <span className="ml-1.5 font-normal text-stone-500">{it.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div
              className="h-2 rounded-full transition-[width,opacity]"
              style={{ width: `${Math.max((it.value / max) * 100, 2)}%`, background: color, opacity: hover === null || hover === idx ? 1 : 0.45 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
