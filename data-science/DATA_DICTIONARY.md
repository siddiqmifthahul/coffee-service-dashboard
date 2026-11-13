# Kamus Data (Data Dictionary) — Coffee Service

Semua nominal dalam **Rupiah (Rp)** tanpa desimal. Zona waktu **WIB (UTC+7)**.

## A. Data mentah (`data/raw/`)

### `PERHITUNGAN PENDAPTAN CEES-1.xlsx` — data primer UMKM
- Rekap bulanan Agustus–November 2026, dengan 1 sheet per bulan.
- Sumber: pemilik Coffee Service (wawancara 24 Okt 2026).
- **November parsial**: bulan belum selesai saat data diberikan.

| Kolom | Arti |
|---|---|
| NAMA MENU | Nama minuman (perlu dirapikan: spasi di akhir & kapitalisasi tidak konsisten) |
| QTY | Jumlah cup terjual dalam bulan itu (kosong = 0) |
| HPP | Harga pokok penjualan per cup |
| TOTAL HPP | QTY × HPP |
| HARGA JUAL | Harga jual per cup |
| PENDAPATAN KOTOR | QTY × HARGA JUAL |
| Baris GAJI BARISTA / TOKEN / PDAM / SEWA TOKO | Biaya operasional tetap bulanan (TOKEN = token listrik) |
| TOTAL PENDAPATAN BERSIH | (Σ PENDAPATAN KOTOR − Σ TOTAL HPP) − Σ biaya operasional |

### `transaksi_dummy.csv` — transaksi per item (⚠️ DUMMY)
- Format sama dengan CSV "Detail transaksi" di halaman Export aplikasi.
- Dibangkitkan dari qty bulanan Excel oleh `backend/prisma/seedData.js`: total per bulan sama dengan Excel, tetapi tanggal, jam, dan komposisi tiap transaksi adalah simulasi.
- **Jangan dipakai untuk analisis pola jam atau hari.**

| Kolom | Tipe | Arti |
|---|---|---|
| Tanggal | date `YYYY-MM-DD` | Tanggal transaksi (WIB) |
| Jam | `HH:mm` | Jam transaksi (WIB) |
| Kode | string | Kode unik transaksi, contoh `TRX-260801-S0001` |
| Kasir | string | Nama kasir yang mencatat |
| Metode Bayar | Tunai / QRIS / Transfer | Cara bayar |
| Menu | string | Nama menu (snapshot saat transaksi) |
| Qty | int | Jumlah cup untuk menu tsb |
| Harga | int | Harga jual per cup saat transaksi |
| Subtotal | int | Qty × Harga |
| Status | Selesai / Dibatalkan | Transaksi dibatalkan tidak dihitung di rekap |
| Catatan | string | Catatan kasir / alasan pembatalan |

## B. Data hasil olahan (`data/processed/`, dibuat oleh notebook)

### `penjualan_menu_bulanan.csv` (1 baris = 1 menu × 1 bulan)
| Kolom | Arti |
|---|---|
| bulan | AGUSTUS / SEPTEMBER / OKTOBER / NOVEMBER |
| menu | Nama menu yang sudah dirapikan (Title Case, tanpa spasi berlebih) |
| qty | Cup terjual (NaN → 0) |
| hpp, harga_jual | HPP & harga jual per cup |
| total_hpp | qty × hpp |
| pendapatan_kotor | qty × harga_jual |
| laba_kotor | pendapatan_kotor − total_hpp |

### `biaya_operasional_bulanan.csv`
| Kolom | Arti |
|---|---|
| bulan | Nama bulan |
| biaya | Gaji Barista / Token (listrik) / Pdam / Sewa Toko |
| nominal | Besar biaya bulan itu |

### `ringkasan_bulanan.csv` (1 baris = 1 bulan)
| Kolom | Arti |
|---|---|
| cup, omzet, hpp, laba_kotor | Total bulan itu |
| biaya_tetap | Σ biaya operasional |
| laba_bersih | laba_kotor − biaya_tetap (sama dengan "TOTAL PENDAPATAN BERSIH" di Excel) |
| hari_data | Jumlah hari yang tercakup. November diasumsikan 12 hari (1–12 Nov) |
| omzet_per_hari, cup_per_hari | Dinormalisasi per hari agar bulan parsial bisa dibandingkan |
| perubahan_omzet_harian_% | Perubahan omzet per hari vs bulan sebelumnya |
| laba_kotor_per_cup | laba_kotor / cup |
| bep_cup_per_bulan, bep_cup_per_hari | Titik impas = biaya_tetap / laba_kotor_per_cup (per hari = /30) |
| margin_aman_% | Seberapa jauh penjualan aktual di atas titik impas |

### `ringkasan_per_menu.csv` (1 baris = 1 menu, gabungan Agu–Nov)
| Kolom | Arti |
|---|---|
| qty, pendapatan, laba_kotor | Total 4 bulan |
| harga, hpp | Harga jual & HPP per cup |
| porsi_laba_% | Kontribusi menu terhadap total laba kotor |
| kumulatif_% | Kumulatif porsi laba (urut dari terbesar), untuk analisis Pareto |
| margin_% | (harga − hpp) / harga |

## C. Data untuk model AI (`ai-service/data/`)
- `raw/transaksi.csv`: hasil `npm run export:training` dari database (format seperti `transaksi_dummy.csv`).
- `processed/daily_sales.csv`: `date, sales, cups, transactions` (1 baris per hari, hari tanpa penjualan = 0), dibuat oleh `ai-service/training/prepare_data.py`.
