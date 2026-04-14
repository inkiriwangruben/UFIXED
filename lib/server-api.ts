import Constants from "expo-constants";
import { Platform } from "react-native";

export const getServerApiBaseUrl = () => {
  const explicitServerUrl = process.env.EXPO_PUBLIC_SERVER_API_URL?.trim();

  if (explicitServerUrl) {
    return explicitServerUrl.replace(/\/$/, "");
  }

  const uploadApiUrl = process.env.EXPO_PUBLIC_UPLOAD_API_URL?.trim();

  if (uploadApiUrl) {
    return uploadApiUrl.replace(/\/$/, "");
  }

  // Try to auto-detect the host IP from Expo devtools (debuggerHost/hostUri).
  // Useful when running Expo Go on a physical device so `localhost` doesn't
  // point to the device itself.
  try {
    const manifest = Constants?.manifest || (Constants?.expoConfig ?? null);
    const debuggerHost = manifest?.debuggerHost || manifest?.hostUri;
    if (typeof debuggerHost === "string" && debuggerHost.includes(":")) {
      const host = debuggerHost.split(":")[0];
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:8080`;
      }
    }
  } catch (e) {
    // ignore and fall through to defaults
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080";
  }

  return "http://localhost:8080";
};
