import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Ban, Coffee, Minus, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { newClientId } from '../lib/outbox';
import { CATEGORY_LABEL, PAYMENT_LABEL, num, parseNumber, rupiah } from '../lib/format';
import { fmtTime, todayKey } from '../lib/dates';
import { useDaily, useProducts, useTransactions } from '../lib/queries';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Modal, Segmented, Skeleton, cx,
} from '../components/ui';
import VoidDialog from '../components/VoidDialog';

const DRAFT_KEY = 'cs_cart_draft_v1';
const PRODUCTS_CACHE = 'cs_products_cache_v1';
const EMPTY_DRAFT = { items: {}, paymentMethod: 'TUNAI', note: '' };

function loadDraft() {
  try {
    return { ...EMPTY_DRAFT, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') };
  } catch {
    return EMPTY_DRAFT;
  }
}

function loadCachedProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_CACHE) || 'null'); } catch { return null; }
}

/** Panel keranjang (dipakai di sidebar desktop & sheet ponsel) */
function CartPanel({ draft, setDraft, products, onSave }) {
  const [paid, setPaid] = useState('');
  const lines = Object.entries(draft.items)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
    .filter((l) => l.product);
  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const cups = lines.reduce((s, l) => s + l.qty, 0);
  const paidNum = parseNumber(paid);
  const change = paidNum - total;

  const setQty = (id, qty) => setDraft((d) => {
    const items = { ...d.items };
    if (qty <= 0) delete items[id];
    else items[id] = Math.min(qty, 500);
    return { ...d, items };
  });

  return (
    <div className="flex h-full flex-col">
      {lines.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Keranjang kosong" description="Ketuk menu di sebelah untuk menambahkan pesanan." />
      ) : (
        <ul className="divide-y divide-stone-100">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-stone-900">{product.name}</div>
                <div className="tabular text-sm text-stone-500">{rupiah(product.price)} × {qty} = <span className="font-semibold text-stone-700">{rupiah(product.price * qty)}</span></div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="grid size-9 place-items-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50" onClick={() => setQty(product.id, qty - 1)} aria-label={`Kurangi ${product.name}`}>
                  {qty === 1 ? <Trash2 className="size-4 text-red-600" /> : <Minus className="size-4" />}
                </button>
                <input
                  className="tabular h-9 w-11 rounded-lg border border-stone-300 text-center font-semibold outline-none focus:border-brand-500"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(product.id, parseNumber(e.target.value))}
                  aria-label={`Jumlah ${product.name}`}
                />
                <button type="button" className="grid size-9 place-items-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50" onClick={() => setQty(product.id, qty + 1)} aria-label={`Tambah ${product.name}`}>
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto space-y-3 border-t border-stone-100 pt-3">
        <div>
          <div className="label">Metode bayar</div>
          <Segmented
            className="w-full [&>button]:flex-1"
            value={draft.paymentMethod}
            onChange={(v) => setDraft((d) => ({ ...d, paymentMethod: v }))}
            options={Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>

        {draft.paymentMethod === 'TUNAI' && total > 0 && (
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="flex items-center gap-2">
              <input
                className="input h-10 py-1.5"
                inputMode="numeric"
                placeholder="Uang diterima (opsional)"
                value={paid ? num(paidNum) : ''}
                onChange={(e) => setPaid(e.target.value)}
                aria-label="Uang diterima"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[['Uang pas', total], ['20rb', 20000], ['50rb', 50000], ['100rb', 100000]].filter(([, v]) => v >= total).map(([label, v]) => (
                <button key={label} type="button" className="chip px-2.5 py-1 text-xs" onClick={() => setPaid(String(v))}>{label}</button>
              ))}
            </div>
            {paidNum > 0 && (
              <div className={cx('tabular mt-2 text-sm font-semibold', change >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {change >= 0 ? `Kembalian: ${rupiah(change)}` : `Kurang: ${rupiah(-change)}`}
              </div>
            )}
          </div>
        )}

        <input
          className="input"
          placeholder="Catatan (opsional), mis. less sugar"
          maxLength={200}
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        />

        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-stone-500">{cups} cup</div>
            <div className="tabular text-2xl font-extrabold text-stone-900">{rupiah(total)}</div>
          </div>
          {lines.length > 0 && (
            <button type="button" className="text-sm font-semibold text-stone-500 hover:text-red-600" onClick={() => setDraft(EMPTY_DRAFT)}>
              Kosongkan
            </button>
          )}
        </div>
        <Button size="lg" className="w-full" disabled={!lines.length} onClick={() => onSave(() => setPaid(''))}>
          Simpan Transaksi
        </Button>
      </div>
    </div>
  );
}

export default function PosPage() {
  const { save } = useSync();
  const { user, isOwner } = useAuth();
  const today = todayKey();
  const cached = useMemo(loadCachedProducts, []);
  const productsQ = useProducts();
  const products = productsQ.data || cached || [];
  const daily = useDaily(today);
  const trxQ = useTransactions({ from: today, to: today, pageSize: 10, page: 1 });

  const [draft, setDraft] = useState(loadDraft);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [cartOpen, setCartOpen] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [detail, setDetail] = useState(null);

  // Autosave draf keranjang
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* abaikan */ }
  }, [draft]);

  useEffect(() => {
    if (productsQ.data) {
      try { localStorage.setItem(PRODUCTS_CACHE, JSON.stringify(productsQ.data)); } catch { /* abaikan */ }
    }
  }, [productsQ.data]);

  const filtered = products.filter((p) =>
    (category === 'ALL' || p.category === category) && p.name.toLowerCase().includes(search.trim().toLowerCase()));

  const add = (p) => setDraft((d) => ({ ...d, items: { ...d.items, [p.id]: Math.min((d.items[p.id] || 0) + 1, 500) } }));
  const cartCount = Object.values(draft.items).reduce((s, q) => s + q, 0);
  const cartTotalOf = (items) => Object.entries(items).reduce((s, [id, q]) => s + (products.find((p) => p.id === Number(id))?.price || 0) * q, 0);
  const cartTotal = cartTotalOf(draft.items);

  const onSave = async (resetPaid) => {
    const items = Object.entries(draft.items)
      .filter(([id, qty]) => qty > 0 && products.some((p) => p.id === Number(id)))
      .map(([id, qty]) => ({ productId: Number(id), qty }));
    if (!items.length) return toast.error('Pilih minimal 1 menu dan jumlahnya.');

    // Optimis: data sudah aman di antrean perangkat -> keranjang langsung dikosongkan
    // agar kasir bisa melayani pelanggan berikutnya tanpa menunggu server.
    const snapshot = draft;
    const pending = save('transaction', {
      clientId: newClientId(),
      items,
      paymentMethod: draft.paymentMethod,
      note: draft.note.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    setDraft((d) => ({ ...EMPTY_DRAFT, paymentMethod: d.paymentMethod }));
    resetPaid?.();
    setCartOpen(false);
    const toastId = toast.loading(`Menyimpan transaksi ${rupiah(cartTotalOf(snapshot.items))}…`);

    const result = await pending;

    if (result.status === 'rejected') {
      setDraft(snapshot); // kembalikan pesanan agar bisa diperbaiki
      toast.error(errorMessage(result.error, 'Transaksi ditolak. Periksa kembali pesanan.'), { id: toastId });
    } else if (result.status === 'saved') {
      toast.success(`Transaksi tersimpan · ${rupiah(result.data.transaction.total)}`, { id: toastId });
    } else {
      toast.warning('Koneksi terputus. Transaksi disimpan di perangkat ini dan akan dikirim otomatis.', { id: toastId, duration: 6000 });
    }
  };

  const t = daily.data?.totals;
  const cats = [{ value: 'ALL', label: 'Semua' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))];

  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      <div className="min-w-0">
        {/* Ringkasan hari ini */}
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ['Penjualan hari ini', t ? rupiah(t.sales) : null],
            ['Cup terjual', t ? num(t.cups) : null],
            ['Transaksi', t ? num(t.transactions) : null],
          ].map(([label, value]) => (
            <Card key={label} className="px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="text-[11px] font-medium text-stone-500 sm:text-xs">{label}</div>
              {value === null ? <Skeleton className="mt-1 h-6 w-16" /> : <div className="tabular truncate text-base font-extrabold text-stone-900 sm:text-xl">{value}</div>}
            </Card>
          ))}
        </div>

        {/* Pencarian & kategori */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="input pl-9" placeholder="Cari menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700" onClick={() => setSearch('')} aria-label="Hapus pencarian"><X className="size-4" /></button>
            )}
          </div>
          <Segmented className="overflow-x-auto" options={cats} value={category} onChange={setCategory} />
        </div>

        {/* Grid menu */}
        {productsQ.isLoading && !cached ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : productsQ.isError && !cached ? (
          <Card><ErrorState message={errorMessage(productsQ.error)} onRetry={productsQ.refetch} /></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Coffee}
              title={products.length ? 'Menu tidak ditemukan' : 'Belum ada menu'}
              description={products.length ? 'Coba kata kunci lain.' : isOwner ? 'Tambahkan menu terlebih dahulu.' : 'Minta pemilik menambahkan menu.'}
              action={!products.length && isOwner ? <Link to="/produk"><Button size="sm">Kelola menu</Button></Link> : null}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const qty = draft.items[p.id] || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  className={cx(
                    'relative flex min-h-24 flex-col justify-between rounded-2xl border bg-white p-3 text-left transition active:scale-[0.97]',
                    qty ? 'border-brand-600 ring-2 ring-brand-200' : 'border-stone-200 hover:border-brand-300',
                  )}
                >
                  <span className="pr-7 text-[15px] font-semibold leading-snug text-stone-900">{p.name}</span>
                  <span className="tabular mt-2 text-sm font-bold text-brand-700">{rupiah(p.price)}</span>
                  {qty > 0 && (
                    <span className="tabular absolute right-2 top-2 grid min-w-7 place-items-center rounded-full bg-brand-700 px-1.5 py-0.5 text-xs font-bold text-white">{qty}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Transaksi terakhir */}
        <Card className="mt-6">
          <CardHeader
            title="Transaksi hari ini"
            subtitle={isOwner ? 'Klik untuk detail. Owner dapat membatalkan transaksi.' : 'Anda dapat membatalkan transaksi milik sendiri hari ini.'}
            action={isOwner ? <Link to="/transaksi" className="text-sm font-semibold text-brand-700">Semua →</Link> : null}
          />
          <div className="mt-2 pb-2">
            {trxQ.isLoading ? (
              <div className="space-y-2 px-5 pb-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : trxQ.isError ? (
              <ErrorState message={errorMessage(trxQ.error)} onRetry={trxQ.refetch} />
            ) : !trxQ.data.transactions.length ? (
              <EmptyState title="Belum ada transaksi hari ini" description="Transaksi yang disimpan akan muncul di sini secara otomatis." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {trxQ.data.transactions.map((trx) => {
                  const canVoid = trx.status === 'ACTIVE' && (isOwner || trx.cashierId === user.id);
                  return (
                    <li key={trx.id} className="flex items-center gap-3 px-5 py-2.5">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(trx)}>
                        <div className="flex items-center gap-2">
                          <span className="tabular text-sm font-semibold text-stone-500">{fmtTime(trx.occurredAt)}</span>
                          <span className={cx('tabular font-bold', trx.status === 'VOID' ? 'text-stone-400 line-through' : 'text-stone-900')}>{rupiah(trx.total)}</span>
                          <Badge tone={trx.paymentMethod === 'TUNAI' ? 'stone' : 'blue'}>{PAYMENT_LABEL[trx.paymentMethod]}</Badge>
                          {trx.status === 'VOID' && <Badge tone="red">Dibatalkan</Badge>}
                        </div>
                        <div className="truncate text-sm text-stone-500">{trx.items.map((i) => `${i.qty}× ${i.productName}`).join(', ')}</div>
                      </button>
                      {canVoid && (
                        <Button variant="ghost" size="icon" onClick={() => setVoiding(trx)} aria-label="Batalkan transaksi" title="Batalkan">
                          <Ban className="size-4" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Keranjang desktop */}
      <aside className="hidden lg:block">
        <Card className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col p-4">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><ShoppingBag className="size-5" /> Pesanan</h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CartPanel draft={draft} setDraft={setDraft} products={products} onSave={onSave} />
          </div>
        </Card>
      </aside>

      {/* Bar keranjang ponsel */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-30 px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl bg-brand-700 px-4 py-3.5 text-white shadow-lg shadow-brand-900/25"
          >
            <span className="flex items-center gap-2 font-semibold"><ShoppingBag className="size-5" /> {cartCount} cup</span>
            <span className="tabular font-extrabold">{rupiah(cartTotal)} →</span>
          </button>
        </div>
      )}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Pesanan">
        <CartPanel draft={draft} setDraft={setDraft} products={products} onSave={onSave} />
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.code || ''} size="sm">
        {detail && (
          <div className="space-y-3 text-[15px]">
            <div className="text-sm text-stone-500">{fmtTime(detail.occurredAt)} · {PAYMENT_LABEL[detail.paymentMethod]} · {detail.cashier?.name}</div>
            <ul className="divide-y divide-stone-100">
              {detail.items.map((i) => (
                <li key={i.productId} className="tabular flex justify-between py-2"><span>{i.qty}× {i.productName}</span><span>{rupiah(i.subtotal)}</span></li>
              ))}
            </ul>
            <div className="tabular flex justify-between border-t border-stone-200 pt-2 font-bold"><span>Total</span><span>{rupiah(detail.total)}</span></div>
            {detail.note && <p className="text-sm text-stone-600">Catatan: {detail.note}</p>}
            {detail.status === 'VOID' && <p className="text-sm text-red-600">Dibatalkan: {detail.voidReason}</p>}
          </div>
        )}
      </Modal>

      <VoidDialog trx={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}
