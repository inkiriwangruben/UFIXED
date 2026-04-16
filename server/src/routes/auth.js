const express = require("express");

const {
  EMAIL_REGEX,
  isEmailAllowedForRole,
  normalizeEmail,
} = require("../auth-policy");
const { getFirebaseAdminServices } = require("../firebase-admin");

const router = express.Router();
const PELAPOR_ACCESS_COLLECTION = "pelapor_access";

const requireAuthenticatedUser = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Token autentikasi tidak ditemukan.",
    });
  }

  try {
    const { auth } = getFirebaseAdminServices();
    req.authUser = await auth.verifyIdToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({
      message:
        error instanceof Error
          ? error.message
          : "Token autentikasi tidak valid.",
    });
  }
};

router.post("/pelapor/google-sync", requireAuthenticatedUser, async (req, res) => {
  const { authUser } = req;
  const email = normalizeEmail(authUser?.email);
  const signInProvider =
    authUser &&
    typeof authUser === "object" &&
    authUser.firebase &&
    typeof authUser.firebase === "object"
      ? authUser.firebase.sign_in_provider
      : "";

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      message: "Email akun Google tidak valid.",
    });
  }

  if (!authUser?.email_verified) {
    return res.status(403).json({
      message: "Email Google Anda belum terverifikasi.",
    });
  }

  if (signInProvider !== "google.com") {
    return res.status(403).json({
      message: "Login ini bukan berasal dari Google Sign-In.",
    });
  }

  if (!isEmailAllowedForRole(email, "pelapor")) {
    return res.status(403).json({
      message:
        "Email pelapor harus memakai domain @student.unklab.ac.id atau @unklab.ac.id.",
    });
  }

  try {
    const { db, FieldValue } = getFirebaseAdminServices();
    const accessRef = db.collection(PELAPOR_ACCESS_COLLECTION).doc(email);
    const accessSnapshot = await accessRef.get();

    if (!accessSnapshot.exists) {
      return res.status(403).json({
        message: "Email Anda belum didaftarkan admin sebagai pelapor.",
      });
    }

    const accessData = accessSnapshot.data() || {};
    if (accessData.role !== "pelapor") {
      return res.status(403).json({
        message: "Akses pelapor Google tidak valid.",
      });
    }

    const linkedUid =
      typeof accessData.linkedUid === "string" ? accessData.linkedUid.trim() : "";
    const profileName =
      (typeof accessData.name === "string" && accessData.name.trim()) ||
      (typeof authUser.name === "string" && authUser.name.trim()) ||
      email.split("@")[0];
    const userRef = db.collection("users").doc(authUser.uid);
    const userSnapshot = await userRef.get();

    if (
      linkedUid &&
      linkedUid !== authUser.uid
    ) {
      const previousProfileSnapshot = await db.collection("users").doc(linkedUid).get();

      if (
        previousProfileSnapshot.exists &&
        previousProfileSnapshot.data()?.role === "pelapor" &&
        previousProfileSnapshot.data()?.email === email
      ) {
        await db.collection("users").doc(linkedUid).delete();
      }
    }

    if (userSnapshot.exists && userSnapshot.data()?.role !== "pelapor") {
      return res.status(409).json({
        message: "Akun ini sudah dipakai untuk role lain.",
      });
    }

    const userPayload = {
      uid: authUser.uid,
      email,
      name: profileName,
      role: "pelapor",
      authProvider: "google",
      managedUserKey: email,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.set(
      {
        ...userPayload,
        ...(userSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    await accessRef.set(
      {
        email,
        name: profileName,
        role: "pelapor",
        authProvider: "google",
        linkedUid: authUser.uid,
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return res.status(200).json({
      message: "Akses pelapor Google berhasil disinkronkan.",
      profile: {
        uid: authUser.uid,
        email,
        name: profileName,
        role: "pelapor",
      },
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Gagal menyinkronkan akun pelapor Google.",
    });
  }
});

module.exports = router;
