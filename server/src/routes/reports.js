const express = require("express");

const { getFirebaseAdminServices } = require("../firebase-admin");
const {
  buildReportDuplicateSignals,
  calculateTitleSimilarity,
} = require("../report-duplicates");

const router = express.Router();
const ACTIVE_TERMINAL_STAGES = new Set(["done", "rejected"]);
const ACTIVE_TERMINAL_STATES = new Set(["completed", "rejected"]);
const ACTIVE_TERMINAL_STATUSES = new Set(["selesai", "ditolak"]);
const TITLE_SIMILARITY_WITH_CONTEXT_THRESHOLD = 0.45;
const TITLE_SIMILARITY_NO_LOCATION_THRESHOLD = 0.75;

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

const getUserRole = async (db, uid) => {
  const profileSnapshot = await db.collection("users").doc(uid).get();

  if (!profileSnapshot.exists) {
    return "";
  }

  const role = profileSnapshot.data()?.role;
  return typeof role === "string" ? role.trim() : "";
};

const isActiveReport = (data = {}) => {
  const workflowStage =
    typeof data.workflowStage === "string" ? data.workflowStage : "";
  const workflowState =
    typeof data.workflowState === "string" ? data.workflowState : "";
  const status = typeof data.status === "string" ? data.status : "";

  return (
    !ACTIVE_TERMINAL_STAGES.has(workflowStage) &&
    !ACTIVE_TERMINAL_STATES.has(workflowState) &&
    !ACTIVE_TERMINAL_STATUSES.has(status)
  );
};

const getCreatedAtValue = (data = {}) => {
  const createdAt = data.createdAt;

  if (createdAt && typeof createdAt.toMillis === "function") {
    return createdAt.toMillis();
  }

  if (createdAt && typeof createdAt.toDate === "function") {
    return createdAt.toDate().getTime();
  }

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt;
  }

  return Number.MAX_SAFE_INTEGER;
};

const normalizePhotoFingerprints = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 10);
};

const getStoredPhotoFingerprints = (data = {}) =>
  Array.isArray(data.photoFingerprints)
    ? data.photoFingerprints
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const hasPhotoFingerprintMatch = (data = {}, incomingFingerprints = []) => {
  if (!incomingFingerprints.length) {
    return false;
  }

  const fingerprintSet = new Set(incomingFingerprints);
  return getStoredPhotoFingerprints(data).some((value) => fingerprintSet.has(value));
};

const getReportDuplicateInput = (data = {}) => ({
  kategori: data.kategori || "",
  judul: data.judul || data.title || "",
  deskripsi: data.deskripsi || data.description || "",
});

const getMatchedSignals = (candidate) => {
  const matchedSignals = [];

  if (candidate.titleMatch) {
    matchedSignals.push("title");
  }

  if (candidate.locationMatch) {
    matchedSignals.push("location");
  }

  if (candidate.photoMatch) {
    matchedSignals.push("image");
  }

  return matchedSignals;
};

const buildDuplicateSource = (candidate) => {
  const matchedSignals = getMatchedSignals(candidate);
  return matchedSignals.length > 0 ? matchedSignals.join("+") : null;
};

const evaluateCandidateMatches = (
  data = {},
  incomingSignals,
  incomingPhotoFingerprints = [],
) => {
  const storedSignals = buildReportDuplicateSignals(getReportDuplicateInput(data));
  const sameCategory =
    Boolean(incomingSignals.categoryKey) &&
    Boolean(storedSignals.categoryKey) &&
    incomingSignals.categoryKey === storedSignals.categoryKey;

  if (!sameCategory) {
    return {
      titleSimilarity: 0,
      titleMatch: false,
      locationMatch: false,
      photoMatch: false,
      qualifies: false,
    };
  }

  const titleSimilarity = calculateTitleSimilarity(
    incomingSignals.titleTokens,
    storedSignals.titleTokens,
  );
  const titleMatch =
    titleSimilarity >= TITLE_SIMILARITY_WITH_CONTEXT_THRESHOLD;
  const locationMatch =
    Boolean(incomingSignals.locationKey) &&
    Boolean(storedSignals.locationKey) &&
    incomingSignals.locationKey === storedSignals.locationKey;
  const photoMatch = hasPhotoFingerprintMatch(data, incomingPhotoFingerprints);
  const noLocationOnEither =
    !incomingSignals.locationKey && !storedSignals.locationKey;
  const qualifies =
    (photoMatch && (locationMatch || titleMatch)) ||
    (locationMatch && titleMatch) ||
    (noLocationOnEither &&
      titleSimilarity >= TITLE_SIMILARITY_NO_LOCATION_THRESHOLD);

  return {
    titleSimilarity,
    titleMatch,
    locationMatch,
    photoMatch,
    qualifies,
  };
};

const upsertDuplicateCandidate = (
  candidateMap,
  doc,
  incomingSignals,
  incomingPhotoFingerprints,
) => {
  const data = doc.data() || {};

  if (!isActiveReport(data)) {
    return;
  }

  const { titleSimilarity, titleMatch, locationMatch, photoMatch, qualifies } =
    evaluateCandidateMatches(
      data,
      incomingSignals,
      incomingPhotoFingerprints,
    );

  if (!qualifies) {
    return;
  }

  const current =
    candidateMap.get(doc.id) ||
    {
      id: doc.id,
      title: data.judul || data.title || "",
      createdAtValue: getCreatedAtValue(data),
      titleSimilarity: 0,
      titleMatch: false,
      locationMatch: false,
      photoMatch: false,
    };

  current.titleSimilarity = Math.max(current.titleSimilarity, titleSimilarity);
  current.titleMatch = current.titleMatch || titleMatch;
  current.locationMatch = current.locationMatch || locationMatch;
  current.photoMatch = current.photoMatch || photoMatch;

  candidateMap.set(doc.id, current);
};

const sortOldestCandidateFirst = (a, b) => {
  if (a.createdAtValue !== b.createdAtValue) {
    return a.createdAtValue - b.createdAtValue;
  }

  return a.id.localeCompare(b.id);
};

const resolveDuplicateCandidate = (candidateMap) => {
  const qualifiedCandidates = [...candidateMap.values()]
    .sort(sortOldestCandidateFirst);

  if (qualifiedCandidates.length > 0) {
    return {
      duplicateReport: qualifiedCandidates[0],
      duplicateSource: buildDuplicateSource(qualifiedCandidates[0]),
      matchedSignals: getMatchedSignals(qualifiedCandidates[0]),
      titleSimilarity: qualifiedCandidates[0].titleSimilarity,
      duplicateMatchCount: qualifiedCandidates.length,
    };
  }

  return {
    duplicateReport: null,
    duplicateSource: null,
    matchedSignals: [],
    titleSimilarity: 0,
    duplicateMatchCount: 0,
  };
};

router.post("/check-duplicate", requireAuthenticatedUser, async (req, res) => {
  const kategori = typeof req.body?.kategori === "string" ? req.body.kategori : "";
  const judul = typeof req.body?.judul === "string" ? req.body.judul.trim() : "";
  const deskripsi =
    typeof req.body?.deskripsi === "string" ? req.body.deskripsi.trim() : "";
  const photoFingerprints = normalizePhotoFingerprints(req.body?.photoFingerprints);

  if (!["IT", "Non-IT"].includes(kategori)) {
    return res.status(400).json({
      message: "Kategori laporan tidak valid.",
    });
  }

  if (!judul) {
    return res.status(400).json({
      message: "Judul laporan wajib diisi.",
    });
  }

  try {
    const { db } = getFirebaseAdminServices();
    const role = await getUserRole(db, req.authUser.uid);

    if (role !== "pelapor") {
      return res.status(403).json({
        message: "Hanya pelapor yang bisa mengecek duplikasi laporan.",
      });
    }

    const duplicateSignals = buildReportDuplicateSignals({
      kategori,
      judul,
      deskripsi,
    });
    const duplicateKey = duplicateSignals.duplicateKey;

    if (!duplicateKey) {
      return res.status(400).json({
        message: "Teks laporan tidak valid untuk pengecekan duplikasi.",
      });
    }

    const candidateMap = new Map();
    const duplicateSnapshot = await db
      .collection("laporan")
      .where("duplicateKey", "==", duplicateKey)
      .limit(200)
      .get();

    duplicateSnapshot.forEach((doc) => {
      upsertDuplicateCandidate(
        candidateMap,
        doc,
        duplicateSignals,
        photoFingerprints,
      );
    });

    if (duplicateSignals.titleKey) {
      const titleSnapshot = await db
        .collection("laporan")
        .where("duplicateTitleKey", "==", duplicateSignals.titleKey)
        .limit(200)
        .get();

      titleSnapshot.forEach((doc) => {
        upsertDuplicateCandidate(
          candidateMap,
          doc,
          duplicateSignals,
          photoFingerprints,
        );
      });
    }

    if (duplicateSignals.locationKey) {
      const locationSnapshot = await db
        .collection("laporan")
        .where("duplicateLocationKey", "==", duplicateSignals.locationKey)
        .limit(200)
        .get();

      locationSnapshot.forEach((doc) => {
        upsertDuplicateCandidate(
          candidateMap,
          doc,
          duplicateSignals,
          photoFingerprints,
        );
      });
    }

    const legacySnapshot = await db.collection("laporan").get();

    legacySnapshot.forEach((doc) => {
      upsertDuplicateCandidate(
        candidateMap,
        doc,
        duplicateSignals,
        photoFingerprints,
      );
    });

    if (photoFingerprints.length > 0) {
      const photoSnapshot = await db
        .collection("laporan")
        .where("photoFingerprints", "array-contains-any", photoFingerprints)
        .limit(200)
        .get();

      photoSnapshot.forEach((doc) => {
        upsertDuplicateCandidate(
          candidateMap,
          doc,
          duplicateSignals,
          photoFingerprints,
        );
      });
    }

    const {
      duplicateReport,
      duplicateSource,
      matchedSignals,
      titleSimilarity,
      duplicateMatchCount,
    } = resolveDuplicateCandidate(candidateMap);

    return res.status(200).json({
      duplicateKey,
      duplicateTitleKey: duplicateSignals.titleKey,
      duplicateLocationKey: duplicateSignals.locationKey || null,
      isDuplicate: Boolean(duplicateReport),
      duplicateOfReportId: duplicateReport?.id || null,
      duplicateSource,
      matchedSignals,
      titleSimilarity,
      duplicateMatchCount,
      duplicateTitle: duplicateReport?.title || null,
    });
  } catch (error) {
    console.error("Error checking duplicate report:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Gagal mengecek duplikasi laporan.",
    });
  }
});

module.exports = router;
