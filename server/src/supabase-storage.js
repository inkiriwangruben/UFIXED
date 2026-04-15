require("./load-env");

const { randomUUID } = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const defaultUploadFolder = "laporan";
const defaultBucketName = "laporan";
const maxFileSize = 10 * 1024 * 1024;

let cachedClient = null;

const getSanitizedEnv = (key) => {
  const rawValue = process.env[key];

  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim().replace(/^['"]|['"]$/g, "");
};

const getSupabaseServerKey = () =>
  getSanitizedEnv("SUPABASE_SECRET_KEY") ||
  getSanitizedEnv("SUPABASE_SERVICE_ROLE_KEY");

const getSupabaseConfig = () => {
  const url = getSanitizedEnv("SUPABASE_URL");
  const serverKey = getSupabaseServerKey();
  const bucketName =
    getSanitizedEnv("SUPABASE_STORAGE_BUCKET") || defaultBucketName;

  if (!url) {
    throw new Error("SUPABASE_URL belum diisi di server/.env.");
  }

  if (!serverKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY belum diisi di server/.env.",
    );
  }

  return {
    url,
    serverKey,
    bucketName,
    uploadFolder: defaultUploadFolder,
  };
};

const getSupabaseClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const { url, serverKey } = getSupabaseConfig();

  cachedClient = createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "ufixed-upload-server",
      },
    },
  });

  return cachedClient;
};

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

  return "Unknown Supabase Storage error.";
};

const normalizeStorageError = (error) => {
  const normalized = {
    message: getErrorMessage(error),
  };

  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    (typeof error.status === "number" || typeof error.status === "string")
  ) {
    normalized.status = error.status;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    (typeof error.statusCode === "number" || typeof error.statusCode === "string")
  ) {
    normalized.statusCode = error.statusCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof error.error === "string"
  ) {
    normalized.error = error.error;
  }

  return normalized;
};

const isBucketMissingError = (error) => {
  const message = getErrorMessage(error);

  return (
    /not found/i.test(message) ||
    /bucket/i.test(message) ||
    (typeof error === "object" &&
      error !== null &&
      (error.statusCode === 404 || error.status === 404))
  );
};

const sanitizeFileName = (fileName) => {
  const trimmedName =
    typeof fileName === "string" && fileName.trim()
      ? fileName.trim()
      : `laporan-${Date.now()}.jpg`;

  const normalizedName = trimmedName
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");

  return normalizedName || `laporan-${Date.now()}.jpg`;
};

const encodeFileId = (filePath) =>
  Buffer.from(filePath, "utf8").toString("base64url");

const decodeFileId = (fileId) => {
  try {
    return Buffer.from(fileId, "base64url").toString("utf8");
  } catch {
    return "";
  }
};

const getSafeStorageConfigSnapshot = () => {
  try {
    const { url, bucketName, uploadFolder } = getSupabaseConfig();
    const parsedUrl = new URL(url);

    return {
      supabaseHost: parsedUrl.host,
      bucketName,
      uploadFolder,
    };
  } catch {
    return {
      supabaseHost: null,
      bucketName: getSanitizedEnv("SUPABASE_STORAGE_BUCKET") || defaultBucketName,
      uploadFolder: defaultUploadFolder,
    };
  }
};

const getStorageUploadAdvice = (message) => {
  if (/SUPABASE_URL/i.test(message) || /SUPABASE_SECRET_KEY/i.test(message)) {
    return [
      "Isi SUPABASE_URL dan server-side key Supabase di server/.env.",
      "Gunakan secret key (`sb_secret_...`) bila tersedia, atau legacy service_role key hanya di backend.",
    ];
  }

  if (/bucket/i.test(message) && /not found/i.test(message)) {
    return [
      "Periksa SUPABASE_STORAGE_BUCKET di server/.env.",
      "Pastikan bucket Storage ada, atau biarkan server membuat bucket publik otomatis pada pengecekan pertama.",
    ];
  }

  if (/row level security/i.test(message) || /permission/i.test(message)) {
    return [
      "Gunakan secret key atau service_role key Supabase di backend agar akses Storage tidak diblokir RLS.",
    ];
  }

  return [];
};

const ensureSupabaseBucketReady = async () => {
  const supabase = getSupabaseClient();
  const { bucketName } = getSupabaseConfig();
  const bucketLookup = await supabase.storage.getBucket(bucketName);

  if (bucketLookup.error && !isBucketMissingError(bucketLookup.error)) {
    throw bucketLookup.error;
  }

  if (!bucketLookup.data || bucketLookup.error) {
    const createResult = await supabase.storage.createBucket(bucketName, {
      public: true,
    });

    if (createResult.error) {
      throw createResult.error;
    }

    return {
      bucketName,
      public: true,
      created: true,
    };
  }

  if (bucketLookup.data.public !== true) {
    const updateResult = await supabase.storage.updateBucket(bucketName, {
      public: true,
    });

    if (updateResult.error) {
      throw updateResult.error;
    }
  }

  return {
    bucketName,
    public: true,
    created: false,
  };
};

const uploadBufferToSupabaseStorage = async ({
  buffer,
  fileName,
  mimeType,
}) => {
  const supabase = getSupabaseClient();
  const { bucketName, uploadFolder } = getSupabaseConfig();
  const safeFileName = sanitizeFileName(fileName);
  const filePath = `${uploadFolder}/${Date.now()}-${randomUUID()}-${safeFileName}`;

  await ensureSupabaseBucketReady();

  const uploadResult = await supabase.storage.from(bucketName).upload(filePath, buffer, {
    contentType: mimeType || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const publicUrlResult = supabase.storage.from(bucketName).getPublicUrl(filePath);
  const publicUrl = publicUrlResult?.data?.publicUrl;

  if (!publicUrl) {
    throw new Error("Supabase tidak mengembalikan public URL file.");
  }

  return {
    url: publicUrl,
    fileId: encodeFileId(filePath),
    filePath,
    name: path.basename(filePath),
    thumbnailUrl: publicUrl,
  };
};

const deleteSupabaseStorageFile = async (fileId) => {
  const supabase = getSupabaseClient();
  const { bucketName } = getSupabaseConfig();
  const filePath = decodeFileId(fileId);

  if (!filePath) {
    throw new Error("fileId foto tidak valid.");
  }

  const deleteResult = await supabase.storage.from(bucketName).remove([filePath]);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  return {
    filePath,
  };
};

const checkSupabaseStorageHealth = async () => {
  try {
    const bucket = await ensureSupabaseBucketReady();

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      message: bucket.created
        ? "Supabase Storage bucket berhasil dibuat dan siap dipakai."
        : "Supabase Storage bucket dapat diakses.",
      bucket,
    };
  } catch (error) {
    const normalizedError = normalizeStorageError(error);

    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      message: "Supabase Storage tidak dapat diakses.",
      error: normalizedError,
      config: getSafeStorageConfigSnapshot(),
      advice: getStorageUploadAdvice(normalizedError.message),
    };
  }
};

module.exports = {
  checkSupabaseStorageHealth,
  deleteSupabaseStorageFile,
  getSafeStorageConfigSnapshot,
  getStorageUploadAdvice,
  maxFileSize,
  normalizeStorageError,
  uploadBufferToSupabaseStorage,
};
