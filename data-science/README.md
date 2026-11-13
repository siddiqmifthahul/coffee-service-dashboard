# Data Science — Coffee Service

Analisis data penjualan & keuangan Coffee Service untuk learning path **Data Science** (Fayyadh Tajuzzaman & Firas Razin Fauzani).

> 📝 Notebook ini **draf awal**. Tim DS perlu menjalankan ulang, memahami setiap langkah, mengonfirmasi temuan ke pemilik usaha, dan menyempurnakan narasinya.

## Isi folder

| Path | Isi |
|---|---|
| `notebooks/analisis_coffee_service.ipynb` | Notebook utama: identifikasi masalah → pertanyaan bisnis → data wrangling → analisis → kesimpulan & rekomendasi |
| `data/raw/` | Excel UMKM (data primer) + transaksi dummy dari aplikasi |
| `data/processed/` | Data bersih siap pakai untuk tim lain (dibuat oleh notebook) |
| `figures/` | Grafik hasil analisis (PNG) |
| `DATA_DICTIONARY.md` | Penjelasan setiap kolom data mentah & olahan |

## Pertanyaan bisnis & jawaban singkat

| # | Pertanyaan | Temuan utama |
|---|---|---|
| P1 | Menu penyumbang laba kotor terbesar? | **Ice Sanger Cees ±33%**. 4 menu teratas ±62%, 7 menu teratas ±81% |
| P2 | Tren omzet & laba Agustus–November? | Omzet per hari turun **32%** di September dan belum pulih. Biaya tetap (±Rp1,76 juta/bulan) selalu tertutup di bulan penuh |
| P3 | Berapa cup per hari agar balik modal? | **±5,5 cup/hari** (±162–171 cup/bulan). Penjualan aktual 8–14 cup/hari, tapi margin aman terus menyusut |
| P4 | Margin vs popularitas menu? | Black Peach (82%), Ice Black Tea, dan Lemon Tea bermargin tinggi tapi jarang dibeli. **Sanger Cees Promo bermargin hanya 21%**. **Sunny Lemon 0 terjual** selama 4 bulan |

## Data wrangling yang dilakukan
- **Assessing:** menemukan 9 nama menu berakhiran spasi, 3 kapitalisasi tidak konsisten, 8 sel qty kosong, total qty November kosong, dan bulan November yang parsial. Rumus Excel sudah dicek konsisten.
- **Cleaning:** merapikan nama menu, mengisi qty kosong dengan 0, menghitung ulang total, dan menormalisasi per hari untuk membandingkan bulan parsial.
- **Verifikasi:** total hasil cleaning dicek otomatis (`assert`) agar **sama persis** dengan baris TOTAL dan PENDAPATAN BERSIH di Excel UMKM.

## Menjalankan

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
jupyter notebook notebooks/analisis_coffee_service.ipynb    # atau buka di VS Code / Google Colab
```

## Keterbatasan
- Data primer hanya rekap **bulanan** selama 4 bulan, jadi pola harian/jam belum bisa dianalisis.
- Transaksi harian di aplikasi saat ini **dummy**. Analisis jam/hari ramai dilakukan setelah aplikasi mengumpulkan transaksi riil (ekspor lewat halaman Export → "Detail transaksi").
- Asumsi: tahun data = 2026, data November mencakup tanggal 1–12.
- Penyebab penurunan penjualan setelah Agustus belum dikonfirmasi ke pemilik.
