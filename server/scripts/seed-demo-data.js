require("dotenv").config();

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

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

const auth = getAuth();
const db = getFirestore();
const demoPassword = process.env.DEMO_DEFAULT_PASSWORD || "Demo123!";
const seededBy = "ufixed-demo";

const demoUsers = [
  {
    key: "pelapor",
    email: "pelapor@unklab.ac.id",
    name: "Pelapor Demo",
    role: "pelapor",
  },
  {
    key: "admin",
    email: "admin@unklab.ac.id",
    name: "Admin Demo",
    role: "admin",
  },
  {
    key: "department-it",
    email: "it@unklab.ac.id",
    name: "Department IT Demo",
    role: "department-it",
  },
  {
    key: "tukang",
    email: "tukang@unklab.ac.id",
    name: "Tukang Demo",
    role: "tukang",
  },
  {
    key: "business-office",
    email: "bo@unklab.ac.id",
    name: "Business Office Demo",
    role: "business-office",
  },
];

const makeDate = (minutesAgo) => new Date(Date.now() - minutesAgo * 60 * 1000);

async function clearCollection(name) {
  const snapshot = await db.collection(name).get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });
  await batch.commit();
}

async function upsertAuthUser(user) {
  try {
    const existing = await auth.getUserByEmail(user.email);
    await auth.updateUser(existing.uid, {
      displayName: user.name,
      password: demoPassword,
    });

    return existing.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await auth.createUser({
    email: user.email,
    password: demoPassword,
    displayName: user.name,
  });

  return created.uid;
}

async function seedDemoData() {
  console.log("Menyiapkan akun demo Firebase Auth...");
  const usersByKey = {};

  for (const user of demoUsers) {
    const uid = await upsertAuthUser(user);
    usersByKey[user.key] = { ...user, uid };
  }

  console.log("Mereset collection demo: users, notifications, laporan...");
  await clearCollection("users");
  await clearCollection("notifications");
  await clearCollection("laporan");

  console.log("Menulis ulang profil users/{uid}...");
  for (const user of Object.values(usersByKey)) {
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      seededBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const pelapor = usersByKey.pelapor;

  const reports = [
    {
      id: "demo-pending-it",
      data: {
        judul: "Proyektor ruang kelas mati",
        deskripsi:
          "Proyektor di ruang kelas A201 tidak menyala dan menampilkan indikator merah terus-menerus.",
        kategori: "IT",
        priority: "high",
        status: "menunggu",
        workflowStage: "admin_review",
        workflowState: "submitted",
        unitTarget: "department-it",
        authorUid: pelapor.uid,
        authorEmail: pelapor.email,
        author: pelapor.name,
        photos: [],
        seededBy,
        createdAt: makeDate(180),
        updatedAt: makeDate(180),
      },
    },
    {
      id: "demo-unit-review",
      data: {
        judul: "Wifi fakultas sering putus",
        deskripsi:
          "Koneksi wifi di gedung fakultas sering terputus selama beberapa menit lalu tersambung lagi.",
        kategori: "IT",
        priority: "medium",
        status: "diproses",
        workflowStage: "unit_review",
        workflowState: "admin_approved",
        unitTarget: "department-it",
        authorUid: pelapor.uid,
        authorEmail: pelapor.email,
        author: pelapor.name,
        photos: [],
        seededBy,
        createdAt: makeDate(150),
        approvedByAdminAt: makeDate(135),
        updatedAt: makeDate(135),
      },
    },
    {
      id: "demo-repairing-non-it",
      data: {
        judul: "Kursi auditorium rusak",
        deskripsi:
          "Salah satu kursi di auditorium patah pada bagian sandaran dan perlu segera diperbaiki.",
        kategori: "Non-IT",
        priority: "high",
        status: "diproses",
        workflowStage: "unit_repair",
        workflowState: "repairing",
        unitTarget: "tukang",
        authorUid: pelapor.uid,
        authorEmail: pelapor.email,
        author: pelapor.name,
        photos: [],
        seededBy,
        createdAt: makeDate(120),
        approvedByAdminAt: makeDate(110),
        approvedByUnitAt: makeDate(100),
        approvedByBusinessOfficeAt: makeDate(90),
        repairStartedAt: makeDate(80),
        updatedAt: makeDate(80),
      },
    },
    {
      id: "demo-completed-it",
      data: {
        judul: "Printer laboratorium tidak terdeteksi",
        deskripsi:
          "Printer laboratorium komputer tidak terbaca oleh beberapa komputer dan sudah membutuhkan pengecekan jaringan.",
        kategori: "IT",
        priority: "medium",
        status: "selesai",
        workflowStage: "done",
        workflowState: "completed",
        unitTarget: "department-it",
        authorUid: pelapor.uid,
        authorEmail: pelapor.email,
        author: pelapor.name,
        photos: [],
        seededBy,
        createdAt: makeDate(90),
        approvedByAdminAt: makeDate(82),
        approvedByUnitAt: makeDate(76),
        approvedByBusinessOfficeAt: makeDate(70),
        repairStartedAt: makeDate(62),
        completedAt: makeDate(48),
        updatedAt: makeDate(48),
      },
    },
    {
      id: "demo-rejected",
      data: {
        judul: "Lampu lorong gedung padam",
        deskripsi:
          "Lampu lorong gedung utama padam total dan membuat area menjadi gelap pada malam hari.",
        kategori: "Non-IT",
        priority: "critical",
        status: "ditolak",
        workflowStage: "rejected",
        workflowState: "rejected",
        unitTarget: "tukang",
        authorUid: pelapor.uid,
        authorEmail: pelapor.email,
        author: pelapor.name,
        photos: [],
        rejectionReason: "Lokasi belum disebutkan secara lengkap. Mohon kirim ulang dengan detail titik lampu.",
        rejectedByRole: "admin",
        seededBy,
        createdAt: makeDate(60),
        updatedAt: makeDate(54),
      },
    },
  ];

  console.log("Menulis laporan demo...");
  for (const report of reports) {
    await db.collection("laporan").doc(report.id).set(report.data);
  }

  console.log("Menulis notifikasi demo...");
  await db.collection("notifications").doc("demo-notif-approved").set({
    userUid: pelapor.uid,
    reportId: "demo-completed-it",
    title: "Laporan Selesai",
    description:
      "Laporan 'Printer laboratorium tidak terdeteksi' telah selesai diperbaiki.",
    status: "selesai",
    seededBy,
    createdAt: makeDate(48),
    updatedAt: makeDate(48),
  });

  await db.collection("notifications").doc("demo-notif-rejected").set({
    userUid: pelapor.uid,
    reportId: "demo-rejected",
    title: "Laporan Ditolak",
    description:
      "Laporan 'Lampu lorong gedung padam' ditolak oleh Admin. Lokasi belum disebutkan secara lengkap. Mohon kirim ulang dengan detail titik lampu.",
    status: "ditolak",
    seededBy,
    createdAt: makeDate(54),
    updatedAt: makeDate(54),
  });

  console.log("Seed demo selesai.");
  console.log(`Password default semua akun demo: ${demoPassword}`);
  for (const user of Object.values(usersByKey)) {
    console.log(`${user.role}: ${user.email} (${user.uid})`);
  }
}

seedDemoData().catch((error) => {
  console.error("Seed demo gagal:", error);
  process.exitCode = 1;
});
