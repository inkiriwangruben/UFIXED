const express = require("express");
const multer = require("multer");
const {
  checkSupabaseStorageHealth,
  deleteSupabaseStorageFile,
  getSafeStorageConfigSnapshot,
  getStorageUploadAdvice,
  maxFileSize,
  normalizeStorageError,
  uploadBufferToSupabaseStorage,
} = require("../supabase-storage");

const router = express.Router();

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/jpg"]);

const getErrorMessage = (error) => {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Terjadi kesalahan saat upload.";
};

const getReadableUploadError = (error) => {
  const detail = getErrorMessage(error);

  if (/bucket/i.test(detail) && /not found/i.test(detail)) {
    return "Upload gagal karena bucket Supabase Storage tidak ditemukan.";
  }

  if (/row level security/i.test(detail) || /permission/i.test(detail)) {
    return "Upload gagal karena server tidak memiliki akses yang cukup ke Supabase Storage.";
  }

  return detail;
};

const getBufferFromBase64 = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Data base64 foto tidak valid.");
  }

  const sanitized = value.replace(/^data:[^;]+;base64,/, "").trim();
  return Buffer.from(sanitized, "base64");
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Hanya file JPG dan PNG yang diperbolehkan."));
      return;
    }

    callback(null, true);
  },
});

router.get("/health", async (_req, res) => {
  const storageCheck = await checkSupabaseStorageHealth();
  const statusCode = storageCheck.ok ? 200 : 503;

  res.status(statusCode).json({
    ok: storageCheck.ok,
    message: storageCheck.ok
      ? "Upload service is ready."
      : "Upload service cannot access Supabase Storage.",
    config: getSafeStorageConfigSnapshot(),
    storage: storageCheck,
  });
});

router.post("/report-image", upload.single("photo"), async (req, res) => {
  try {
    if (req.body?.base64) {
      const providedType =
        typeof req.body.type === "string" && allowedMimeTypes.has(req.body.type)
          ? req.body.type
          : "image/jpeg";
      const extension = providedType === "image/png" ? "png" : "jpg";
      const safeName =
        typeof req.body.name === "string" && req.body.name.trim()
          ? req.body.name.trim().replace(/\s+/g, "-")
          : `laporan-${Date.now()}.${extension}`;

      const result = await uploadBufferToSupabaseStorage({
        buffer: getBufferFromBase64(req.body.base64),
        fileName: safeName,
        mimeType: providedType,
      });

      return res.status(200).json({
        message: "Upload berhasil.",
        photo: {
          url: result.url,
          fileId: result.fileId,
          filePath: result.filePath,
          name: result.name,
          thumbnailUrl: result.thumbnailUrl,
        },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "File foto tidak ditemukan.",
      });
    }

    const safeOriginalName = req.file.originalname.replace(/\s+/g, "-");
    const fileName = `${Date.now()}-${safeOriginalName}`;

    const result = await uploadBufferToSupabaseStorage({
      buffer: req.file.buffer,
      fileName,
      mimeType: req.file.mimetype,
    });

    return res.status(200).json({
      message: "Upload berhasil.",
      photo: {
        url: result.url,
        fileId: result.fileId,
        filePath: result.filePath,
        name: result.name,
        thumbnailUrl: result.thumbnailUrl,
      },
    });
  } catch (error) {
    const detail = getReadableUploadError(error);
    const errorPayload = normalizeStorageError(error);
    const advice = getStorageUploadAdvice(errorPayload.message);

    console.error("Supabase Storage upload failed:", {
      ...errorPayload,
      route: "POST /uploads/report-image",
    });

    return res.status(502).json({
      message: detail,
      error: errorPayload.message,
      help: errorPayload.help,
      advice: advice.length > 0 ? advice : undefined,
    });
  }
});

router.delete("/report-image/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        message: "fileId wajib diisi.",
      });
    }

    await deleteSupabaseStorageFile(fileId);

    return res.status(200).json({
      message: "File berhasil dihapus dari Supabase Storage.",
    });
  } catch (error) {
    const detail = getErrorMessage(error);
    const errorPayload = normalizeStorageError(error);

    console.error("Supabase Storage delete failed:", {
      ...errorPayload,
      route: "DELETE /uploads/report-image/:fileId",
    });

    return res.status(500).json({
      message: "Hapus file gagal.",
      error: detail,
    });
  }
});

module.exports = router;
