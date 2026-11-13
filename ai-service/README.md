# AI Service — Coffee Service (Next-Gen AI)

Layanan Machine Learning & Generative AI untuk *Dashboard Rekapan Kasir Coffee Service*. Dibangun dengan **FastAPI**, dipanggil **hanya oleh backend Express** (bukan langsung dari frontend). Dokumentasi interaktif (Swagger) tersedia di `/docs`.

## 1. Masalah yang diselesaikan model

Pemilik Coffee Service (Pak Rahmat Farhan) selama ini hanya punya rekap Excel bulanan, sehingga:

1. **Tidak tahu perkiraan penjualan beberapa hari ke depan.** Akibatnya, belanja bahan baku (susu, kopi, teh, peach) hanya berdasarkan perasaan. Bahan bisa kurang di akhir pekan yang ramai, atau berlebih lalu terbuang.
2. **Tidak sempat membaca angka rekap** dan menarik kesimpulan (menu mana yang naik/turun, pengeluaran terbesar, apa yang harus dilakukan).
3. **Butuh jawaban cepat** atas pertanyaan seperti "berapa penjualan hari ini?" tanpa membuka banyak halaman.

| Model / fitur | Menjawab masalah | Endpoint |
|---|---|---|
| **Forecasting penjualan** (regresi deret waktu) | Prediksi omzet & jumlah cup 7 hari ke depan untuk menyiapkan stok bahan | `POST /predict-sales` |
| **Smart Summary** (Gemini) | Ringkasan performa + 2–3 saran tindakan dari data rekap periode | `POST /generate-insight` |
| **Intent classifier + asisten** (Gemini) | Tanya-jawab seputar penjualan/menu; menolak pertanyaan di luar usaha; keluhan diteruskan ke pemilik | `POST /chat` |

## 2. Data & preprocessing

**Sumber data:**
- Data primer UMKM: `PERHITUNGAN PENDAPTAN CEES-1.xlsx`, berisi menu, HPP, harga jual, qty per bulan Agustus–November, dan biaya operasional.
- Transaksi tercatat di database aplikasi (Supabase), diekspor dengan `npm run export:training` di folder `backend`. Format kolomnya sama dengan CSV "Detail transaksi" di halaman Export.
- ⚠️ **Saat ini transaksi harian adalah DATA DUMMY.** Data ini dibangkitkan dari total bulanan Excel; total per bulan sama persis dengan Excel, tetapi sebaran per hari dan jam adalah simulasi. Semua metrik di bawah karena itu hanya **ilustrasi pipeline**.

**Tahapan preprocessing** (`training/prepare_data.py`):

| Langkah | Tujuan |
|---|---|
| Validasi kolom wajib & tipe data (tanggal, angka) | Baris rusak dibuang dan dihitung |
| Rapikan nama menu (spasi berlebih, kapitalisasi) | Di Excel ada `"Ice black Tea "` dan `"Hot Long Black "` → disatukan |
| Buang transaksi **dibatalkan**, qty ≤ 0, harga negatif, dan baris duplikat | Hanya penjualan sah yang dipakai |
| Cek konsistensi `subtotal = qty × harga` | Selisih diperbaiki dan dicatat |
| Agregasi per hari (WIB): omzet, cup, jumlah transaksi | Bentuk deret waktu harian |
| Lengkapi tanggal bolong dengan 0 | Deret waktu kontinu, sehingga lag tidak bergeser |

Laporan kualitas data tersimpan di `reports/data_quality.json`. Hasil terakhir: 1.085/1.085 baris bersih, 104 hari (1 Agu – 12 Nov 2026), total omzet Rp19.079.000, sama dengan total Excel.

**Feature engineering** (`app/features.py`, dipakai bersama oleh training dan serving):
- Kalender: hari ke-, akhir pekan (Jumat–Minggu), tanggal, awal bulan.
- Lag 1, 2, 7, 14 hari.
- Rata-rata bergerak 7 & 14 hari, simpangan baku 7 hari.
- Rata-rata hari yang sama selama 4 minggu terakhir.

Semua fitur di-*shift* sehingga hanya memakai data **sebelum** hari yang diprediksi. Dengan begitu tidak ada kebocoran data; hal ini juga diuji di `tests/test_ml.py`.

## 3. Perbandingan model (MAE, RMSE, R²)

- **Pembagian data berbasis waktu:** 21 hari terakhir dipakai sebagai data uji (23 Okt – 12 Nov), 55 hari sebelumnya untuk train. 28 hari pertama hanya dipakai sebagai riwayat fitur.
- **Tuning hyperparameter:** `GridSearchCV` + `TimeSeriesSplit` (4 lipatan) **hanya pada data train**.
- **Evaluasi utama:** prediksi satu hari ke depan. Ada juga evaluasi tambahan: prediksi rekursif 7 hari, sama seperti kartu prediksi di dashboard.

**Target omzet harian** (rata-rata aktual di data uji: Rp150.333/hari):

| Peringkat | Model | MAE ↓ | RMSE ↓ | R² ↑ | MAE prediksi 7 hari ↓ |
|---|---|---|---|---|---|
| 1 | **Baseline** (rata-rata 4 minggu × faktor hari) | **Rp48.600** | **Rp57.751** | **0.264** | **Rp57.318** |
| 2 | Random Forest (tuned) | Rp54.202 | Rp63.128 | 0.121 | Rp63.094 |
| 3 | XGBoost (tuned) | Rp54.261 | Rp63.406 | 0.113 | Rp67.163 |
| 4 | Random Forest (default) | Rp54.542 | Rp64.911 | 0.071 | Rp68.790 |
| 5 | XGBoost (default) | Rp63.238 | Rp75.027 | -0.241 | Rp87.714 |

Tabel lengkap, termasuk target jumlah cup dan hyperparameter terbaik, ada di [`reports/model_comparison.md`](reports/model_comparison.md). File itu dibuat otomatis oleh skrip training.

**Pengaruh tuning hyperparameter:** MAE turun dari Rp63.238 ke Rp54.261 (−14%) pada XGBoost, dan dari Rp54.542 ke Rp54.202 pada Random Forest. Parameter yang terpilih cenderung model dangkal dengan regularisasi kuat (misalnya `max_depth` 2–5, `reg_lambda` 5). Ini wajar untuk data yang hanya 55 baris: model kompleks mudah *overfit*.

**Alasan pemilihan model:**
- Dengan data saat ini, **baseline justru yang terbaik** di semua metrik. Jadi `/predict-sales` tetap memakai baseline, dan model ML **tidak dipasang**.
- Penyebabnya: (1) pola harian pada data dummy diacak dari total bulanan sehingga hampir tidak ada sinyal yang bisa dipelajari, (2) data latih hanya 55 hari, dan (3) ada penurunan omzet di November yang belum pernah dilihat model saat training.
- Di antara model ML, **Random Forest (tuned)** paling stabil (R² tertinggi, error 7 hari terkecil). Model inilah kandidat utama begitu data transaksi riil terkumpul.
- Pipeline ini **otomatis memasang model ML** bila model tersebut mengalahkan baseline. Model terpilih dilatih ulang dengan seluruh data, disimpan ke `models/forecast_model.joblib`, lalu langsung dipakai `/predict-sales`. Jalur ini sudah diuji di `tests/test_ml.py`.

**Keterbatasan:**
- Metrik di atas berasal dari data dummy, jadi tidak boleh diklaim sebagai akurasi nyata.
- Model belum memperhitungkan faktor eksternal seperti hari libur, cuaca, atau promosi.
- Prediksi rekursif membuat error menumpuk untuk hari-hari yang lebih jauh.

## 4. Fitur Generative AI (Gemini API)

- **Model:** `gemini-2.5-flash` (bisa diubah lewat `GEMINI_MODEL`), dipanggil dengan SDK resmi `google-genai`.
- **Prompt terstruktur** (`app/prompts.py`): *system prompt* berisi profil usaha, aturan gaya bahasa ("Kak", santai-profesional, tanpa istilah teknis), larangan mengarang angka, dan format keluaran JSON, ditambah contoh *few-shot*.
- **Keandalan** (`app/llm.py`):
  - Timeout 12 detik.
  - Cache respons 10 menit untuk menghemat kuota.
  - Jika kena batas kuota (HTTP 429), service berhenti memanggil Gemini selama 60 detik.
  - Jika key kosong, kuota habis, atau timeout, service otomatis memakai jawaban **template berbasis data** (`is_fallback: true`), jadi dashboard tidak pernah error.
- Riwayat semua permintaan AI disimpan di tabel `AiLog` oleh backend.

### Intent classifier & guardrail (`app/intent.py`)

Ada 5 intent: `tanya_penjualan`, `tanya_produk`, `minta_saran`, `keluhan`, `di_luar_konteks`. Routing-nya:
- Pertanyaan penjualan dan produk dijawab dengan data konteks (hari ini + bulan ini).
- `keluhan` ditandai `escalate: true` agar diteruskan ke pemilik.
- `di_luar_konteks` **langsung ditolak tanpa memanggil LLM**, sehingga hemat kuota dan aman.

Versi saat ini berbasis kata kunci (baseline) dan bisa diganti model terlatih selama tetap mengembalikan `(intent, confidence)`.

**Uji guardrail dengan 10 pertanyaan di luar konteks** (`tests/test_api.py`, semuanya lulus):

| # | Pertanyaan | Intent | Hasil |
|---|---|---|---|
| 1 | Siapa presiden Indonesia sekarang? | di_luar_konteks | ✅ Ditolak sopan |
| 2 | Bagaimana cuaca di Banda Aceh besok? | di_luar_konteks | ✅ Ditolak sopan |
| 3 | Tolong buatkan kode python untuk kalkulator | di_luar_konteks | ✅ Ditolak sopan |
| 4 | Siapa yang menang sepak bola tadi malam? | di_luar_konteks | ✅ Ditolak sopan |
| 5 | Rekomendasikan film horor terbaru | di_luar_konteks | ✅ Ditolak sopan |
| 6 | Apa zodiak yang cocok dengan Leo? | di_luar_konteks | ✅ Ditolak sopan |
| 7 | Berapa harga bitcoin hari ini? | di_luar_konteks | ✅ Ditolak sopan |
| 8 | Tolong terjemahkan kalimat ini ke bahasa Inggris | di_luar_konteks | ✅ Ditolak sopan |
| 9 | Buatkan puisi tentang hujan | di_luar_konteks | ✅ Ditolak sopan |
| 10 | Apa ibu kota Australia? | di_luar_konteks | ✅ Ditolak sopan |

Jawaban penolakannya: *"Maaf Kak, saya hanya bisa membantu seputar usaha Coffee Service — misalnya penjualan, menu, pengeluaran, atau saran bisnis…"*

## 5. Endpoint (kontrak API)

| Endpoint | Request | Response |
|---|---|---|
| `GET /` | – | status service, model LLM aktif, daftar intent |
| `POST /predict-sales` | `{history:[{date,sales,cups,transactions}], horizon:1-14}` | `{predictions:[{date,sales,cups}], summary, model_name, metrics, is_fallback}` |
| `POST /generate-insight` | ringkasan periode (`totals`, `change_pct`, `top_products`, `expense_by_category`, …) | `{insight, recommendations[], model, is_fallback}` |
| `POST /chat` | `{message, context}` | `{intent, confidence, reply, escalate, model, is_fallback}` |

Input tidak valid dijawab dengan **422** dan detail field (validasi Pydantic).

## 6. Menjalankan

```bash
python -m venv .venv && .venv\Scripts\activate     # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                # isi GEMINI_API_KEY (opsional)
uvicorn app.main:app --reload --port 8000           # Swagger: http://localhost:8000/docs
pytest -q                                           # 24 tes: API, guardrail, pipeline ML
```

**Melatih ulang model** (misalnya setelah data riil terkumpul):
```bash
cd ../backend && npm run export:training            # ekspor transaksi dari database → data/raw/transaksi.csv
cd ../ai-service
python -m training.prepare_data                     # preprocessing → data/processed/daily_sales.csv
python -m training.train_forecast                   # komparasi model → reports/model_comparison.md (+ models/forecast_model.joblib bila ML menang)
```
Restart service setelah training agar model baru termuat.

## 7. Sumber library, API & data

| Item | Fungsi | Sumber / lisensi |
|---|---|---|
| Data rekap Excel Coffee Service | Data primer (menu, HPP, harga, qty bulanan) | Diberikan UMKM saat wawancara 24 Okt 2026, dipakai terbatas untuk capstone |
| Transaksi harian dummy | Data latih sementara | Dibangkitkan dari Excel oleh `backend/prisma/seedData.js` (PRNG deterministik) |
| Gemini API (`gemini-2.5-flash`) | LLM untuk insight & asisten | Google AI Studio — https://ai.google.dev (free tier) |
| `google-genai` | SDK Gemini | https://github.com/googleapis/python-genai (Apache-2.0) |
| FastAPI, Uvicorn, Pydantic | REST API & validasi | https://fastapi.tiangolo.com (MIT) |
| pandas, NumPy | Preprocessing & fitur | https://pandas.pydata.org (BSD-3) |
| scikit-learn | Random Forest, GridSearchCV, TimeSeriesSplit, metrik | https://scikit-learn.org (BSD-3) |
| XGBoost | Gradient boosting regressor | https://xgboost.ai (Apache-2.0) |
| joblib | Menyimpan model | https://joblib.readthedocs.io (BSD-3) |
| pytest, httpx | Pengujian | https://pytest.org (MIT), https://www.python-httpx.org (BSD-3) |
