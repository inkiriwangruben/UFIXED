const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const adminAppName = "ufixed-admin-server";

let cachedServices = null;

function getFirebaseAdminServices() {
  if (cachedServices) {
    return cachedServices;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH belum diisi di server/.env. Endpoint admin user memerlukan service account Firebase.",
    );
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const serviceAccount = require(serviceAccountPath);
  const existingApp = getApps().find((app) => app.name === adminAppName);
  const app =
    existingApp ??
    initializeApp(
      {
        credential: cert(serviceAccount),
      },
      adminAppName,
    );

  cachedServices = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    FieldValue,
  };

  return cachedServices;
}

module.exports = {
  getFirebaseAdminServices,
};
