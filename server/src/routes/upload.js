const express = require("express");
const multer = require("multer");
const imagekit = require("../imagekit");

const router = express.Router();

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/jpg"]);
const maxFileSize = 10 * 1024 * 1024;

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
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat upload.";

    return res.status(500).json({
      message: "Upload gagal.",
      error: message,
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
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat hapus.";

    return res.status(500).json({
      message: "Hapus file gagal.",
      error: message,
    });
  }
});

module.exports = router;
