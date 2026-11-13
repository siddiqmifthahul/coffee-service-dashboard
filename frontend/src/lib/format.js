const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('id-ID');

export const rupiah = (n) => rupiahFmt.format(Number(n) || 0).replace(/\s/g, ' ');
export const num = (n) => numFmt.format(Number(n) || 0);

/** Rupiah ringkas untuk sumbu grafik: 1,2 jt / 850 rb */
export function rupiahShort(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString('id-ID')} rb`;
  return num(v);
}

/** "12.500" -> 12500 (input nominal) */
export const parseNumber = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

export const PAYMENT_LABEL = { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer' };
export const CATEGORY_LABEL = { KOPI: 'Kopi', NON_KOPI: 'Non-Kopi', TAMBAHAN: 'Tambahan' };

export function pct(v) {
  if (v === null || v === undefined) return null;
  return `${v > 0 ? '+' : ''}${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}
