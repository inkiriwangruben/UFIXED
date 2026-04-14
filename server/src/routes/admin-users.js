const express = require("express");

const { getFirebaseAdminServices } = require("../firebase-admin");

const router = express.Router();

const MANAGEABLE_ROLES = new Set([
  "pelapor",
  "department-it",
  "tukang",
  "business-office",
]);
const NAME_REGEX = /^[\p{L}\s]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value = "") =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";

const getDefaultNameFromEmail = (email) => email.split("@")[0] || "User";

const getPasswordValidationError = (value) => {
  if (typeof value !== "string" || value.length < 8) {
    return "Password minimal 8 karakter.";
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return "Password harus mengandung huruf besar, huruf kecil, dan angka.";
  }

  return "";
};

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Token admin tidak ditemukan.",
    });
  }

  try {
    const { auth, db } = getFirebaseAdminServices();
    const decodedToken = await auth.verifyIdToken(token);
    const profileSnapshot = await db.collection("users").doc(decodedToken.uid).get();

    if (!profileSnapshot.exists || profileSnapshot.data()?.role !== "admin") {
      return res.status(403).json({
        message: "Akses ditolak. Hanya admin yang dapat mengelola akun.",
      });
    }

    req.adminUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
    };

    return next();
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : "";
    const message =
      code === "auth/id-token-expired" || code === "auth/argument-error"
        ? "Sesi admin tidak valid. Silakan login ulang."
        : error instanceof Error
          ? error.message
          : "Gagal memverifikasi sesi admin.";

    return res.status(401).json({
      message,
    });
  }
}

router.post("/users", requireAdmin, async (req, res) => {
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const requestedName =
    typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!MANAGEABLE_ROLES.has(role)) {
    return res.status(400).json({
      message: "Role pengguna tidak valid untuk dibuat dari halaman admin.",
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      message: "Format email tidak valid.",
    });
  }

  const passwordError = getPasswordValidationError(password);

  if (passwordError) {
    return res.status(400).json({
      message: passwordError,
    });
  }

  if (role === "pelapor") {
    if (!requestedName) {
      return res.status(400).json({
        message: "Nama pelapor wajib diisi.",
      });
    }

    if (!NAME_REGEX.test(requestedName)) {
      return res.status(400).json({
        message: "Nama hanya boleh berisi huruf dan spasi.",
      });
    }
  }

  const name =
    role === "pelapor" ? requestedName : getDefaultNameFromEmail(email);

  let createdUser = null;

  try {
    const { auth, db, FieldValue } = getFirebaseAdminServices();

    try {
      await auth.getUserByEmail(email);
      return res.status(409).json({
        message: "Email sudah terdaftar di sistem.",
      });
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    createdUser = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    await db.collection("users").doc(createdUser.uid).set({
      uid: createdUser.uid,
      email,
      name,
      role,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: req.adminUser.uid,
    });

    return res.status(201).json({
      message: "Pengguna berhasil dibuat.",
      user: {
        uid: createdUser.uid,
        email,
        name,
        role,
      },
    });
  } catch (error) {
    if (createdUser?.uid) {
      try {
        const { auth } = getFirebaseAdminServices();
        await auth.deleteUser(createdUser.uid);
      } catch (rollbackError) {
        console.error("Gagal rollback akun Auth setelah create user gagal:", rollbackError);
      }
    }

    const code = error && typeof error === "object" ? error.code : "";
    let message = "Gagal membuat pengguna.";

    if (code === "auth/email-already-exists") {
      message = "Email sudah digunakan oleh akun lain.";
    } else if (code === "auth/invalid-password") {
      message = "Password tidak memenuhi kebijakan keamanan.";
    } else if (code === "auth/invalid-email") {
      message = "Format email tidak valid.";
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }

    return res.status(400).json({
      message,
    });
  }
});

router.delete("/users/:uid", requireAdmin, async (req, res) => {
  const uid = typeof req.params?.uid === "string" ? req.params.uid.trim() : "";

  if (!uid) {
    return res.status(400).json({
      message: "UID pengguna wajib diisi.",
    });
  }

  if (uid === req.adminUser.uid) {
    return res.status(400).json({
      message: "Akun admin aktif tidak dapat dihapus dari halaman ini.",
    });
  }

  try {
    const { auth, db } = getFirebaseAdminServices();
    const profileSnapshot = await db.collection("users").doc(uid).get();
    const profileData = profileSnapshot.exists ? profileSnapshot.data() : null;

    if (profileData?.role === "admin") {
      return res.status(400).json({
        message: "Akun admin tidak bisa dihapus dari halaman ini.",
      });
    }

    let authUserExists = true;

    try {
      await auth.getUser(uid);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "auth/user-not-found") {
        authUserExists = false;
      } else {
        throw error;
      }
    }

    if (!profileSnapshot.exists && !authUserExists) {
      return res.status(404).json({
        message: "Pengguna tidak ditemukan.",
      });
    }

    if (authUserExists) {
      await auth.deleteUser(uid);
    }

    if (profileSnapshot.exists) {
      await db.collection("users").doc(uid).delete();
    }

    return res.status(200).json({
      message: "Pengguna berhasil dihapus.",
    });
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : "";
    let message = "Gagal menghapus pengguna.";

    if (code === "auth/user-not-found") {
      message = "Pengguna tidak ditemukan.";
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }

    return res.status(400).json({
      message,
    });
  }
});

module.exports = router;
