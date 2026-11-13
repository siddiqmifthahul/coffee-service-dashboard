import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coffee, Pencil, Plus } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { CATEGORY_LABEL, num, parseNumber, rupiah } from '../lib/format';
import { useProducts } from '../lib/queries';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

const EMPTY = { name: '', category: 'KOPI', price: '', hpp: '', isActive: true, sortOrder: 0 };

function ProductForm({ initial, onSubmit, submitting, serverErrors }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const all = { ...serverErrors, ...errors };
  const price = parseNumber(form.price);
  const hpp = parseNumber(form.hpp);
  const margin = price > 0 ? Math.round(((price - hpp) / price) * 100) : 0;

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (form.name.trim().length < 2) err.name = 'Nama menu minimal 2 karakter';
    if (price <= 0) err.price = 'Harga jual wajib diisi';
    if (hpp > price) err.hpp = 'HPP lebih besar dari harga jual — periksa lagi';
    setErrors(err);
    if (err.name || err.price) return;
    onSubmit({ ...form, name: form.name.trim(), price, hpp });
  };

  return (
    <form id="product-form" onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nama menu" error={all.name}>
        <input className={cx('input', all.name && 'input-error')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="mis. Ice Aren Latte" />
      </Field>
      <Field label="Kategori">
        <Segmented className="w-full [&>button]:flex-1" value={form.category} onChange={(category) => setForm((f) => ({ ...f, category }))} options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga jual (Rp)" error={all.price}>
          <input inputMode="numeric" className={cx('input tabular', all.price && 'input-error')} value={form.price === '' ? '' : num(price)} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="18.000" />
        </Field>
        <Field label="HPP per cup (Rp)" error={all.hpp} hint="Biaya bahan per cup">
          <input inputMode="numeric" className={cx('input tabular', all.hpp && 'input-error')} value={form.hpp === '' ? '' : num(hpp)} onChange={(e) => setForm((f) => ({ ...f, hpp: e.target.value }))} placeholder="7.000" />
        </Field>
      </div>
      {price > 0 && <p className="text-sm text-stone-600">Laba kotor per cup: <b className="tabular">{rupiah(price - hpp)}</b> ({margin}%)</p>}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-[#6f4e37]" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
        Tampilkan di halaman kasir (aktif)
      </label>
      <Button type="submit" className="w-full" loading={submitting}>Simpan menu</Button>
    </form>
  );
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const q = useProducts(true);
  const [editing, setEditing] = useState(null); // null | 'new' | product

  const mut = useMutation({
    mutationFn: (values) => (editing === 'new' ? api.post('/products', values) : api.put(`/products/${editing.id}`, values)),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['products'] });
      setEditing(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMut = useMutation({
    mutationFn: (p) => api.put(`/products/${p.id}`, { name: p.name, category: p.category, price: p.price, hpp: p.hpp, isActive: !p.isActive, sortOrder: p.sortOrder }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const products = q.data || [];

  return (
    <div>
      <PageHeader title="Menu & Harga" subtitle="Harga & HPP dipakai untuk menghitung pendapatan dan laba kotor. Perubahan harga tidak mengubah transaksi lama.">
        <Button icon={Plus} onClick={() => { mut.reset(); setEditing('new'); }}>Tambah menu</Button>
      </PageHeader>

      <Card className="overflow-hidden">
        {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /> : q.isLoading ? (
          <div className="space-y-2 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !products.length ? (
          <EmptyState icon={Coffee} title="Belum ada menu" action={<Button icon={Plus} onClick={() => setEditing('new')}>Tambah menu</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-stone-100 bg-stone-50">
                <tr>
                  <th className="th">Menu</th><th className="th">Kategori</th><th className="th text-right">Harga jual</th>
                  <th className="th text-right">HPP</th><th className="th text-right">Laba / cup</th><th className="th">Status</th><th className="th w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => (
                  <tr key={p.id} className={cx(!p.isActive && 'bg-stone-50/70 text-stone-400')}>
                    <td className="td font-semibold">{p.name}</td>
                    <td className="td"><Badge tone="brand">{CATEGORY_LABEL[p.category]}</Badge></td>
                    <td className="td tabular text-right">{rupiah(p.price)}</td>
                    <td className="td tabular text-right text-stone-500">{rupiah(p.hpp)}</td>
                    <td className="td tabular text-right font-semibold">{rupiah(p.price - p.hpp)}</td>
                    <td className="td">
                      <button type="button" onClick={() => toggleMut.mutate(p)} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-600')}>
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="td"><Button variant="ghost" size="icon" onClick={() => { mut.reset(); setEditing(p); }} aria-label={`Ubah ${p.name}`}><Pencil className="size-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Tambah menu' : 'Ubah menu'}>
        {editing && (
          <ProductForm
            initial={editing === 'new' ? EMPTY : { ...editing, price: String(editing.price), hpp: String(editing.hpp) }}
            onSubmit={(v) => mut.mutate(v)}
            submitting={mut.isPending}
            serverErrors={fieldErrors(mut.error)}
          />
        )}
      </Modal>
    </div>
  );
}
