import { auth } from "@/lib/firebase";
import { fetchServerApi } from "@/lib/server-api";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const NOTIFICATION_CHANNEL_ID = "ufixed-realtime";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getExpoProjectId = () => {
  const constantsRecord = Constants as unknown as Record<string, unknown>;
  const easConfig =
    constantsRecord.easConfig && typeof constantsRecord.easConfig === "object"
      ? (constantsRecord.easConfig as Record<string, unknown>)
      : null;
  const expoConfig =
    constantsRecord.expoConfig && typeof constantsRecord.expoConfig === "object"
      ? (constantsRecord.expoConfig as Record<string, unknown>)
      : null;
  const extra =
    expoConfig?.extra && typeof expoConfig.extra === "object"
      ? (expoConfig.extra as Record<string, unknown>)
      : null;
  const easExtra =
    extra?.eas && typeof extra.eas === "object"
      ? (extra.eas as Record<string, unknown>)
      : null;

  const projectIdCandidates = [
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "",
    typeof easConfig?.projectId === "string" ? easConfig.projectId.trim() : "",
    typeof easExtra?.projectId === "string" ? easExtra.projectId.trim() : "",
  ];

  return projectIdCandidates.find(Boolean) || "";
};

const ensureRealtimeNotificationPermission = async () => {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: "UFIXED Realtime",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const settings = await Notifications.getPermissionsAsync();

    if (settings.granted) {
      return true;
    }

    const requestedSettings = await Notifications.requestPermissionsAsync();
    return requestedSettings.granted;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

const registerPushTokenToServer = async (expoPushToken: string) => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return;
  }

  try {
    const token = await currentUser.getIdToken(true);

    await fetchServerApi("/notifications/register-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken,
        platform: Platform.OS,
      }),
    });
  } catch (error) {
    console.error("Error registering Expo push token:", error);
  }
};

const registerFcmPushTokenToServer = async (fcmPushToken: string) => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return;
  }

  try {
    const token = await currentUser.getIdToken(true);

    await fetchServerApi("/notifications/register-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fcmPushToken,
        platform: Platform.OS,
      }),
    });
  } catch (error) {
    console.error("Error registering FCM push token:", error);
  }
};

const RealtimeNotificationBridge: React.FC = () => {
  const router = useRouter();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(
    auth.currentUser?.uid ?? null,
  );
  const [canNotify, setCanNotify] = useState(false);
  const lastRegisteredTokenRef = useRef("");

  useEffect(() => {
    void (async () => {
      const permissionGranted = await ensureRealtimeNotificationPermission();
      setCanNotify(permissionGranted);
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserUid(user?.uid ?? null);

      if (!user) {
        lastRegisteredTokenRef.current = "";
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      () => {
        router.push("/(tabs)/Screens/Notifikasi");
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!currentUserUid || !canNotify) {
      return;
    }

    void (async () => {
      try {
        if (Platform.OS === "android") {
          const devicePushToken = await Notifications.getDevicePushTokenAsync();
          const fcmPushToken =
            typeof devicePushToken.data === "string"
              ? devicePushToken.data.trim()
              : "";

          if (
            !fcmPushToken ||
            fcmPushToken === lastRegisteredTokenRef.current
          ) {
            return;
          }

          await registerFcmPushTokenToServer(fcmPushToken);
          lastRegisteredTokenRef.current = fcmPushToken;
          return;
        }

        const projectId = getExpoProjectId();

        if (!projectId) {
          console.warn(
            "Expo push projectId belum diisi. Set EXPO_PUBLIC_EAS_PROJECT_ID agar push notification penuh bisa dipakai.",
          );
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const expoPushToken = tokenResponse.data?.trim() || "";

        if (!expoPushToken || expoPushToken === lastRegisteredTokenRef.current) {
          return;
        }

        await registerPushTokenToServer(expoPushToken);
        lastRegisteredTokenRef.current = expoPushToken;
      } catch (error) {
        console.error("Error getting push token:", error);
      }
    })();
  }, [canNotify, currentUserUid]);

  return null;
};

export default RealtimeNotificationBridge;
