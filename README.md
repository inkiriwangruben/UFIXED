# UFIXED - Aplikasi Pelaporan Kerusakan Barang

UFIXED adalah aplikasi React Native berbasis Expo untuk pelaporan kerusakan barang atau fasilitas secara digital dan terstruktur.

## Setup Firestore

1. Salin `.env.example` menjadi `.env`.
2. Isi seluruh nilai `EXPO_PUBLIC_FIREBASE_*` memakai kredensial dari Firebase Console.
3. Pastikan Firestore Database pada project Firebase Anda sudah aktif.
4. Jalankan aplikasi dengan `npm start` atau `npx expo start`.

Form laporan di aplikasi sekarang menyimpan data ke koleksi `laporan` di Firestore saat tombol kirim ditekan.

## Firestore Rules

File rules ada di `firestore.rules`. Untuk deploy ke project Firebase:

```bash
npx firebase-tools deploy --only firestore:rules
```

## Upload Gambar Dengan Supabase Storage

Backend upload ada di folder `server`.

1. Masuk ke folder `server`.
2. Salin `server/.env.example` menjadi `server/.env`.
3. Siapkan project Supabase dan buka menu `Storage`.
4. Isi `SUPABASE_URL` dengan project URL dari Supabase.
5. Isi `SUPABASE_SECRET_KEY` dengan secret key server-side. Jika belum punya, Anda bisa pakai legacy `SUPABASE_SERVICE_ROLE_KEY` hanya di backend.
6. Isi `SUPABASE_STORAGE_BUCKET` dengan nama bucket file, misalnya `laporan`.
7. Server akan mencoba membuat bucket publik otomatis saat pengecekan pertama atau upload pertama jika bucket belum ada.
   `FIREBASE_SERVICE_ACCOUNT_PATH` hanya diperlukan bila Anda masih memakai endpoint admin user atau script migrasi Firebase.
8. Install dependency backend:

```bash
cd server
npm install
```

9. Jalankan backend upload:

```bash
npm run dev
```

Untuk cek koneksi bucket Supabase Storage:

```bash
npm run storage:check
```

Endpoint yang tersedia:

- `GET /` untuk cek server aktif
- `GET /uploads/health` untuk cek service upload
- `POST /uploads/report-image` untuk upload foto laporan
- `DELETE /uploads/report-image/:fileId` untuk hapus file dari Supabase Storage

## Migrasi `laporan` ke `reports`

Jika ingin membuat collection `reports` dengan isi yang sama seperti `laporan`:

1. Tambahkan `FIREBASE_SERVICE_ACCOUNT_PATH` di `server/.env`.
2. Arahkan ke file service account JSON dari Firebase Console.
3. Jalankan:

```bash
cd server
npm install
npm run migrate:reports
```

Script migrasi akan menyalin semua dokumen dari `laporan` ke `reports` dengan ID dokumen yang sama, tanpa menghapus collection lama.
