const express = require("express");

const { getFirebaseAdminServices } = require("../firebase-admin");

const router = express.Router();
const PUSH_TOKENS_COLLECTION = "push_tokens";
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const FCM_TOKEN_KEY = "fcmPushTokens";
const EXPO_TOKEN_KEY = "expoPushTokens";
const INTERNAL_NOTIFICATION_SENDER_ROLES = new Set([
  "admin",
  "department-it",
  "tukang",
  "business-office",
]);

const isExpoPushToken = (value) =>
  typeof value === "string" &&
  /^(ExpoPushToken|ExponentPushToken)\[.+\]$/.test(value.trim());

const isLikelyFcmPushToken = (value) =>
  typeof value === "string" && value.trim().length > 100;

const toFcmDataPayload = (data = {}) =>
  Object.entries(data).reduce((result, [key, value]) => {
    if (typeof value === "undefined" || value === null) {
      return result;
    }

    if (typeof value === "string") {
      result[key] = value;
      return result;
    }

    result[key] = String(value);
    return result;
  }, {});

const getUserRole = async (db, uid) => {
  const profileSnapshot = await db.collection("users").doc(uid).get();

  if (!profileSnapshot.exists) {
    return "";
  }

  const role = profileSnapshot.data()?.role;
  return typeof role === "string" ? role.trim() : "";
};

const extractReportId = (req) => {
  const explicitReportId =
    typeof req.body?.reportId === "string" ? req.body.reportId.trim() : "";
  const reportIdFromData =
    req.body?.data &&
    typeof req.body.data === "object" &&
    typeof req.body.data.reportId === "string"
      ? req.body.data.reportId.trim()
      : "";

  if (explicitReportId && reportIdFromData && explicitReportId !== reportIdFromData) {
    return {
      reportId: "",
      error: "Report ID pada payload notifikasi tidak konsisten.",
    };
  }

  return {
    reportId: explicitReportId || reportIdFromData,
    error: "",
  };
};

const canRoleSendWorkflowNotification = ({
  senderRole,
  reportData,
}) => {
  const workflowStage =
    typeof reportData?.workflowStage === "string" ? reportData.workflowStage : "";
  const workflowState =
    typeof reportData?.workflowState === "string" ? reportData.workflowState : "";
  const unitTarget =
    typeof reportData?.unitTarget === "string" ? reportData.unitTarget : "";
  const rejectedByRole =
    typeof reportData?.rejectedByRole === "string" ? reportData.rejectedByRole : "";

  switch (senderRole) {
    case "admin":
      return (
        (workflowStage === "unit_review" && workflowState === "admin_approved") ||
        (workflowStage === "rejected" && rejectedByRole === "admin")
      );
    case "department-it":
      return (
        unitTarget === "department-it" &&
        (
          (workflowStage === "business_office_review" &&
            workflowState === "unit_approved") ||
          (workflowStage === "unit_repair" &&
            (workflowState === "bo_approved" || workflowState === "repairing")) ||
          (workflowStage === "done" && workflowState === "completed") ||
          (workflowStage === "rejected" && rejectedByRole === "department-it")
        )
      );
    case "tukang":
      return (
        unitTarget === "tukang" &&
        (
          (workflowStage === "business_office_review" &&
            workflowState === "unit_approved") ||
          (workflowStage === "unit_repair" &&
            (workflowState === "bo_approved" || workflowState === "repairing")) ||
          (workflowStage === "done" && workflowState === "completed") ||
          (workflowStage === "rejected" && rejectedByRole === "tukang")
        )
      );
    case "business-office":
      return (
        (workflowStage === "unit_repair" && workflowState === "bo_approved") ||
        (workflowStage === "rejected" && rejectedByRole === "business-office")
      );
    default:
      return false;
  }
};

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

router.post("/register-token", requireAuthenticatedUser, async (req, res) => {
  const expoPushToken =
    typeof req.body?.expoPushToken === "string"
      ? req.body.expoPushToken.trim()
      : "";
  const fcmPushToken =
    typeof req.body?.fcmPushToken === "string"
      ? req.body.fcmPushToken.trim()
      : "";
  const platform =
    typeof req.body?.platform === "string" ? req.body.platform.trim() : "";

  const tokenKey = fcmPushToken ? FCM_TOKEN_KEY : EXPO_TOKEN_KEY;
  const tokenValue = fcmPushToken || expoPushToken;

  if (
    (tokenKey === FCM_TOKEN_KEY && !isLikelyFcmPushToken(tokenValue)) ||
    (tokenKey === EXPO_TOKEN_KEY && !isExpoPushToken(tokenValue))
  ) {
    return res.status(400).json({
      message:
        tokenKey === FCM_TOKEN_KEY
          ? "FCM push token tidak valid."
          : "Expo push token tidak valid.",
    });
  }

  try {
    const { db, FieldValue } = getFirebaseAdminServices();
    const tokenRef = db.collection(PUSH_TOKENS_COLLECTION).doc(req.authUser.uid);

    await tokenRef.set(
      {
        uid: req.authUser.uid,
        email: req.authUser.email || "",
        [tokenKey]: FieldValue.arrayUnion(tokenValue),
        platform,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return res.status(200).json({
      ok: true,
      message:
        tokenKey === FCM_TOKEN_KEY
          ? "FCM push token berhasil disimpan."
          : "Expo push token berhasil disimpan.",
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Gagal menyimpan Expo push token.",
    });
  }
});

router.post("/send", requireAuthenticatedUser, async (req, res) => {
  const targetUserUid =
    typeof req.body?.targetUserUid === "string"
      ? req.body.targetUserUid.trim()
      : "";
  const { reportId, error: reportIdError } = extractReportId(req);
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body =
    typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const data =
    req.body?.data && typeof req.body.data === "object" ? req.body.data : {};

  if (reportIdError) {
    return res.status(400).json({
      message: reportIdError,
    });
  }

  if (!targetUserUid || !reportId || !title || !body) {
    return res.status(400).json({
      message: "Target user, report ID, judul, dan isi notifikasi wajib diisi.",
    });
  }

  try {
    const { db, messaging } = getFirebaseAdminServices();
    const senderRole = await getUserRole(db, req.authUser.uid);

    if (!INTERNAL_NOTIFICATION_SENDER_ROLES.has(senderRole)) {
      return res.status(403).json({
        message: "Hanya role internal tertentu yang dapat mengirim push notifikasi.",
      });
    }

    const reportSnapshot = await db.collection("laporan").doc(reportId).get();

    if (!reportSnapshot.exists) {
      return res.status(404).json({
        message: "Laporan tidak ditemukan untuk notifikasi ini.",
      });
    }

    const reportData = reportSnapshot.data() || {};
    const reportAuthorUid =
      typeof reportData.authorUid === "string" ? reportData.authorUid.trim() : "";

    if (!reportAuthorUid || reportAuthorUid !== targetUserUid) {
      return res.status(403).json({
        message: "Target notifikasi tidak sesuai dengan pelapor pemilik laporan.",
      });
    }

    if (!canRoleSendWorkflowNotification({ senderRole, reportData })) {
      return res.status(403).json({
        message:
          "Pengirim tidak berhak mengirim push notifikasi untuk workflow laporan ini.",
      });
    }

    const tokenSnapshot = await db
      .collection(PUSH_TOKENS_COLLECTION)
      .doc(targetUserUid)
      .get();

    if (!tokenSnapshot.exists) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: "Pengguna target belum memiliki push token terdaftar.",
      });
    }

    const tokenData = tokenSnapshot.data() || {};
    const fcmPushTokens = Array.isArray(tokenData[FCM_TOKEN_KEY])
      ? tokenData[FCM_TOKEN_KEY].filter(isLikelyFcmPushToken)
      : [];
    const expoPushTokens = Array.isArray(tokenData[EXPO_TOKEN_KEY])
      ? tokenData[EXPO_TOKEN_KEY].filter(isExpoPushToken)
      : [];

    if (fcmPushTokens.length > 0) {
      const fcmResponse = await messaging.sendEachForMulticast({
        tokens: fcmPushTokens,
        notification: {
          title,
          body,
        },
        data: toFcmDataPayload(data),
        android: {
          priority: "high",
          notification: {
            channelId: "ufixed-realtime",
            sound: "default",
          },
        },
      });

      return res.status(200).json({
        ok: true,
        provider: "fcm",
        successCount: fcmResponse.successCount,
        failureCount: fcmResponse.failureCount,
        responses: fcmResponse.responses.map((item) => ({
          success: item.success,
          messageId: item.messageId || null,
          error: item.error ? item.error.message : null,
        })),
      });
    }

    if (expoPushTokens.length === 0) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: "Tidak ada push token valid untuk pengguna target.",
      });
    }

    const messages = expoPushTokens.map((expoPushToken) => ({
      to: expoPushToken,
      title,
      body,
      sound: "default",
      data,
    }));

    const expoResponse = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const payload = await expoResponse.json();

    if (!expoResponse.ok) {
      return res.status(502).json({
        message: "Expo Push Service menolak permintaan notifikasi.",
        payload,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "expo",
      tickets: payload?.data || [],
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Gagal mengirim push notification.",
    });
  }
});

module.exports = router;
