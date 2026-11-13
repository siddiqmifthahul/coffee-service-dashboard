import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Info } from 'lucide-react';
import { api, blobErrorMessage, downloadFile, errorMessage } from '../lib/api';
import { num, rupiah } from '../lib/format';
import { daysBetween, fmtRange, presetRange } from '../lib/dates';
import DateRangePicker from '../components/DateRangePicker';
import {
  Badge, Button, Card, ErrorState, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

const DATASETS = [
  { id: 'harian', label: 'Rekap harian', desc: 'Satu baris per hari: penjualan, pemasukan, pengeluaran, saldo.' },
  { id: 'periode', label: 'Rekap 5 hari, mingguan & bulanan', desc: 'Total per 5 hari (1–5, 6–10, …), per minggu, dan per bulan.' },
  { id: 'produk', label: 'Penjualan per menu', desc: 'Qty, HPP, harga jual, pendapatan & laba kotor per menu.' },
  { id: 'transaksi', label: 'Detail transaksi', desc: 'Setiap item yang terjual, lengkap dengan jam, kasir & metode bayar.' },
  { id: 'kas', label: 'Pemasukan & pengeluaran', desc: 'Semua catatan kas di luar penjualan menu.' },
];

const PRESETS = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 Hari' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'lastMonth', label: 'Bulan lalu' },
];

export default function ExportPage() {
  const [params] = useSearchParams();
  const [range, setRange] = useState(() => {
    const from = params.get('from');
    const to = params.get('to');
    return from && to ? { preset: 'custom', from, to } : { preset: 'month', ...presetRange('month') };
  });
  const [format, setFormat] = useState('xlsx');
  const [selected, setSelected] = useState(DATASETS.map((d) => d.id));
  const [csvDataset, setCsvDataset] = useState('harian');
  const [csvGroup, setCsvGroup] = useState('5day');
  const [downloading, setDownloading] = useState(false);
  const [lastFile, setLastFile] = useState('');

  const preview = useQuery({
    queryKey: ['export-preview', range.from, range.to],
    queryFn: () => api.get('/exports/preview', { params: { from: range.from, to: range.to } }).then((r) => r.data.data),
  });

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const include = format === 'xlsx' ? selected : [csvDataset];

  const download = async () => {
    if (!include.length) return toast.error('Pilih minimal satu isi data.');
    setDownloading(true);
    try {
      const name = await downloadFile('/exports', {
        from: range.from, to: range.to, format, include: include.join(','), groupBy: csvGroup,
      }, `coffee-service.${format}`);
      setLastFile(name);
      toast.success(`File ${name} berhasil diunduh.`);
    } catch (err) {
      toast.error(await blobErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const p = preview.data;

  return (
    <div>
      <PageHeader title="Export Data" subtitle="Unduh data penjualan & keuangan untuk dibuka di Google Sheets atau Excel." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="mb-1 font-bold">1. Pilih rentang tanggal</h2>
            <p className="mb-3 text-sm text-stone-500">Bebas pilih tanggal awal dan akhir.</p>
            <DateRangePicker value={range} onChange={setRange} presets={PRESETS} />
            <p className="mt-3 text-sm font-medium text-stone-700">{fmtRange(range.from, range.to)} · {daysBetween(range.from, range.to)} hari</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-bold">2. Pilih format</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { id: 'xlsx', icon: FileSpreadsheet, title: 'Excel (.xlsx)', desc: 'Satu file, banyak sheet. Disarankan untuk Google Sheets.' },
                { id: 'csv', icon: FileText, title: 'CSV (.csv)', desc: 'Satu tabel per file. Ringan & universal.' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={cx('flex gap-3 rounded-2xl border p-4 text-left transition', format === f.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-stone-200 hover:border-brand-300')}
                >
                  <f.icon className={cx('size-6 shrink-0', format === f.id ? 'text-brand-700' : 'text-stone-400')} />
                  <div>
                    <div className="font-semibold">{f.title}</div>
                    <div className="text-sm text-stone-500">{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-bold">3. Pilih isi data</h2>
            <p className="mb-3 text-sm text-stone-500">{format === 'xlsx' ? 'Setiap pilihan menjadi sheet terpisah. Sheet "Ringkasan" selalu disertakan.' : 'CSV hanya berisi satu tabel. Pilih salah satu.'}</p>
            <div className="space-y-2">
              {DATASETS.map((d) => {
                const active = format === 'xlsx' ? selected.includes(d.id) : csvDataset === d.id;
                return (
                  <label key={d.id} className={cx('flex cursor-pointer gap-3 rounded-xl border p-3 transition', active ? 'border-brand-500 bg-brand-50/60' : 'border-stone-200 hover:bg-stone-50')}>
                    <input
                      type={format === 'xlsx' ? 'checkbox' : 'radio'}
                      name="dataset"
                      className="mt-1 size-4 accent-[#6f4e37]"
                      checked={active}
                      onChange={() => (format === 'xlsx' ? toggle(d.id) : setCsvDataset(d.id))}
                    />
                    <div>
                      <div className="font-semibold text-stone-900">{d.label}</div>
                      <div className="text-sm text-stone-500">{d.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            {format === 'csv' && csvDataset === 'periode' && (
              <div className="mt-3">
                <div className="label">Kelompokkan per</div>
                <Segmented value={csvGroup} onChange={setCsvGroup} options={[{ value: '5day', label: '5 Hari' }, { value: 'week', label: 'Minggu' }, { value: 'month', label: 'Bulan' }]} />
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card className="p-5 lg:sticky lg:top-20">
            <h2 className="mb-3 font-bold">Ringkasan data</h2>
            {preview.isError ? (
              <ErrorState message={errorMessage(preview.error)} onRetry={preview.refetch} />
            ) : !p ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}</div>
            ) : (
              <dl className={cx('space-y-1.5 text-sm', preview.isFetching && 'opacity-60')}>
                {[
                  ['Transaksi', num(p.counts.transaksi)],
                  ['Baris detail item', num(p.counts.barisTransaksi)],
                  ['Catatan kas', num(p.counts.kas)],
                  ['Menu terjual', num(p.counts.menu)],
                  ['Total pemasukan', rupiah(p.totals.income)],
                  ['Total pengeluaran', rupiah(p.totals.expense)],
                  ['Saldo bersih', rupiah(p.totals.net)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><dt className="text-stone-500">{k}</dt><dd className="tabular font-semibold">{v}</dd></div>
                ))}
                {p.counts.dibatalkan > 0 && <Badge tone="red" className="mt-1">{p.counts.dibatalkan} transaksi batal (tidak dihitung)</Badge>}
              </dl>
            )}
            <Button size="lg" className="mt-5 w-full" icon={Download} loading={downloading} onClick={download} disabled={!include.length}>
              {downloading ? 'Menyiapkan file…' : `Download ${format.toUpperCase()}`}
            </Button>
            {lastFile && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="size-4" /> {lastFile}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><Info className="size-4 text-brand-600" /> Buka di Google Sheets</h2>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-600">
              <li>Buka <b>sheets.google.com</b> → klik <b>Kosong</b> (spreadsheet baru).</li>
              <li>Menu <b>File → Impor → Upload</b>, lalu pilih file yang barusan diunduh.</li>
              <li>Pilih <b>Ganti spreadsheet</b> (untuk .xlsx semua sheet ikut terbawa) → <b>Impor data</b>.</li>
            </ol>
            <p className="mt-2 text-xs text-stone-500">Atau unggah file .xlsx ke Google Drive lalu klik dua kali → “Buka dengan Google Spreadsheet”.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
