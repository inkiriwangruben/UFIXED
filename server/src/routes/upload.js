const express = require("express");
const multer = require("multer");
const imagekit = require("../imagekit");

const router = express.Router();

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/jpg"]);
const maxFileSize = 10 * 1024 * 1024;

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

const serializeError = (error) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    return { ...error };
  }

  return {
    message: String(error),
  };
};

const getReadableUploadError = (error) => {
  const detail = getErrorMessage(error);

  if (/cannot be authenticated/i.test(detail)) {
    return "Upload gagal karena kredensial ImageKit tidak valid. Periksa konfigurasi IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, dan IMAGEKIT_URL_ENDPOINT.";
  }

  if (/Missing required parameter/i.test(detail)) {
    return "Upload gagal karena ada parameter ImageKit yang belum lengkap.";
  }

  return detail;
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

router.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Upload service is ready.",
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

      const result = await imagekit.upload({
        file: req.body.base64,
        fileName: safeName,
        folder: "/laporan",
        useUniqueFileName: true,
        tags: ["ufixed", "laporan"],
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

    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName,
      folder: "/laporan",
      useUniqueFileName: true,
      tags: ["ufixed", "laporan"],
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
    const errorPayload = serializeError(error);

    console.error("ImageKit upload failed:", {
      ...errorPayload,
      route: "POST /uploads/report-image",
    });

    return res.status(502).json({
      message: detail,
      error: getErrorMessage(error),
      help:
        error &&
        typeof error === "object" &&
        "help" in error &&
        typeof error.help === "string"
          ? error.help
          : undefined,
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

    await imagekit.deleteFile(fileId);

    return res.status(200).json({
      message: "File berhasil dihapus dari ImageKit.",
    });
  } catch (error) {
    const detail = getErrorMessage(error);
    const errorPayload = serializeError(error);

    console.error("ImageKit delete failed:", {
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
