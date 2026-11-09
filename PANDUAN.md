# PANDUAN ARDZ STORE (dari HP Android)

Semua langkah bisa dilakukan lewat Chrome di HP. Tidak perlu komputer.

## Isi proyek

```
ardz-store/
├── index.html      → situs publik
├── style.css       → tampilan (publik + admin)
├── app.js          → logika situs publik
├── admin.html      → halaman admin (alamat: /admin)
├── admin.js        → logika dashboard admin
├── package.json    → daftar paket (Neon + bcryptjs)
├── vercel.json     → konfigurasi Vercel
├── schema.sql      → skema database (opsional, dibuat otomatis)
├── .vercelignore
└── api/
    ├── _schema.js  → skema tabel (dibuat otomatis)
    ├── _lib.js     → fungsi bersama (DB, session, validasi)
    ├── auth.js     → login / logout / buat admin pertama
    ├── public.js   → data publik (katalog, jasa, pengaturan)
    ├── order.js    → pemesanan (anti dobel-beli)
    ├── img.js      → menampilkan foto dari database
    └── admin.js    → semua API admin (dilindungi login)
```

## LANGKAH 1 — Buat database Neon

1. Buka https://neon.tech lalu daftar (bisa pakai Google).
2. Buat Project baru (nama bebas, mis. `ardz-store`).
3. Di halaman project, tekan **Connect** → salin **Connection string** (diawali `postgresql://...`).
   Simpan, nanti ditempel di Vercel sebagai `DATABASE_URL`.

Tabel dibuat otomatis saat situs pertama dibuka. Tidak perlu menjalankan SQL.

## LANGKAH 2 — Upload file ke GitHub

1. Buka https://github.com → daftar / login. Aktifkan **Situs desktop** di menu ⋮ Chrome agar lebih mudah.
2. Tekan **+ → New repository**, nama `ardz-store`, pilih **Private**, tekan **Create repository**.
3. Upload file root: tekan **uploading an existing file**, pilih SEMUA file ini sekaligus
   (`index.html, style.css, app.js, admin.html, admin.js, package.json, vercel.json, schema.sql, .vercelignore`)
   → **Commit changes**.
4. Buat folder `api`: tekan **Add file → Create new file**, di kolom nama ketik `api/img.js`,
   tempel isi file `img.js`, lalu **Commit**. Folder `api` sekarang ada.
5. Buka folder `api` → **Add file → Upload files** → pilih 6 file lainnya
   (`_schema.js, _lib.js, auth.js, public.js, order.js, admin.js`) → **Commit changes**.

> Catatan: file yang diawali titik (`.vercelignore`) bisa tersembunyi di file picker HP.
> Jika sulit, lewati saja — situs tetap jalan.

## LANGKAH 3 — Deploy di Vercel

1. Buka https://vercel.com → login dengan GitHub.
2. **Add New → Project** → pilih repo `ardz-store` → **Import**.
3. Buka **Environment Variables** dan isi 3 variabel:

| Nama | Isi |
|---|---|
| `DATABASE_URL` | connection string dari Neon |
| `SESSION_SECRET` | ketik acak minimal 40 huruf & angka (rahasia, jangan dibagikan) |
| `SETUP_KEY` | kata sandi sementara untuk membuat admin pertama (mis. 16 karakter acak) |

4. Tekan **Deploy**. Tunggu sampai selesai, lalu buka alamat `.vercel.app` yang diberikan.

## LANGKAH 4 — Buat admin & isi toko

1. Buka `alamat-situsmu.vercel.app/admin`.
2. Karena belum ada admin, muncul form **SETUP ADMIN**: isi `SETUP_KEY`, username, dan password (min. 10 karakter).
3. Masuk ke tab **Pengaturan** → upload **logo ARDZ STORE** dan **banner**, cek nomor WhatsApp (`6285199264394`) → Simpan.
4. Tab **Akun** → **Tambah Akun** untuk stok. Tab **Jasa Posting** → **Tambah Jasa** untuk paket.
5. (Disarankan) Setelah admin dibuat, hapus `SETUP_KEY` di Vercel → Settings → Environment Variables, lalu Redeploy.

## Cara kerja stok

- **Beli via WhatsApp** ditekan pembeli → server mengunci akun itu (status *DIPESAN*) selama 15 menit
  dalam satu operasi atomik, jadi dua pembeli tidak bisa memesan stok yang sama. Pembeli kedua mendapat
  pesan "sudah dipesan".
- Admin tekan **SOLD** → akun hilang dari katalog publik, tetap tersimpan sebagai riwayat (filter **SOLD** di admin).
- **Aktifkan** → akun tampil lagi. **Hapus** → hilang permanen.
- Di tab **Pesanan**, ubah status ke *DONE* → akun otomatis SOLD; ubah ke *CANCELLED* → akun dibuka lagi.
- Reservasi yang tidak dikonfirmasi otomatis lepas setelah 15 menit (ubah lewat env `RESERVE_MINUTES`, opsional).

## Memperbarui file nanti

Di GitHub buka file → ikon pensil ✏️ → ubah → **Commit**. Vercel otomatis deploy ulang.

## Troubleshooting

- **"Terjadi kesalahan pada server"**: cek Vercel → Project → **Logs**. Biasanya `DATABASE_URL` / `SESSION_SECRET` belum diisi
  (setelah mengisi, lakukan **Redeploy**).
- **Admin tidak bisa login terus**: terlalu banyak salah → tunggu 15 menit.
- **Foto gagal upload**: foto dikecilkan otomatis di HP; pastikan formatnya JPG/PNG/WEBP.
