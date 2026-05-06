import { auth, db } from "@/lib/firebase";
import { fetchServerApi } from "@/lib/server-api";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export type NotificationStatus =
  | "diverifikasi"
  | "dimulai"
  | "terverifikasi"
  | "selesai"
  | "ditolak";

interface CreateNotificationInput {
  userUid: string;
  reportId: string;
  title: string;
  description: string;
  status: NotificationStatus;
}

const sendPushNotification = async ({
  userUid,
  reportId,
  title,
  description,
}: Omit<CreateNotificationInput, "status">) => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return;
  }

  try {
    const token = await currentUser.getIdToken(true);

    await fetchServerApi("/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetUserUid: userUid,
        reportId,
        title,
        body: description,
        data: {
          screen: "notifikasi",
          reportId,
        },
      }),
    });
  } catch (error) {
    console.error("Error sending Expo push notification:", error);
  }
};

export const createNotification = async ({
  userUid,
  reportId,
  title,
  description,
  status,
}: CreateNotificationInput) => {
  await addDoc(collection(db, "notifications"), {
    userUid,
    reportId,
    title,
    description,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await sendPushNotification({
    userUid,
    reportId,
    title,
    description,
  });
};
