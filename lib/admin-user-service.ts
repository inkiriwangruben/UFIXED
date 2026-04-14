import type { CanonicalUserRole } from "@/lib/roles";
import { auth } from "@/lib/firebase";
import { getServerApiBaseUrl } from "@/lib/server-api";

type CreateManagedUserInput = {
  email: string;
  password: string;
  role: Exclude<CanonicalUserRole, "admin">;
  name?: string;
};

const getAdminRequestHeaders = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");
  }

  const token = await currentUser.getIdToken();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

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

export const createManagedUser = async (input: CreateManagedUserInput) => {
  const response = await fetch(`${getServerApiBaseUrl()}/admin/users`, {
    method: "POST",
    headers: await getAdminRequestHeaders(),
    body: JSON.stringify(input),
  });

  return parseApiResponse(response);
};

export const deleteManagedUser = async (uid: string) => {
  const response = await fetch(`${getServerApiBaseUrl()}/admin/users/${uid}`, {
    method: "DELETE",
    headers: await getAdminRequestHeaders(),
  });

  return parseApiResponse(response);
};
