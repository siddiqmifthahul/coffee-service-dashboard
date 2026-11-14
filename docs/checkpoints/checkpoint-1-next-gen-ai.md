# Checkpoint 1 — Next-Gen AI Engineer (Tahap Perencanaan)

**Tim:** A26-CS276 · **UMKM:** Coffee Service (Banda Aceh)
**Use case:** Dashboard Rekapan Kasir Penjualan Otomatis dan Realtime
**Learning path:** Next-Gen AI Engineer — Muhammad Faiz Akbar (Leader) & Mifthahul Siddiq
**Periode:** Minggu 1 (3–15 November 2026)

---

## 1. Ringkasan

Di minggu pertama, tim AI menyusun rencana fitur AI untuk dashboard kasir Coffee Service:
- Menentukan masalah yang diselesaikan model.
- Memahami data dari UMKM.
- Merancang model forecasting dan fitur Gen AI.
- Menyepakati kontrak API dengan tim Full-Stack.
- Menyiapkan rencana penanganan risiko.

Kerangka AI service (FastAPI) sudah dibuat sebagai fondasi pengembangan minggu berikutnya.

## 2. Masalah yang akan diselesaikan dengan AI

Dari wawancara dengan pemilik (Pak Rahmat Farhan, 24 Okt 2026), selama ini pemilik hanya punya rekap Excel bulanan. Akibatnya:
1. **Belanja bahan baku tidak terencana.** Tidak ada perkiraan penjualan beberapa hari ke depan, sehingga stok bisa kurang di hari ramai atau terbuang di hari sepi.
2. **Tidak sempat membaca angka rekap** untuk mengambil keputusan, misalnya menu mana yang naik/turun atau pengeluaran mana yang terbesar.
3. **Butuh jawaban cepat** atas pertanyaan seputar penjualan tanpa membuka banyak laporan.

| Fitur AI | Masalah yang dijawab | Jenis |
|---|---|---|
| Prediksi penjualan 7 hari | Persiapan stok bahan | Machine Learning (regresi deret waktu) |
| Smart Summary / insight bisnis | Ringkasan performa + saran tindakan | Generative AI (Gemini API) |
| Asisten tanya-jawab + intent classifier | Jawaban cepat; tolak pertanyaan di luar usaha; keluhan diteruskan ke pemilik | Klasifikasi intent + Gen AI |

## 3. Pemahaman data

- **Sumber data primer:** file Excel UMKM `PERHITUNGAN PENDAPTAN CEES-1.xlsx`, berisi rekap bulanan Agustus–November 2026 untuk 18 menu (qty, HPP, harga jual, pendapatan kotor) dan biaya operasional bulanan.
- **Keterbatasan:** datanya **bulanan**, bukan harian, dan November baru sebagian. Data harian per transaksi belum ada karena aplikasi kasir baru akan dibangun.
- **Keputusan:**
  - Untuk pengembangan, dibuat **data harian dummy** dari total bulanan Excel. Total per bulan dijaga sama persis dengan Excel, dan data diberi label "dummy".
  - Setelah aplikasi dipakai, model dilatih ulang dengan transaksi riil yang diekspor dari database.
- **Masalah kualitas data yang ditemukan:** nama menu dengan spasi berlebih dan kapitalisasi tidak konsisten (contoh: `"Ice black Tea "`, `"SANGER CEES PROMO"`), qty kosong pada menu yang tidak terjual, dan total qty November kosong. Semua akan ditangani di tahap preprocessing.

## 4. Rencana model Machine Learning (forecasting)

| Aspek | Rencana |
|---|---|
| Target | Omzet harian (Rp) & jumlah cup per hari |
| Preprocessing | Validasi tipe data, rapikan nama menu, buang transaksi batal dan duplikat, agregasi per hari (WIB), isi tanggal kosong dengan 0 |
| Fitur | Hari dalam minggu, akhir pekan, tanggal, lag 1/2/7/14 hari, rata-rata bergerak 7 & 14 hari, rata-rata hari yang sama 4 minggu terakhir. Semua fitur hanya memakai data sebelum hari yang diprediksi agar **tidak ada kebocoran data** |
| Model yang dibandingkan | **Baseline** (rata-rata × faktor hari) vs **Random Forest** vs **XGBoost**, ditambah versi yang di-*tuning* |
| Pembagian data | Berdasarkan waktu (bukan acak): ±21 hari terakhir sebagai data uji |
| Tuning | GridSearchCV + TimeSeriesSplit, hanya pada data latih |
| Metrik | **MAE, RMSE, R²** (sama untuk semua model) + error prediksi 7 hari |
| Pemilihan | Model dengan MAE terkecil dipakai. Jika model ML tidak mengalahkan baseline, baseline tetap dipakai |

## 5. Rencana fitur Generative AI

- **LLM:** Gemini API (`gemini-2.5-flash`), dipanggil **hanya dari backend**, tidak langsung dari frontend.
- **Prompt terstruktur:** system prompt berisi profil usaha dan aturan gaya bahasa (sapaan "Kak", tanpa istilah teknis, tidak boleh mengarang angka), contoh *few-shot*, dan keluaran berformat JSON.
- **Intent classifier** dengan 5 intent:

| Intent | Penanganan |
|---|---|
| `tanya_penjualan` | Dijawab dengan data rekap hari ini & bulan ini |
| `tanya_produk` | Dijawab dengan data menu terlaris & harga |
| `minta_saran` | Saran dari data (menu andalan, pengeluaran terbesar) |
| `keluhan` | Dicatat & diteruskan ke pemilik (`escalate`) |
| `di_luar_konteks` | **Ditolak sopan tanpa memanggil LLM** (hemat kuota) |

- **Guardrail:** akan diuji dengan minimal **10 pertanyaan di luar konteks** (politik, cuaca, coding, olahraga, film, zodiak, kripto, terjemahan, puisi, geografi).
- **Riwayat** semua permintaan AI disimpan di database.

## 6. Kontrak API (disepakati dengan tim Full-Stack)

AI service dibangun dengan **FastAPI**, dengan dokumentasi Swagger di `/docs`.

| Endpoint | Input | Output |
|---|---|---|
| `POST /predict-sales` | riwayat harian `{date, sales, cups, transactions}` + `horizon` (1–14) | prediksi per hari, total, nama model, metrik |
| `POST /generate-insight` | ringkasan periode (total, perubahan %, menu teratas, pengeluaran per kategori) | `insight`, `recommendations[]`, `is_fallback` |
| `POST /chat` | `message` + konteks data | `intent`, `reply`, `escalate`, `is_fallback` |

Alurnya: frontend → backend Express (`/api/v1/ai/*`) → AI service → Gemini. Input yang tidak valid dibalas **422** (validasi Pydantic).

## 7. Risiko & mitigasi

| Risiko | Mitigasi | Rencana cadangan |
|---|---|---|
| Kuota gratis Gemini habis / lambat | Cache respons 10 menit, timeout 12 detik, jeda otomatis saat kena error 429 | Jawaban template berbasis data (`is_fallback: true`), sehingga dashboard tidak pernah error |
| Data harian riil belum ada | Data dummy berlabel dari total Excel | Latih ulang model setelah transaksi riil terkumpul |
| Data latih sedikit (±3,5 bulan) → model ML *overfit* | Model sederhana + regularisasi, validasi berbasis waktu | Tetap pakai baseline bila ML tidak lebih baik |
| Integrasi dengan backend gagal | Kontrak API disepakati di minggu 1 | Respons fallback/mock dari backend |

## 8. Progres minggu 1

- [x] Analisis masalah & peran AI dari hasil wawancara dan use case
- [x] Analisis data Excel UMKM & identifikasi masalah kualitas data
- [x] Rancangan model forecasting (fitur, model pembanding, metrik, skema validasi)
- [x] Rancangan Gen AI: prompt, intent classifier, guardrail, fallback
- [x] Kontrak API AI service disepakati dengan tim Full-Stack
- [x] Kerangka FastAPI: 3 endpoint + Swagger + baseline forecasting + fallback template
- [x] Tes awal: endpoint berjalan, 10 pertanyaan di luar konteks berhasil ditolak

## 9. Rencana minggu berikutnya (Minggu 2: 20–27 Nov)

1. Pipeline preprocessing + feature engineering, lalu training & komparasi Baseline vs Random Forest vs XGBoost, dengan tabel MAE/RMSE/R² di README.
2. Uji Gemini API dengan API key asli dan menyempurnakan prompt berdasarkan hasilnya.
3. Integrasi `/predict-sales` dan `/generate-insight` ke dashboard owner bersama tim Full-Stack.
4. Dokumentasi README AI: masalah, preprocessing, perbandingan model, hasil uji guardrail, sumber library.

## 10. Kendala

- Data dari UMKM hanya rekap bulanan, sehingga pola harian/jam belum bisa dipelajari dari data riil.
- API key Gemini belum dipakai untuk pengujian. Sementara ini pengujian memakai mode cadangan (template).
