import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
};
