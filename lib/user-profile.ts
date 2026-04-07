import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeUserRole, type CanonicalUserRole } from "@/lib/roles";

export interface AppUserProfile {
  uid: string;
  name: string;
  email: string;
  role: CanonicalUserRole;
}

const normalizeEmail = (value?: string | null) =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";

export const getDefaultNameFromEmail = (email: string) =>
  email.split("@")[0] || "User";

export const mapUserDocumentToProfile = (
  id: string,
  data: Record<string, unknown>,
): AppUserProfile | null => {
  const role = normalizeUserRole(
    typeof data.role === "string" ? data.role : null,
  );
  const email = normalizeEmail(
    typeof data.email === "string" ? data.email : null,
  );
  const uid =
    typeof data.uid === "string" && data.uid.trim() ? data.uid.trim() : id;

  if (!role || !email || !uid) {
    return null;
  }

  return {
    uid,
    email,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : getDefaultNameFromEmail(email),
    role,
  };
};

export const buildCanonicalUserProfileInput = ({
  uid,
  email,
  name,
  role,
}: AppUserProfile) => ({
  uid,
  email: normalizeEmail(email),
  name: name.trim() || getDefaultNameFromEmail(normalizeEmail(email)),
  role,
});

export const getUserProfileByUid = async (uid: string) => {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserDocumentToProfile(
    snapshot.id,
    snapshot.data() as Record<string, unknown>,
  );
};

export const resolveReportAuthorName = async ({
  author,
  authorUid,
}: {
  author?: string | null;
  authorUid?: string | null;
}) => {
  const normalizedAuthor =
    typeof author === "string" && author.trim() ? author.trim() : "";
  const normalizedUid =
    typeof authorUid === "string" && authorUid.trim() ? authorUid.trim() : "";

  if (normalizedAuthor && !normalizedAuthor.includes("@")) {
    return normalizedAuthor;
  }

  if (normalizedUid) {
    try {
      const profile = await getUserProfileByUid(normalizedUid);

      if (profile?.name) {
        return profile.name;
      }
    } catch {
      // Fallback below keeps older reports readable even if profile lookup fails.
    }
  }

  if (normalizedAuthor) {
    return normalizedAuthor.includes("@")
      ? getDefaultNameFromEmail(normalizedAuthor)
      : normalizedAuthor;
  }

  return "User";
};
