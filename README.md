# ☕ Coffee Service — Dashboard Rekapan Kasir Otomatis & Realtime

Capstone **Asah 2026 · Tim A26-CS276** untuk UMKM **Coffee Service** (Banda Aceh).

**Masalah:** rekap kasir harian dikerjakan manual di Google Spreadsheet, tidak tersimpan otomatis, sering harus diulang, dan pemilik tidak bisa memantaunya secara realtime.
**Solusi:** web app untuk kasir dan pemilik, dengan fitur:
- Setiap transaksi **tersimpan otomatis (autosave)** ke database online.
- **Rekap harian, 5 harian, mingguan, dan bulanan** terbentuk sendiri.
- **Export ke Excel/CSV** dengan rentang tanggal bebas, siap dibuka di Google Sheets.
- **Insight AI** dan **prediksi penjualan**.

## Arsitektur

```
[ Frontend React (Vite) ] --axios /api/v1--> [ Backend Express + Socket.IO ] --Prisma--> [ Supabase Postgres ]
          ▲   websocket "data:changed"                  │
          └─────────────────────────────────────────────┘
                                                        └--HTTP--> [ AI Service FastAPI ] --> Gemini API
```

| Folder | Isi |
|---|---|
| `frontend/` | React 19 + Vite, Tailwind CSS 4, Axios, TanStack Query, Recharts, Socket.IO client |
| `backend/` | Express (`/api/v1`), Joi (validasi), Prisma ORM (Postgres/Supabase), JWT, Socket.IO, ExcelJS |
| `ai-service/` | FastAPI: `/predict-sales`, `/generate-insight`, `/chat` (Swagger di `/docs`) + pipeline training ML. **Detail model, preprocessing, perbandingan model & uji guardrail: [`ai-service/README.md`](ai-service/README.md)** |

Layanan Gen AI **hanya dipanggil dari backend**, tidak langsung dari frontend.

## Fitur

| Fitur | Pengguna | Keterangan |
|---|---|---|
| **Penjualan (kasir)** | Kasir, Pemilik | Ketuk menu → atur qty → pilih Tunai/QRIS/Transfer → Simpan. Ada hitung kembalian. |
| **Autosave + antrean offline** | Kasir | Isi keranjang tersimpan di perangkat. Saat internet putus, transaksi masuk antrean lalu terkirim otomatis begitu online lagi. Pengiriman ulang dibuat idempoten lewat `clientId`, jadi tidak tercatat dobel. |
| **Pemasukan & Pengeluaran** | Kasir, Pemilik | Catat bahan baku, gaji, token listrik, PDAM, sewa, modal, dan lain-lain. |
| **Rekap Harian** | Kasir, Pemilik | Ringkasan pemasukan − pengeluaran = saldo. Tabel per menu dengan format sama seperti Excel UMKM (Qty, HPP, Harga Jual, Pendapatan Kotor). Bisa dicetak. |
| **Rekap Periode** | Pemilik | Tab **Harian / 5 Hari (1–5, 6–10, …) / Mingguan (Sen–Min) / Bulanan**. Klik satu baris untuk melihat rinciannya. |
| **Dashboard realtime** | Pemilik | KPI dengan perbandingan vs periode sebelumnya, grafik pemasukan vs pengeluaran, menu terlaris, pengeluaran per kategori. Data ter-update tanpa refresh. |
| **Export** | Pemilik | Rentang tanggal bebas. Format `.xlsx` (multi-sheet: Ringkasan, Rekap Harian, 5 Harian, Mingguan, Bulanan, Per Menu, Detail Transaksi, Kas) atau `.csv`. |
| **Riwayat & Pembatalan** | Pemilik (kasir: transaksi miliknya, hari yang sama) | Transaksi tidak dihapus permanen. Status diubah menjadi *Dibatalkan* dengan alasan (jejak audit). |
| **Menu & Harga (HPP)** | Pemilik | Snapshot harga disimpan per transaksi, jadi perubahan harga tidak mengubah laporan lama. |
| **Insight AI & Prediksi 7 hari** | Pemilik | Gemini dengan fallback template bila kuota habis atau API key kosong. |
| **Asisten AI** | Pemilik | Intent classifier dengan 5 intent dan guardrail untuk pertanyaan di luar konteks. Riwayat chat tersimpan di DB. |

### Rumus keuangan
- **Total pemasukan** = penjualan menu + pemasukan lain
- **Saldo bersih** = total pemasukan − total pengeluaran
- **Laba kotor** = penjualan − HPP (mengikuti kolom Excel UMKM)

Validasi dilakukan dengan tes otomatis: data dummy Agustus–Oktober menghasilkan angka yang **sama persis** dengan file `PERHITUNGAN PENDAPTAN CEES-1.xlsx`. Contohnya Agustus: omzet Rp7.227.000, HPP Rp2.647.388, pendapatan bersih Rp2.816.279.

---

## Menjalankan secara lokal

Kebutuhan: Node.js ≥ 20, Python ≥ 3.10, dan akun [Supabase](https://supabase.com) (gratis).

### 1. Database (Supabase)
1. Buat project di Supabase.
2. Klik tombol **Connect → tab ORM** dan salin alamat pooler. Isi **keduanya** dengan **session pooler port 5432**:
   - `DATABASE_URL` = `...pooler.supabase.com:5432/postgres?connection_limit=5`
   - `DIRECT_URL` = `...pooler.supabase.com:5432/postgres`
   - Ganti `[YOUR-PASSWORD]` **beserta kurung sikunya** dengan password database.
   - Kenapa bukan port 6543? Hasil uji: transaction pooler ±600 ms/query, session pooler ±100 ms/query. Backend ini server yang terus menyala, jadi session mode lebih cocok.

### 2. Backend
```bash
cd backend
cp .env.example .env          # isi DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install
npx prisma migrate deploy     # buat tabel (atau: npx prisma migrate dev --name init)
npm run db:seed               # akun demo + 18 menu + data dummy Agu–Nov 2026
npm run dev                   # http://localhost:4000
```
Untuk pemakaian nyata tanpa data dummy, jalankan `npm run db:seed -- --no-transactions`.

### 3. AI service
```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate        # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env          # isi GEMINI_API_KEY (opsional)
uvicorn app.main:app --reload --port 8000    # Swagger: http://localhost:8000/docs
```

### 4. Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

**Akun demo:** `owner / owner123` (pemilik), `kasir / kasir123` (kasir). **Segera ganti password** lewat menu Pengguna sebelum dipakai sungguhan.

### Testing
```bash
cd backend && npm test          # logika rekap + validasi API (tanpa DB)
cd backend && npm run test:db   # integrasi dengan DB (pakai .env; data uji berprefix "test-" dibersihkan otomatis)
cd ai-service && .venv\Scripts\python -m pytest -q
```

---

## Panduan singkat untuk UMKM

**Kasir — setiap ada pesanan**
1. Buka **Penjualan**, lalu ketuk menu yang dipesan. Ketuk lagi untuk menambah jumlah, atau pakai tombol + / −.
2. Pilih **Tunai / QRIS / Transfer**. Untuk tunai, isi uang diterima agar kembalian dihitung otomatis.
3. Tekan **Simpan Transaksi**. Selesai — data langsung tersimpan dan masuk rekap.
   - Jika muncul *"x data belum terkirim"* di pojok atas, internet sedang putus. Data **aman** di perangkat dan akan terkirim sendiri. Jangan input ulang.
4. Salah input? Tekan ikon 🚫 pada transaksi hari ini, lalu tulis alasannya.

**Kasir — saat ada uang keluar/masuk di luar penjualan**
- Buka **Kas** → pilih *Pengeluaran* atau *Pemasukan lain* → pilih kategori → isi nominal → **Simpan**.

**Pemilik**
- **Dashboard**: pantau pemasukan, pengeluaran, dan saldo secara realtime dari mana saja, termasuk dari HP.
- **Rekap Periode**: pilih tab *5 Hari*, *Mingguan*, atau *Bulanan*. Klik satu baris untuk melihat rinciannya.
- **Export**: pilih tanggal → pilih format → **Download**. Buka di Google Sheets lewat **File → Impor → Upload**.
- **Menu & Harga**: tambah menu baru atau ubah harga/HPP.

---

## Kontrak API (ringkas)

Semua endpoint diawali `/api/v1` dan memakai header `Authorization: Bearer <token>`, kecuali login.
- Respons sukses: `{ "status": "success", "data": … }`
- Respons gagal: `{ "status": "fail", "message": "…", "errors": { field: pesan } }`
- Kode status: 401 (belum login), 403 (bukan haknya), 404, 409, 422 (data tidak valid), 503 (DB tidak terhubung)

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/auth/login` | publik | `{username, password}` → `{token, user}` |
| GET | `/auth/me` | login | profil |
| PATCH | `/auth/password` | login | ganti password |
| GET | `/products?includeInactive=` | login | daftar menu |
| POST/PUT/DELETE | `/products[/:id]` | owner | kelola menu (DELETE = nonaktifkan) |
| POST | `/transactions` | login | `{clientId, items:[{productId, qty}], paymentMethod, note?, occurredAt?}` — idempoten |
| GET | `/transactions?from&to&q&status&page&pageSize` | login | riwayat |
| PATCH | `/transactions/:id/void` | owner / kasir pemilik transaksi (hari sama) | `{reason}` |
| GET | `/cash-entries?from&to&type` · `/cash-entries/categories` | login | catatan kas |
| POST/PUT/DELETE | `/cash-entries[/:id]` | login (kasir: miliknya, hari sama) | `{type, category, amount, description?}` |
| GET | `/reports/daily?date=` | login | rekap 1 hari |
| GET | `/reports/summary?from&to&groupBy=day\|5day\|week\|month` | owner | KPI, bucket, menu, kategori |
| GET | `/exports/preview?from&to` · `/exports?from&to&format=xlsx\|csv&include=harian,periode,produk,transaksi,kas&groupBy=` | owner | export |
| POST | `/ai/insight` `{from,to}` · `/ai/forecast` `{horizon}` · `/ai/chat` `{message}` | owner | proxy ke AI service |
| GET | `/ai/history?type=chat` | owner | riwayat AI |
| GET/POST/PATCH | `/users[/:id]` | owner | kelola akun |

Realtime: client Socket.IO terhubung ke URL backend dengan `auth: { token }`. Server mengirim event `data:changed` `{kind, date}` setiap kali ada transaksi, kas, atau menu yang berubah.

### AI service (FastAPI)

| Endpoint | Request | Response |
|---|---|---|
| `POST /predict-sales` | `{history:[{date,sales,cups,transactions}], horizon}` | `{predictions:[{date,sales,cups}], summary, model_name, metrics, is_fallback}` |
| `POST /generate-insight` | ringkasan periode (totals, change_pct, top_products, …) | `{insight, recommendations[], model, is_fallback}` |
| `POST /chat` | `{message, context}` | `{intent, confidence, reply, escalate, model, is_fallback}` |

**Mengganti model (tim AI/DS):**
- **Forecasting:** buat `ai-service/models/custom_forecaster.py` berisi fungsi `predict(history, horizon)`, plus `MODEL_NAME` dan `METRICS` (misalnya hasil komparasi XGBoost vs Random Forest dengan MAE/RMSE/R²). File ini otomatis dipakai. Jika error, service kembali ke baseline.
- **Intent:** ganti fungsi `classify()` di `app/intent.py` dengan model terlatih. Kembalikan `(intent, confidence)` dengan salah satu intent: `tanya_penjualan`, `tanya_produk`, `minta_saran`, `keluhan`, `di_luar_konteks`.

**Guardrail chatbot:** `ai-service/tests/test_api.py` menguji 10 pertanyaan di luar konteks (politik, cuaca, coding, bola, film, zodiak, bitcoin, terjemahan, puisi, geografi). Kesepuluhnya ditolak dengan sopan. ✅

---

## Deploy (free tier)

| Bagian | Layanan | Catatan |
|---|---|---|
| Database | Supabase | sudah online |
| Backend | Render (Web Service, Node) | Build: `npm install && npx prisma migrate deploy` · Start: `npm start`. Env: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN=<url frontend>`, `AI_SERVICE_URL=<url ai-service>`, `NODE_ENV=production` |
| AI service | Render (Web Service, Python) | Build: `pip install -r requirements.txt` · Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Env: `GEMINI_API_KEY`, `CORS_ORIGIN=<url backend>` |
| Frontend | Vercel / Netlify | Root `frontend`, build `npm run build`, output `dist`. Env `VITE_API_URL=<url backend>`. Tambahkan rewrite SPA (semua path → `/index.html`) |

> Render free tier "tidur" setelah 15 menit tanpa trafik, jadi request pertama bisa lambat ±30 detik. Antrean offline di frontend memastikan transaksi tidak hilang selama itu.

## Data & sumber
- Menu, HPP, harga jual, qty bulanan, dan biaya operasional berasal dari file UMKM `PERHITUNGAN PENDAPTAN CEES-1.xlsx` (data primer, tanpa identitas pelanggan).
- **Transaksi harian pada seed adalah DATA DUMMY.** Data ini dibangkitkan dengan membagi qty bulanan Excel ke hari-hari dalam bulan itu (generator deterministik di `backend/prisma/seedData.js`). Setiap transaksi diberi catatan *"Data dummy"*. Keterbatasannya: jam dan komposisi per transaksi adalah simulasi, tetapi total bulanan sama dengan Excel.
- Tahun data diasumsikan 2026. Data November parsial dan disebar ke tanggal 1–12.
- Library: Express, Prisma, Joi, Socket.IO, ExcelJS, React, Vite, Tailwind CSS, TanStack Query, Recharts, lucide-react, FastAPI, google-genai.
