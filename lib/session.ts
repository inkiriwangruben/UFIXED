import Constants from "expo-constants";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { Platform } from "react-native";

import { auth } from "@/lib/firebase";

export const LOGIN_ROUTE = "/(tabs)/Screens/LoginScreen";

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isRunningInExpoGo = Constants.executionEnvironment === "storeClient";

type NativeGoogleSigninModule =
  typeof import("@react-native-google-signin/google-signin");

type SignOutOptions = {
  clearGoogleSession?: boolean;
  revokeGoogleAccess?: boolean;
};

const getNativeGoogleSigninModule = (): NativeGoogleSigninModule | null => {
  if (Platform.OS !== "android" || isRunningInExpoGo) {
    return null;
  }

  try {
    // We load this lazily so session utilities still work in Expo Go and web.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as NativeGoogleSigninModule;
  } catch {
    return null;
  }
};

export const requestPasswordReset = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email wajib diisi.");
  }

  await sendPasswordResetEmail(auth, normalizedEmail);
};

export const clearNativeGoogleSession = async (
  options: Pick<SignOutOptions, "revokeGoogleAccess"> = {},
) => {
  const nativeGoogleModule = getNativeGoogleSigninModule();

  if (!nativeGoogleModule) {
    return;
  }

  const { revokeGoogleAccess = false } = options;
  const { GoogleSignin } = nativeGoogleModule;

  if (revokeGoogleAccess) {
    try {
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.revokeAccess();
      }
    } catch (error) {
      console.error("Error revoking native Google access:", error);
    }
  }

  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error("Error signing out native Google session:", error);
  }
};

export const signOutCurrentUser = async (options: SignOutOptions = {}) => {
  const { clearGoogleSession = true, revokeGoogleAccess = false } = options;

  if (auth.currentUser) {
    await signOut(auth);
  }

  if (clearGoogleSession) {
    await clearNativeGoogleSession({ revokeGoogleAccess });
  }
};
