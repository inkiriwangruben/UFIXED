require("dotenv").config();

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_PATH belum diisi di server/.env. Isi dengan path file service account JSON Firebase.",
  );
}

// eslint-disable-next-line import/no-dynamic-require, global-require
const serviceAccount = require(serviceAccountPath);

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function migrateLaporanToReports() {
  console.log("Membaca data dari collection 'laporan'...");
  const snapshot = await db.collection("laporan").get();

  if (snapshot.empty) {
    console.log("Collection 'laporan' kosong. Tidak ada data untuk disalin.");
    return;
  }

  let migratedCount = 0;

  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();

    await db.collection("reports").doc(documentSnapshot.id).set(data, {
      merge: true,
    });

    migratedCount += 1;
    console.log(`Berhasil salin dokumen: ${documentSnapshot.id}`);
  }

  console.log(`Migrasi selesai. Total dokumen tersalin: ${migratedCount}`);
}

migrateLaporanToReports().catch((error) => {
  console.error("Migrasi gagal:", error);
  process.exitCode = 1;
});
