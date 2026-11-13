// Data dari file UMKM "PERHITUNGAN PENDAPTAN CEES-1.xlsx" (rekap bulanan Agustus–November).
// Menu, HPP & harga jual diambil persis dari file tersebut.

export const PRODUCTS = [
  { name: 'Ice Sanger Cees', category: 'KOPI', hpp: 7893, price: 18000 },
  { name: 'Hot Sanger Cees', category: 'KOPI', hpp: 6038, price: 15000 },
  { name: 'Ice Kopi Susu Cees', category: 'KOPI', hpp: 6662, price: 21000 },
  { name: 'Hot Kopi Susu Cees', category: 'KOPI', hpp: 9093, price: 19000 },
  { name: 'Sanger Cees Promo', category: 'KOPI', hpp: 7893, price: 10000 },
  { name: 'Ice Long Black', category: 'KOPI', hpp: 3577, price: 15000 },
  { name: 'Hot Long Black', category: 'KOPI', hpp: 3561, price: 13000 },
  { name: 'Black Moon', category: 'KOPI', hpp: 7097, price: 18000 },
  { name: 'Black Peach', category: 'KOPI', hpp: 3292, price: 18000 },
  { name: 'Espresso', category: 'KOPI', hpp: 3561, price: 10000 },
  { name: 'Aren Latte', category: 'KOPI', hpp: 7502, price: 21000 },
  { name: 'Ice Black Tea', category: 'NON_KOPI', hpp: 2737, price: 12000 },
  { name: 'Hot Black Tea', category: 'NON_KOPI', hpp: 2471, price: 10000 },
  { name: 'Peach Tea', category: 'NON_KOPI', hpp: 5025, price: 17000 },
  { name: 'Lemon Tea', category: 'NON_KOPI', hpp: 4757, price: 17000 },
  { name: 'Havana Peach', category: 'NON_KOPI', hpp: 6885, price: 21000 },
  { name: 'Sunny Lemon', category: 'NON_KOPI', hpp: 7927, price: 21000 },
  { name: 'Extra Shot', category: 'TAMBAHAN', hpp: 1935, price: 5000 },
];

// Qty terjual per bulan (urutan sesuai PRODUCTS). Tahun diasumsikan 2026.
// November = data parsial; disebar ke tanggal 1–12.
export const MONTHLY_QTY = [
  {
    month: '2026-08', lastDay: 31,
    qty: { 'Ice Sanger Cees': 140, 'Hot Sanger Cees': 36, 'Ice Kopi Susu Cees': 29, 'Sanger Cees Promo': 27, 'Ice Long Black': 45, 'Hot Long Black': 17, 'Black Moon': 12, 'Black Peach': 32, 'Ice Black Tea': 12, 'Hot Black Tea': 4, 'Peach Tea': 25, 'Lemon Tea': 5, 'Havana Peach': 17, Espresso: 10, 'Extra Shot': 10, 'Aren Latte': 19 },
    expenses: { 'Gaji Barista': 800000, 'Token Listrik': 220000, PDAM: 35000, 'Sewa Toko': 708333 },
    excel: { sales: 7227000, hpp: 2647388, net: 2816279 },
  },
  {
    month: '2026-09', lastDay: 30,
    qty: { 'Ice Sanger Cees': 120, 'Hot Sanger Cees': 17, 'Ice Kopi Susu Cees': 16, 'Hot Kopi Susu Cees': 1, 'Ice Long Black': 31, 'Hot Long Black': 9, 'Black Moon': 8, 'Black Peach': 11, 'Ice Black Tea': 3, 'Peach Tea': 21, 'Lemon Tea': 6, 'Havana Peach': 12, Espresso: 6, 'Extra Shot': 6, 'Aren Latte': 11 },
    expenses: { 'Gaji Barista': 800000, 'Token Listrik': 220000, PDAM: 35000, 'Sewa Toko': 708333 },
    excel: { sales: 4762000, hpp: 1741811, net: 1256856 },
  },
  {
    month: '2026-10', lastDay: 31,
    qty: { 'Ice Sanger Cees': 98, 'Hot Sanger Cees': 34, 'Ice Kopi Susu Cees': 25, 'Hot Kopi Susu Cees': 3, 'Ice Long Black': 35, 'Hot Long Black': 25, 'Black Moon': 12, 'Black Peach': 11, 'Ice Black Tea': 6, 'Hot Black Tea': 5, 'Peach Tea': 26, 'Lemon Tea': 5, 'Havana Peach': 5, Espresso: 16, 'Extra Shot': 6, 'Aren Latte': 17 },
    expenses: { 'Gaji Barista': 850000, 'Token Listrik': 220000, PDAM: 35000, 'Sewa Toko': 708333 },
    excel: { sales: 5421000, hpp: 1921988, net: 1685679 },
  },
  {
    month: '2026-11', lastDay: 12,
    qty: { 'Ice Sanger Cees': 38, 'Hot Sanger Cees': 8, 'Ice Kopi Susu Cees': 7, 'Ice Long Black': 11, 'Hot Long Black': 5, 'Black Moon': 1, 'Black Peach': 2, 'Peach Tea': 11, 'Lemon Tea': 6, 'Havana Peach': 3, Espresso: 3, 'Extra Shot': 2, 'Aren Latte': 2 },
    expenses: { 'Gaji Barista': 800000, 'Token Listrik': 220000, PDAM: 35000, 'Sewa Toko': 708333 },
    excel: { sales: 1669000, hpp: 599734, net: -694067 },
  },
];

/** PRNG deterministik (mulberry32) agar seed selalu menghasilkan data yang sama */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Bangkitkan transaksi harian DUMMY dari qty bulanan Excel.
 * Total qty per menu per bulan sama persis dengan Excel.
 * @returns {Array<{date:string, time:string, paymentMethod:string, items:{name:string, qty:number}[]}>}
 */
export function generateTransactions(seed = 2026) {
  const rand = rng(seed);
  const out = [];

  for (const m of MONTHLY_QTY) {
    const days = Array.from({ length: m.lastDay }, (_, i) => `${m.month}-${pad(i + 1)}`);
    // bobot hari: Jumat–Minggu lebih ramai
    const weights = days.map((d) => {
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      return (wd === 0 || wd === 5 || wd === 6 ? 1.6 : 1) * (0.7 + rand() * 0.6);
    });
    const wSum = weights.reduce((a, b) => a + b, 0);

    // sebar setiap cup ke hari tertentu
    const perDay = days.map(() => []);
    for (const [name, qty] of Object.entries(m.qty)) {
      for (let i = 0; i < qty; i += 1) {
        let r = rand() * wSum;
        let idx = 0;
        while (r > weights[idx] && idx < days.length - 1) {
          r -= weights[idx];
          idx += 1;
        }
        perDay[idx].push(name);
      }
    }

    days.forEach((date, di) => {
      const cups = perDay[di];
      // acak urutan lalu potong menjadi transaksi berisi 1–3 cup
      for (let i = cups.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [cups[i], cups[j]] = [cups[j], cups[i]];
      }
      let i = 0;
      while (i < cups.length) {
        const size = Math.min(cups.length - i, 1 + Math.floor(rand() * rand() * 3));
        const chunk = cups.slice(i, i + size);
        i += size;
        const items = Object.entries(chunk.reduce((acc, n) => ({ ...acc, [n]: (acc[n] || 0) + 1 }), {}))
          .map(([name, qty]) => ({ name, qty }));
        const hour = 9 + Math.floor(rand() * 13); // 09:00–21:59 WIB
        const minute = Math.floor(rand() * 60);
        out.push({
          date,
          time: `${pad(hour)}:${pad(minute)}`,
          paymentMethod: rand() < 0.62 ? 'TUNAI' : 'QRIS',
          items,
        });
      }
    });
  }
  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
