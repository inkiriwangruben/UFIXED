import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";

export const LOGIN_ROUTE = "/(tabs)/Screens/LoginScreen";

export const signOutCurrentUser = async () => {
  if (!auth.currentUser) {
    return;
  }

  await signOut(auth);
};
