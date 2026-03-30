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

## Upload Gambar Dengan ImageKit

Backend upload ada di folder `server`.

1. Masuk ke folder `server`.
2. Salin `server/.env.example` menjadi `server/.env`.
3. Isi `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, dan `IMAGEKIT_URL_ENDPOINT` dari dashboard ImageKit.
4. Install dependency backend:

```bash
cd server
npm install
```

5. Jalankan backend upload:

```bash
npm run dev
```

Endpoint yang tersedia:

- `GET /` untuk cek server aktif
- `GET /uploads/health` untuk cek service upload
- `POST /uploads/report-image` untuk upload foto laporan
- `DELETE /uploads/report-image/:fileId` untuk hapus file dari ImageKit

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
