require("dotenv").config();

const express = require("express");
const cors = require("cors");
const uploadRoutes = require("./routes/upload");

const app = express();
const port = Number(process.env.PORT || 8080);
const corsOrigin = process.env.CORS_ORIGIN || "*";
const host = process.env.HOST || "0.0.0.0";

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
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
  console.log(`UFIXED upload server berjalan di http://localhost:${port}`);
  console.log(`Akses LAN: http://192.168.1.20:${port}`);
});
