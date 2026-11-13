import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, FileSpreadsheet } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { num, rupiah } from '../lib/format';
import { fmtRange, presetRange } from '../lib/dates';
import { useSummary } from '../lib/queries';
import DateRangePicker from '../components/DateRangePicker';
import { GROUP_OPTIONS } from './DashboardPage';
import {
  Button, Card, EmptyState, ErrorState, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

const PRESETS = [
  { id: 'month', label: 'Bulan ini' },
  { id: 'lastMonth', label: 'Bulan lalu' },
  { id: '3m', label: '3 Bulan' },
];

export default function RecapPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [range, setRange] = useState(() => {
    const from = params.get('from');
    const to = params.get('to');
    return from && to ? { preset: 'custom', from, to } : { preset: 'month', ...presetRange('month') };
  });
  const [groupBy, setGroupBy] = useState(() => params.get('groupBy') || '5day');
  const q = useSummary({ from: range.from, to: range.to, groupBy });
  const s = q.data;

  const drill = (b) => {
    if (groupBy === 'day') return navigate(`/harian?date=${b.key}`);
    setRange({ preset: 'custom', from: b.start, to: b.end });
    setGroupBy('day');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const firstCol = { day: 'Tanggal', '5day': 'Periode 5 hari', week: 'Minggu (Sen–Min)', month: 'Bulan' }[groupBy];
  const t = s?.totals;

  return (
    <div>
      <PageHeader title="Rekap Periode" subtitle="Rekap pemasukan & pengeluaran per hari, 5 hari, minggu, atau bulan.">
        <Link to={`/export?from=${range.from}&to=${range.to}`}>
          <Button variant="secondary" size="sm" icon={FileSpreadsheet}>Export periode ini</Button>
        </Link>
      </PageHeader>

      <Card className="mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <Segmented options={GROUP_OPTIONS} value={groupBy} onChange={setGroupBy} className="w-full md:w-auto [&>button]:flex-1" />
        <DateRangePicker value={range} onChange={setRange} presets={PRESETS} />
      </Card>

      {q.isError ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /></Card>
      ) : (
        <>
          {/* Ringkasan total periode */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Total pemasukan', t && rupiah(t.income), 'text-[#1f5fae]'],
              ['Total pengeluaran', t && rupiah(t.expense), 'text-[#c2501f]'],
              ['Saldo bersih', t && rupiah(t.net), t?.net < 0 ? 'text-red-600' : 'text-stone-900'],
              ['Cup · transaksi', t && `${num(t.cups)} · ${num(t.transactions)}`, 'text-stone-900'],
            ].map(([label, value, tone]) => (
              <Card key={label} className="p-4">
                <div className="text-sm text-stone-500">{label}</div>
                {value ? <div className={cx('tabular mt-1 text-xl font-extrabold', tone)}>{value}</div> : <Skeleton className="mt-1 h-7 w-28" />}
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="text-sm text-stone-500">{fmtRange(range.from, range.to)} · klik baris untuk melihat rinciannya</div>
            </div>
            <div className={cx('overflow-x-auto', q.isFetching && 'opacity-60')}>
              {!s ? (
                <div className="space-y-2 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9" />)}</div>
              ) : !s.buckets.length ? (
                <EmptyState title="Tidak ada data" />
              ) : (
                <table className="w-full min-w-[720px]">
                  <thead className="border-y border-stone-100 bg-stone-50">
                    <tr>
                      <th className="th">{firstCol}</th>
                      <th className="th text-right">Transaksi</th>
                      <th className="th text-right">Cup</th>
                      <th className="th text-right">Penjualan</th>
                      <th className="th text-right">Pemasukan lain</th>
                      <th className="th text-right">Pengeluaran</th>
                      <th className="th text-right">Saldo</th>
                      <th className="th w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {s.buckets.map((b) => (
                      <tr key={b.key} className="cursor-pointer hover:bg-brand-50/50" onClick={() => drill(b)}>
                        <td className="td font-semibold">{b.label}{b.days > 1 && <span className="ml-1.5 text-xs font-normal text-stone-400">{b.days} hari</span>}</td>
                        <td className="td tabular text-right">{num(b.transactions)}</td>
                        <td className="td tabular text-right">{num(b.cups)}</td>
                        <td className="td tabular text-right">{rupiah(b.sales)}</td>
                        <td className="td tabular text-right text-stone-500">{b.otherIncome ? rupiah(b.otherIncome) : '—'}</td>
                        <td className="td tabular text-right">{b.expense ? rupiah(b.expense) : '—'}</td>
                        <td className={cx('td tabular text-right font-bold', b.net < 0 && 'text-red-600')}>{rupiah(b.net)}</td>
                        <td className="td text-stone-300"><ChevronRight className="size-4" /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-stone-200 bg-brand-50/60 font-bold">
                    <tr>
                      <td className="td">TOTAL</td>
                      <td className="td tabular text-right">{num(t.transactions)}</td>
                      <td className="td tabular text-right">{num(t.cups)}</td>
                      <td className="td tabular text-right">{rupiah(t.sales)}</td>
                      <td className="td tabular text-right">{rupiah(t.otherIncome)}</td>
                      <td className="td tabular text-right">{rupiah(t.expense)}</td>
                      <td className={cx('td tabular text-right', t.net < 0 && 'text-red-600')}>{rupiah(t.net)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </Card>

          {s && s.products.length > 0 && (
            <Card className="mt-5 overflow-hidden">
              <div className="px-5 py-3 font-bold">Penjualan per menu · {fmtRange(range.from, range.to)}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="border-y border-stone-100 bg-stone-50">
                    <tr>
                      <th className="th">Menu</th><th className="th text-right">Qty</th><th className="th text-right">Total HPP</th>
                      <th className="th text-right">Pendapatan kotor</th><th className="th text-right">Laba kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {s.products.map((p) => (
                      <tr key={p.productId}>
                        <td className="td font-medium">{p.name}</td>
                        <td className="td tabular text-right">{num(p.qty)}</td>
                        <td className="td tabular text-right text-stone-500">{rupiah(p.hpp)}</td>
                        <td className="td tabular text-right">{rupiah(p.sales)}</td>
                        <td className="td tabular text-right font-semibold">{rupiah(p.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
