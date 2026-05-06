require("./load-env");

const express = require("express");
const cors = require("cors");
const os = require("os");
const adminUserRoutes = require("./routes/admin-users");
const authRoutes = require("./routes/auth");
const notificationRoutes = require("./routes/notifications");
const reportRoutes = require("./routes/reports");
const uploadRoutes = require("./routes/upload");

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const defaultOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;
const allowAllOrigins = corsOrigins.includes("*");

const getLanUrls = (portNumber) => {
  const networkInterfaces = os.networkInterfaces();
  const urls = [];

  Object.values(networkInterfaces).forEach((interfaceAddresses) => {
    (interfaceAddresses || []).forEach((address) => {
      if (
        address &&
        address.family === "IPv4" &&
        !address.internal &&
        address.address
      ) {
        urls.push(`http://${address.address}:${portNumber}`);
      }
    });
  });

  return [...new Set(urls)];
};

app.use(
  cors({
    origin(origin, callback) {
      if (allowAllOrigins || !origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin tidak diizinkan oleh konfigurasi CORS server."));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "UFIXED upload server is running.",
  });
});

app.use("/uploads", uploadRoutes);
app.use("/admin", adminUserRoutes);
app.use("/auth", authRoutes);
app.use("/notifications", notificationRoutes);
app.use("/reports", reportRoutes);

app.use((error, _req, res, _next) => {
  if (error?.name === "MulterError" && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "Ukuran file terlalu besar. Maksimal 10 MB.",
    });
  }

  if (error instanceof Error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  return res.status(500).json({
    message: "Terjadi kesalahan yang tidak diketahui.",
  });
});

app.listen(port, host, () => {
  const lanUrls = getLanUrls(port);

  console.log(`UFIXED upload server berjalan di http://localhost:${port}`);
  console.log(
    `Akses LAN: ${lanUrls.length > 0 ? lanUrls.join(", ") : "tidak terdeteksi"}`,
  );
  console.log(
    `CORS origin aktif: ${
      allowAllOrigins ? "*" : corsOrigins.join(", ")
    }`,
  );
});
