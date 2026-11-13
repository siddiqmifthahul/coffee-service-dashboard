import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { newClientId } from '../lib/outbox';
import { num, parseNumber, rupiah } from '../lib/format';
import { fmtDateLong, fmtTime, todayKey } from '../lib/dates';
import { useCashCategories, useCashEntries } from '../lib/queries';
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

const FALLBACK_CATS = {
  PENGELUARAN: ['Bahan Baku', 'Gaji Barista', 'Token Listrik', 'PDAM', 'Sewa Toko', 'Perlengkapan', 'Lainnya'],
  PEMASUKAN: ['Modal / Setoran', 'Penjualan Lain', 'Lainnya'],
};

function EntryForm({ initial, onSubmit, submitting, serverErrors = {} }) {
  const cats = useCashCategories().data || FALLBACK_CATS;
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const allErrors = { ...serverErrors, ...errors };
  const isExpense = form.type === 'PENGELUARAN';

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.category) err.category = 'Pilih kategori';
    if (parseNumber(form.amount) <= 0) err.amount = 'Nominal wajib diisi dan lebih dari 0';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSubmit({ ...form, amount: parseNumber(form.amount) }, () => setForm((f) => ({ ...initial, type: f.type })));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Segmented
        className="w-full [&>button]:flex-1"
        value={form.type}
        onChange={(type) => setForm((f) => ({ ...f, type, category: '' }))}
        options={[{ value: 'PENGELUARAN', label: 'Pengeluaran' }, { value: 'PEMASUKAN', label: 'Pemasukan lain' }]}
      />
      <Field label="Kategori" error={allErrors.category}>
        <div className="flex flex-wrap gap-2">
          {cats[form.type].map((c) => (
            <button key={c} type="button" className={cx('chip', form.category === c && 'chip-active')} onClick={() => setForm((f) => ({ ...f, category: c }))}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Nominal" error={allErrors.amount} htmlFor="amount">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-stone-500">Rp</span>
          <input
            id="amount"
            inputMode="numeric"
            className={cx('input tabular pl-11 text-lg font-bold', allErrors.amount && 'input-error')}
            placeholder="0"
            value={form.amount ? num(parseNumber(form.amount)) : ''}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </div>
      </Field>
      <Field label="Keterangan (opsional)" error={allErrors.description} htmlFor="desc">
        <input id="desc" className="input" maxLength={200} placeholder={isExpense ? 'mis. Beli susu 2 liter' : 'mis. Setoran modal pagi'} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </Field>
      <Button type="submit" size="lg" variant={isExpense ? 'primary' : 'success'} className="w-full" loading={submitting}>
        {submitting ? 'Menyimpan…' : `Simpan ${isExpense ? 'Pengeluaran' : 'Pemasukan'}`}
      </Button>
    </form>
  );
}

export default function CashPage() {
  const { user, isOwner } = useAuth();
  const { save } = useSync();
  const qc = useQueryClient();
  const today = todayKey();
  const entriesQ = useCashEntries({ from: today, to: today });
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const onCreate = async (values, reset) => {
    setSaving(true);
    const result = await save('cash', {
      clientId: newClientId(),
      type: values.type,
      category: values.category,
      amount: values.amount,
      description: values.description?.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    setSaving(false);
    if (result.status === 'rejected') return toast.error(errorMessage(result.error));
    if (result.status === 'saved') toast.success(result.data.entry.type === 'PEMASUKAN' ? 'Pemasukan tersimpan.' : 'Pengeluaran tersimpan.');
    else toast.warning('Koneksi terputus. Entri disimpan di perangkat dan akan dikirim otomatis.');
    reset();
    setFormKey((k) => k + 1);
  };

  const editMut = useMutation({
    mutationFn: (values) => api.put(`/cash-entries/${editing.id}`, {
      type: values.type, category: values.category, amount: values.amount, description: values.description || null,
    }),
    onSuccess: () => { toast.success('Entri diperbarui.'); qc.invalidateQueries(); setEditing(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const delMut = useMutation({
    mutationFn: () => api.delete(`/cash-entries/${deleting.id}`),
    onSuccess: () => { toast.success('Entri dihapus.'); qc.invalidateQueries(); setDeleting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const entries = entriesQ.data || [];
  const income = entries.filter((e) => e.type === 'PEMASUKAN').reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.type === 'PENGELUARAN').reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader title="Pemasukan & Pengeluaran" subtitle={`${fmtDateLong(today)} · Penjualan menu dicatat otomatis dari halaman Penjualan.`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[400px_1fr]">
        <Card className="p-5">
          <EntryForm key={formKey} initial={{ type: 'PENGELUARAN', category: '', amount: '', description: '' }} onSubmit={onCreate} submitting={saving} />
        </Card>

        <Card>
          <CardHeader title="Catatan kas hari ini" />
          <div className="mt-3 grid grid-cols-2 gap-3 px-5">
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><ArrowDownCircle className="size-4" /> Pemasukan lain</div>
              <div className="tabular text-lg font-extrabold text-stone-900">{rupiah(income)}</div>
            </div>
            <div className="rounded-xl bg-orange-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700"><ArrowUpCircle className="size-4" /> Pengeluaran</div>
              <div className="tabular text-lg font-extrabold text-stone-900">{rupiah(expense)}</div>
            </div>
          </div>
          <div className="mt-2 pb-2">
            {entriesQ.isLoading ? (
              <div className="space-y-2 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : entriesQ.isError ? (
              <ErrorState message={errorMessage(entriesQ.error)} onRetry={entriesQ.refetch} />
            ) : !entries.length ? (
              <EmptyState icon={Wallet} title="Belum ada catatan kas hari ini" description="Catat pembelian bahan, bayar listrik, atau setoran modal di form sebelah." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {entries.map((e) => {
                  const canEdit = isOwner || (e.createdById === user.id);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={cx('grid size-9 shrink-0 place-items-center rounded-xl', e.type === 'PEMASUKAN' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700')}>
                        {e.type === 'PEMASUKAN' ? <ArrowDownCircle className="size-5" /> : <ArrowUpCircle className="size-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{e.category}</span>
                          <Badge>{fmtTime(e.occurredAt)}</Badge>
                        </div>
                        <div className="truncate text-sm text-stone-500">{e.description || '—'} · {e.createdBy}</div>
                      </div>
                      <div className={cx('tabular font-bold', e.type === 'PEMASUKAN' ? 'text-emerald-700' : 'text-stone-900')}>
                        {e.type === 'PEMASUKAN' ? '+' : '−'}{rupiah(e.amount)}
                      </div>
                      {canEdit && (
                        <div className="flex">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(e)} aria-label="Ubah"><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(e)} aria-label="Hapus"><Trash2 className="size-4" /></Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Ubah catatan kas">
        {editing && (
          <EntryForm
            initial={{ type: editing.type, category: editing.category, amount: String(editing.amount), description: editing.description || '' }}
            onSubmit={(v) => editMut.mutate(v)}
            submitting={editMut.isPending}
            serverErrors={fieldErrors(editMut.error)}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => delMut.mutate()}
        loading={delMut.isPending}
        title="Hapus catatan kas?"
        message={deleting ? `${deleting.category} ${rupiah(deleting.amount)} akan dihapus dari rekap.` : ''}
        confirmLabel="Hapus"
      />
    </div>
  );
}
