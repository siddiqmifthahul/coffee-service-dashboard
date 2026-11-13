import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownCircle, ArrowUpCircle, Coffee, PiggyBank, Receipt, Scale, ShoppingBag,
} from 'lucide-react';
import { errorMessage } from '../lib/api';
import { PAYMENT_LABEL, num, rupiah } from '../lib/format';
import { daysBetween, fmtRange, presetRange } from '../lib/dates';
import { useSummary } from '../lib/queries';
import DateRangePicker from '../components/DateRangePicker';
import { BarList, IncomeExpenseChart, SERIES } from '../components/charts';
import { ForecastCard, InsightCard } from '../components/AiCards';
import {
  Card, CardHeader, ErrorState, PageHeader, Segmented, Skeleton, StatCard,
} from '../components/ui';

export const GROUP_OPTIONS = [
  { value: 'day', label: 'Harian' },
  { value: '5day', label: '5 Hari' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
];

export const autoGroup = (from, to) => {
  const n = daysBetween(from, to);
  if (n <= 31) return 'day';
  if (n <= 92) return 'week';
  return 'month';
};

const LS_KEY = 'cs_dashboard_range';

function initialRange() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved?.preset && saved.preset !== 'custom') return { preset: saved.preset, ...presetRange(saved.preset) };
  } catch { /* abaikan */ }
  return { preset: '7d', ...presetRange('7d') };
}

export default function DashboardPage() {
  const [range, setRange] = useState(initialRange);
  const [groupBy, setGroupBy] = useState(() => autoGroup(range.from, range.to));
  const q = useSummary({ from: range.from, to: range.to, groupBy });
  const s = q.data;
  const t = s?.totals;

  const changeRange = (r) => {
    setRange(r);
    setGroupBy(autoGroup(r.from, r.to));
    try { localStorage.setItem(LS_KEY, JSON.stringify({ preset: r.preset })); } catch { /* abaikan */ }
  };

  const loading = !s;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Pemantauan realtime · ${fmtRange(range.from, range.to)}`}>
        <DateRangePicker value={range} onChange={changeRange} />
      </PageHeader>

      {q.isError ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /></Card>
      ) : (
        <div className={q.isFetching && !loading ? 'opacity-90 transition-opacity' : ''}>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard loading={loading} label="Total pemasukan" icon={ArrowDownCircle} accent="text-[#2a78d6]" value={rupiah(t?.income)} delta={s?.change.income} />
            <StatCard loading={loading} label="Total pengeluaran" icon={ArrowUpCircle} accent="text-[#eb6834]" value={rupiah(t?.expense)} delta={s?.change.expense} inverse />
            <StatCard loading={loading} label="Saldo bersih" icon={Scale} accent="text-brand-600" value={rupiah(t?.net)} delta={s?.change.net} />
            <StatCard loading={loading} label="Laba kotor (− HPP)" icon={PiggyBank} accent="text-brand-600" value={rupiah(t?.grossProfit)} delta={s?.change.grossProfit} />
            <StatCard loading={loading} label="Transaksi" icon={Receipt} value={num(t?.transactions)} delta={s?.change.transactions} />
            <StatCard loading={loading} label="Cup terjual" icon={Coffee} value={num(t?.cups)} hint={t ? `Rata-rata ${rupiah(t.avgTicket)} / transaksi` : ''} />
          </div>

          {/* Grafik pemasukan vs pengeluaran */}
          <Card className="mt-5">
            <CardHeader
              title="Pemasukan vs pengeluaran"
              subtitle="Arahkan kursor/ketuk batang untuk melihat angka & saldo."
              action={<Segmented options={GROUP_OPTIONS} value={groupBy} onChange={setGroupBy} className="hidden sm:inline-flex" />}
            />
            <div className="px-3 pb-4 pt-3 sm:px-5">
              <Segmented options={GROUP_OPTIONS} value={groupBy} onChange={setGroupBy} className="mb-3 w-full sm:hidden [&>button]:flex-1" />
              {loading ? <Skeleton className="h-[280px]" /> : <IncomeExpenseChart buckets={s.buckets} />}
              <div className="mt-2 text-right">
                <Link to={`/rekap?from=${range.from}&to=${range.to}&groupBy=${groupBy}`} className="text-sm font-semibold text-brand-700">Lihat tabel rekap →</Link>
              </div>
            </div>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Menu terlaris" subtitle="Berdasarkan jumlah cup terjual." action={<ShoppingBag className="size-5 text-stone-300" />} />
              <div className="px-5 pb-5 pt-4">
                {loading ? <Skeleton className="h-40" /> : (
                  <BarList
                    valueFormat={(v) => `${num(v)} cup`}
                    items={s.products.slice(0, 6).map((p) => ({ label: p.name, value: p.qty, hint: rupiah(p.sales) }))}
                    emptyText="Belum ada penjualan di periode ini."
                  />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Pengeluaran per kategori" subtitle="Ke mana uang keluar di periode ini." />
              <div className="px-5 pb-5 pt-4">
                {loading ? <Skeleton className="h-40" /> : (
                  <>
                    <BarList
                      color={SERIES.expense}
                      items={s.expenseByCategory.map((c) => ({ label: c.category, value: c.amount }))}
                      emptyText="Tidak ada pengeluaran di periode ini."
                    />
                    <div className="mt-5 border-t border-stone-100 pt-4">
                      <div className="mb-2 text-sm font-semibold text-stone-700">Metode pembayaran</div>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(s.payments).map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-stone-50 px-3 py-2">
                            <div className="text-xs text-stone-500">{PAYMENT_LABEL[k]} · {num(v.count)}×</div>
                            <div className="tabular text-sm font-bold">{rupiah(v.amount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <InsightCard from={range.from} to={range.to} />
            <ForecastCard />
          </div>
        </div>
      )}
    </div>
  );
}
