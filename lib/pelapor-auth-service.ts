import { auth } from "@/lib/firebase";
import { fetchServerApi } from "@/lib/server-api";

const parseApiResponse = async (response: Response) => {
  const rawBody = await response.text();
  let payload: Record<string, unknown> | null = null;

  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
  } catch {
    payload = rawBody ? { message: rawBody } : null;
  }

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : "Permintaan ke server gagal.";
    throw new Error(message);
  }

  return payload;
};

export const syncPelaporGoogleProfile = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Sesi pelapor tidak ditemukan. Silakan login ulang.");
  }

  const token = await currentUser.getIdToken(true);
  const response = await fetchServerApi("/auth/pelapor/google-sync", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse(response);
};
