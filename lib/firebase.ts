import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Persistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

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

export const db = getFirestore(app);

type ReactNativeAuthModule = {
  getAuth: typeof import("firebase/auth").getAuth;
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  initializeAuth: typeof import("firebase/auth").initializeAuth;
};

const createAuth = () => {
  if (Platform.OS === "web") {
    return getAuth(app);
  }

  try {
    const { initializeAuth, getReactNativePersistence } = require(
      "@firebase/auth",
    ) as ReactNativeAuthModule;

    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
};

export const auth = createAuth();
