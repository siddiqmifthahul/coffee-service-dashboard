import { useEffect, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Receipt, Search } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { PAYMENT_LABEL, num, rupiah } from '../lib/format';
import { fmtDate, fmtTime, presetRange, toKey } from '../lib/dates';
import { useTransactions } from '../lib/queries';
import DateRangePicker from '../components/DateRangePicker';
import VoidDialog from '../components/VoidDialog';
import {
  Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

export default function TransactionsPage() {
  const [range, setRange] = useState({ preset: 'today', ...presetRange('today') });
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [voiding, setVoiding] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useTransactions({ from: range.from, to: range.to, q, status, page, pageSize: 20 });
  const data = query.data;

  return (
    <div>
      <PageHeader title="Riwayat Transaksi" subtitle="Semua transaksi kasir. Transaksi yang dibatalkan tetap tercatat untuk audit." />
      <Card className="mb-4 space-y-3 p-4">
        <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} presets={[{ id: 'today', label: 'Hari ini' }, { id: 'yesterday', label: 'Kemarin' }, { id: '7d', label: '7 Hari' }, { id: 'month', label: 'Bulan ini' }]} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="input pl-9" placeholder="Cari kode, menu, atau catatan…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'ALL', label: 'Semua' }, { value: 'ACTIVE', label: 'Selesai' }, { value: 'VOID', label: 'Dibatalkan' }]} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={query.refetch} />
        ) : !data ? (
          <div className="space-y-2 p-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !data.transactions.length ? (
          <EmptyState icon={Receipt} title="Tidak ada transaksi" description="Coba ubah rentang tanggal atau kata kunci." />
        ) : (
          <>
            <div className={cx('overflow-x-auto', query.isFetching && 'opacity-60')}>
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-stone-100 bg-stone-50">
                  <tr>
                    <th className="th">Waktu</th><th className="th">Kode</th><th className="th">Pesanan</th>
                    <th className="th">Bayar</th><th className="th">Kasir</th><th className="th text-right">Total</th><th className="th w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.transactions.map((t) => (
                    <tr key={t.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setDetail(t)}>
                      <td className="td tabular whitespace-nowrap">{fmtDate(toKey(t.occurredAt), { year: false })} · {fmtTime(t.occurredAt)}</td>
                      <td className="td font-mono text-xs">{t.code}</td>
                      <td className="td max-w-[280px] truncate">{t.items.map((i) => `${i.qty}× ${i.productName}`).join(', ')}</td>
                      <td className="td"><Badge tone={t.paymentMethod === 'TUNAI' ? 'stone' : 'blue'}>{PAYMENT_LABEL[t.paymentMethod]}</Badge></td>
                      <td className="td">{t.cashier?.name}</td>
                      <td className={cx('td tabular text-right font-bold', t.status === 'VOID' && 'text-stone-400 line-through')}>{rupiah(t.total)}</td>
                      <td className="td">
                        {t.status === 'VOID' ? <Badge tone="red">Batal</Badge> : (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setVoiding(t); }} aria-label="Batalkan"><Ban className="size-4" /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3 text-sm">
              <span className="text-stone-500">{num(data.pagination.total)} transaksi</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Sebelumnya"><ChevronLeft className="size-4" /></Button>
                <span className="tabular">{page} / {Math.max(data.pagination.totalPages, 1)}</span>
                <Button variant="secondary" size="icon" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Berikutnya"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.code || ''} size="sm">
        {detail && (
          <div className="space-y-3 text-[15px]">
            <div className="text-sm text-stone-500">{fmtDate(toKey(detail.occurredAt), { weekday: true })} · {fmtTime(detail.occurredAt)} · {PAYMENT_LABEL[detail.paymentMethod]} · {detail.cashier?.name}</div>
            <ul className="divide-y divide-stone-100">
              {detail.items.map((i) => (
                <li key={i.productId} className="tabular flex justify-between py-2"><span>{i.qty}× {i.productName} <span className="text-stone-400">@{rupiah(i.price)}</span></span><span>{rupiah(i.subtotal)}</span></li>
              ))}
            </ul>
            <div className="tabular flex justify-between border-t border-stone-200 pt-2 font-bold"><span>Total</span><span>{rupiah(detail.total)}</span></div>
            {detail.note && <p className="text-sm text-stone-600">Catatan: {detail.note}</p>}
            {detail.status === 'VOID' && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Dibatalkan: {detail.voidReason}</p>}
          </div>
        )}
      </Modal>
      <VoidDialog trx={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}
