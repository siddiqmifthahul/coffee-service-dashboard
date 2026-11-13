import { useSearchParams } from 'react-router';
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Coffee, Printer, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { PAYMENT_LABEL, num, rupiah } from '../lib/format';
import { addDays, fmtDateLong, fmtTime, todayKey } from '../lib/dates';
import { useDaily } from '../lib/queries';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, cx,
} from '../components/ui';

function Row({ label, value, strong, tone, sub }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-1.5', sub && 'pl-4 text-sm text-stone-500')}>
      <span className={cx(strong ? 'font-bold text-stone-900' : !sub && 'text-stone-600')}>{label}</span>
      <span className={cx('tabular', strong ? 'text-lg font-extrabold' : 'font-semibold', tone)}>{value}</span>
    </div>
  );
}

export default function DailyPage() {
  const { isOwner } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const date = params.get('date') && params.get('date') <= today ? params.get('date') : today;
  const q = useDaily(date);
  const d = q.data;
  const t = d?.totals;

  const go = (key) => setParams(key === today ? {} : { date: key });
  const expenses = d?.cashEntries.filter((e) => e.type === 'PENGELUARAN') || [];
  const incomes = d?.cashEntries.filter((e) => e.type === 'PEMASUKAN') || [];

  return (
    <div>
      <PageHeader title={date === today ? 'Rekap Hari Ini' : 'Rekap Harian'} subtitle={fmtDateLong(date)}>
        <div className="flex items-center gap-1 print:hidden">
          <Button variant="secondary" size="icon" onClick={() => go(addDays(date, -1))} aria-label="Hari sebelumnya"><ChevronLeft className="size-5" /></Button>
          <input type="date" className="input h-10 w-auto py-1.5" max={today} value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Pilih tanggal" />
          <Button variant="secondary" size="icon" onClick={() => go(addDays(date, 1))} disabled={date >= today} aria-label="Hari berikutnya"><ChevronRight className="size-5" /></Button>
          {date !== today && <Button variant="ghost" size="sm" onClick={() => go(today)}>Hari ini</Button>}
          <Button variant="secondary" size="icon" onClick={() => window.print()} aria-label="Cetak" title="Cetak / simpan PDF"><Printer className="size-4" /></Button>
        </div>
      </PageHeader>

      {q.isError ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Ringkasan pemasukan & pengeluaran */}
          <Card className="h-fit p-5">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><Scale className="size-5 text-brand-700" /> Ringkasan kas</h2>
            {!t ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-6" />)}</div>
            ) : (
              <div className={cx('divide-y divide-stone-100', q.isFetching && 'opacity-60')}>
                <div className="pb-2">
                  <Row label="Penjualan menu" value={rupiah(t.sales)} />
                  <Row label="Pemasukan lain" value={rupiah(t.otherIncome)} />
                  <Row label="Total pemasukan" value={rupiah(t.income)} strong tone="text-emerald-700" />
                </div>
                <div className="py-2">
                  {expenses.length ? expenses.map((e) => <Row key={e.id} sub label={e.category} value={`−${rupiah(e.amount)}`} />) : <Row sub label="Tidak ada pengeluaran" value="—" />}
                  <Row label="Total pengeluaran" value={`−${rupiah(t.expense)}`} strong tone="text-orange-700" />
                </div>
                <div className="pt-2">
                  <Row label="Saldo bersih hari ini" value={rupiah(t.net)} strong tone={t.net < 0 ? 'text-red-600' : 'text-stone-900'} />
                  <p className="text-xs text-stone-500">Total pemasukan − total pengeluaran.</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 pt-3 text-center">
                  <div><div className="text-xs text-stone-500">Transaksi</div><div className="tabular font-bold">{num(t.transactions)}</div></div>
                  <div><div className="text-xs text-stone-500">Cup</div><div className="tabular font-bold">{num(t.cups)}</div></div>
                  <div><div className="text-xs text-stone-500">Rata-rata</div><div className="tabular font-bold">{rupiah(t.avgTicket)}</div></div>
                </div>
                {isOwner && (
                  <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
                    <div className="tabular flex justify-between"><span className="text-stone-600">HPP (estimasi)</span><span className="font-semibold">{rupiah(t.hpp)}</span></div>
                    <div className="tabular flex justify-between"><span className="text-stone-600">Laba kotor (penjualan − HPP)</span><span className="font-bold text-stone-900">{rupiah(t.grossProfit)}</span></div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 pt-3">
                  {Object.entries(d.payments).filter(([, v]) => v.count).map(([k, v]) => (
                    <Badge key={k} tone="stone">{PAYMENT_LABEL[k]}: {rupiah(v.amount)} ({v.count})</Badge>
                  ))}
                  {d.voidedCount > 0 && <Badge tone="red">{d.voidedCount} transaksi dibatalkan</Badge>}
                </div>
              </div>
            )}
          </Card>

          <div className="min-w-0 space-y-5">
            {/* Penjualan per menu - format seperti Excel UMKM */}
            <Card>
              <CardHeader title="Penjualan per menu" subtitle="Format sama seperti rekap Excel: qty, HPP, harga jual, pendapatan kotor." />
              <div className="mt-3 overflow-x-auto">
                {!d ? (
                  <div className="space-y-2 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : !d.products.length ? (
                  <EmptyState icon={Coffee} title="Belum ada penjualan" description={date === today ? 'Penjualan dari halaman Penjualan akan masuk otomatis.' : 'Tidak ada transaksi di tanggal ini.'} />
                ) : (
                  <table className="w-full min-w-[560px]">
                    <thead className="border-y border-stone-100 bg-stone-50">
                      <tr>
                        <th className="th">Menu</th>
                        <th className="th text-right">Qty</th>
                        {isOwner && <th className="th text-right">HPP</th>}
                        {isOwner && <th className="th text-right">Total HPP</th>}
                        <th className="th text-right">Harga Jual</th>
                        <th className="th text-right">Pendapatan Kotor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {d.products.map((p) => (
                        <tr key={p.productId}>
                          <td className="td font-medium">{p.name}</td>
                          <td className="td tabular text-right">{num(p.qty)}</td>
                          {isOwner && <td className="td tabular text-right text-stone-500">{rupiah(p.unitHpp)}</td>}
                          {isOwner && <td className="td tabular text-right text-stone-500">{rupiah(p.hpp)}</td>}
                          <td className="td tabular text-right">{rupiah(p.price)}</td>
                          <td className="td tabular text-right font-semibold">{rupiah(p.sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-stone-200 bg-brand-50/60 font-bold">
                      <tr>
                        <td className="td">TOTAL</td>
                        <td className="td tabular text-right">{num(t.cups)}</td>
                        {isOwner && <td className="td" />}
                        {isOwner && <td className="td tabular text-right">{rupiah(t.hpp)}</td>}
                        <td className="td" />
                        <td className="td tabular text-right">{rupiah(t.sales)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </Card>

            {/* Catatan kas */}
            <Card>
              <CardHeader title="Pemasukan & pengeluaran lain" />
              <div className="mt-2 pb-2">
                {!d ? <div className="p-5"><Skeleton className="h-10" /></div> : !d.cashEntries.length ? (
                  <EmptyState title="Tidak ada catatan kas" description="Catat pengeluaran (bahan, listrik, gaji) di halaman Kas." />
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {[...incomes, ...expenses].map((e) => (
                      <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                        {e.type === 'PEMASUKAN' ? <ArrowDownCircle className="size-5 text-emerald-600" /> : <ArrowUpCircle className="size-5 text-orange-600" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{e.category} <span className="text-sm font-normal text-stone-400">{fmtTime(e.occurredAt)}</span></div>
                          <div className="truncate text-sm text-stone-500">{e.description || '—'} · {e.createdBy}</div>
                        </div>
                        <div className={cx('tabular font-bold', e.type === 'PEMASUKAN' ? 'text-emerald-700' : 'text-stone-900')}>
                          {e.type === 'PEMASUKAN' ? '+' : '−'}{rupiah(e.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
