import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDRRZ_gSdnuR5NcorvOSZgLm593TSlCZiA",
  authDomain: "ufixed-e7260.firebaseapp.com",
  databaseURL: "https://ufixed-e7260-default-rtdb.firebaseio.com",
  projectId: "ufixed-e7260",
  storageBucket: "ufixed-e7260.firebasestorage.app",
  messagingSenderId: "460587960532",
  appId: "1:460587960532:web:159737c3dac53b1cfe1341",
  measurementId: "G-4RHWC62P4X",
};

const missingConfig = Object.entries(firebaseConfig).filter(
  ([, value]) => !value,
);

if (missingConfig.length > 0) {
  const missingKeys = missingConfig.map(([key]) => key).join(", ");
  throw new Error(
    `Firebase configuration is incomplete. Missing: ${missingKeys}`,
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const adminCreateAppName = "ufixed-admin-create";
const secondaryApp: FirebaseApp =
  getApps().find((item) => item.name === adminCreateAppName) ??
  initializeApp(firebaseConfig, adminCreateAppName);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
