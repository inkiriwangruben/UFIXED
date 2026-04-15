import { sendPasswordResetEmail, signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";

export const LOGIN_ROUTE = "/(tabs)/Screens/LoginScreen";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const requestPasswordReset = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email wajib diisi.");
  }

  await sendPasswordResetEmail(auth, normalizedEmail);
};

export const signOutCurrentUser = async () => {
  if (!auth.currentUser) {
    return;
  }

  await signOut(auth);
};
