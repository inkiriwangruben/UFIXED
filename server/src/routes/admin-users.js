const express = require("express");

const {
  EMAIL_REGEX,
  getEmailValidationMessageForRole,
  isEmailAllowedForRole,
  normalizeEmail,
} = require("../auth-policy");
const { getFirebaseAdminServices } = require("../firebase-admin");

const router = express.Router();
const PELAPOR_ACCESS_COLLECTION = "pelapor_access";

const MANAGEABLE_ROLES = new Set([
  "pelapor",
  "department-it",
  "tukang",
  "business-office",
]);
const NAME_REGEX = /^[\p{L}\s]+$/u;
const MAX_PELAPOR_NAME_LETTERS = 8;

const getPelaporNameLetterCount = (value = "") =>
  Array.from(value).filter((character) => /\p{L}/u.test(character)).length;

const getDefaultNameFromEmail = (email) => email.split("@")[0] || "User";

const getPelaporAccessRef = (db, email) =>
  db.collection(PELAPOR_ACCESS_COLLECTION).doc(normalizeEmail(email));

const findUserProfileByEmail = async (db, email) => {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
};

const getPasswordValidationError = (value) => {
  if (typeof value !== "string" || value.length < 8) {
    return "Password role internal minimal 8 karakter.";
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return "Password role internal harus mengandung huruf besar, huruf kecil, dan angka.";
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
    typeof req.body?.password === "string" ? req.body.password.trim() : "";
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

  if (!isEmailAllowedForRole(email, role)) {
    return res.status(400).json({
      message: getEmailValidationMessageForRole(role),
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

    if (getPelaporNameLetterCount(requestedName) > MAX_PELAPOR_NAME_LETTERS) {
      return res.status(400).json({
        message: `Nama pelapor maksimal ${MAX_PELAPOR_NAME_LETTERS} huruf.`,
      });
    }
  } else {
    const passwordError = getPasswordValidationError(password);

    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
      });
    }
  }

  const name =
    role === "pelapor" ? requestedName : getDefaultNameFromEmail(email);

  let createdUser = null;

  try {
    const { auth, db, FieldValue } = getFirebaseAdminServices();
    const existingProfileDoc = await findUserProfileByEmail(db, email);
    const pelaporAccessSnapshot = await getPelaporAccessRef(db, email).get();

    if (role !== "pelapor" && pelaporAccessSnapshot.exists) {
      return res.status(409).json({
        message: "Email sudah dipakai oleh akun pelapor Google.",
      });
    }

    if (
      existingProfileDoc &&
      existingProfileDoc.data()?.role !== role &&
      !(role === "pelapor" && existingProfileDoc.data()?.role === "pelapor")
    ) {
      return res.status(409).json({
        message: "Email sudah digunakan oleh role lain.",
      });
    }

    if (role === "pelapor") {
      if (pelaporAccessSnapshot.exists) {
        return res.status(409).json({
          message: "Email pelapor sudah terdaftar untuk login Google.",
        });
      }

      let linkedUid = "";

      try {
        const existingAuthUser = await auth.getUserByEmail(email);
        linkedUid = existingAuthUser.uid;
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "auth/user-not-found") {
          throw error;
        }
      }

      if (existingProfileDoc?.exists) {
        linkedUid = existingProfileDoc.id;
      }

      await getPelaporAccessRef(db, email).set({
        email,
        name,
        role,
        authProvider: "google",
        linkedUid: linkedUid || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdByUid: req.adminUser.uid,
      });

      return res.status(201).json({
        message: "Pelapor berhasil ditambahkan untuk login Google.",
        user: {
          uid: linkedUid || email,
          email,
          name,
          role,
          authProvider: "google",
        },
      });
    }

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
  const uid =
    typeof req.params?.uid === "string"
      ? decodeURIComponent(req.params.uid).trim()
      : "";
  const bodyRole =
    typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const bodyEmail = normalizeEmail(req.body?.email);

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
    const shouldDeletePelaporByEmail =
      bodyRole === "pelapor" || EMAIL_REGEX.test(bodyEmail);
    const emailCandidate = normalizeEmail(bodyEmail || uid);

    if (shouldDeletePelaporByEmail && EMAIL_REGEX.test(emailCandidate)) {
      const email = emailCandidate;
      const pelaporAccessRef = getPelaporAccessRef(db, email);
      const pelaporAccessSnapshot = await pelaporAccessRef.get();

      if (!pelaporAccessSnapshot.exists) {
        if (bodyRole === "pelapor") {
          const profileDoc = await findUserProfileByEmail(db, email);
          if (profileDoc?.exists && profileDoc.data()?.role === "pelapor") {
            try {
              await auth.deleteUser(profileDoc.id);
            } catch (error) {
              if (
                !error ||
                typeof error !== "object" ||
                error.code !== "auth/user-not-found"
              ) {
                throw error;
              }
            }

            await db.collection("users").doc(profileDoc.id).delete();

            return res.status(200).json({
              message: "Pelapor berhasil dihapus.",
            });
          }
        }

        return res.status(404).json({
          message: "Pelapor Google tidak ditemukan.",
        });
      }

      let authUser = null;

      try {
        authUser = await auth.getUserByEmail(email);
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "auth/user-not-found") {
          throw error;
        }
      }

      const linkedUid =
        typeof pelaporAccessSnapshot.data()?.linkedUid === "string"
          ? pelaporAccessSnapshot.data().linkedUid.trim()
          : "";
      const candidateUid = authUser?.uid || linkedUid;
      let profileSnapshot = null;

      if (candidateUid) {
        profileSnapshot = await db.collection("users").doc(candidateUid).get();

        if (profileSnapshot.exists && profileSnapshot.data()?.role !== "pelapor") {
          return res.status(409).json({
            message: "Email ini sedang dipakai oleh role internal dan tidak bisa dihapus sebagai pelapor.",
          });
        }

        if (profileSnapshot.exists && profileSnapshot.data()?.role === "pelapor") {
          await db.collection("users").doc(candidateUid).delete();
        }
      }

      if (authUser) {
        await auth.deleteUser(authUser.uid);
      }

      await pelaporAccessRef.delete();

      return res.status(200).json({
        message: "Pelapor Google berhasil dihapus.",
      });
    }

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
