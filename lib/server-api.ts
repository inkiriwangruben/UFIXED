import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const DEFAULT_SERVER_PORT = 8080;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const SERVER_API_BASE_URL_OVERRIDE_KEY = "ufixed:server-api-base-url-override";
let lastWorkingServerBaseUrl = "";
let serverApiBaseUrlOverride = "";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const appendUniqueUrl = (urls: string[], value: string) => {
  const normalizedValue = value.trim() ? normalizeBaseUrl(value.trim()) : "";

  if (normalizedValue && !urls.includes(normalizedValue)) {
    urls.push(normalizedValue);
  }
};

const extractHostFromCandidate = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    if (trimmedValue.includes("://")) {
      return new URL(trimmedValue).hostname;
    }

    const hostWithMaybePort = trimmedValue.split("/")[0] || "";
    return hostWithMaybePort.split(":")[0] || "";
  } catch {
    return "";
  }
};

const isUsableHost = (host: string) =>
  Boolean(host) && host !== "localhost" && host !== "127.0.0.1";

const getRuntimeHost = () => {
  const constantsRecord = Constants as unknown as Record<string, unknown>;
  const manifest = asRecord(constantsRecord.manifest);
  const expoConfig = asRecord(constantsRecord.expoConfig);
  const expoGoConfig = asRecord(constantsRecord.expoGoConfig);
  const manifest2 = asRecord(constantsRecord.manifest2);
  const manifest2Extra = asRecord(manifest2?.extra);
  const expoClient = asRecord(manifest2Extra?.expoClient);
  const sourceCode = asRecord(NativeModules?.SourceCode);

  const candidates = [
    getString(manifest?.debuggerHost),
    getString(manifest?.hostUri),
    getString(expoConfig?.hostUri),
    getString(expoGoConfig?.debuggerHost),
    getString(expoClient?.hostUri),
    getString(sourceCode?.scriptURL),
  ];

  for (const candidate of candidates) {
    const host = extractHostFromCandidate(candidate);

    if (isUsableHost(host)) {
      return host;
    }
  }

  return "";
};

const buildServerUrl = (host: string) => `http://${host}:${DEFAULT_SERVER_PORT}`;

export const getServerApiBaseUrlOverride = () => serverApiBaseUrlOverride;

export const hydrateServerApiBaseUrlOverride = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(
      SERVER_API_BASE_URL_OVERRIDE_KEY,
    );
    serverApiBaseUrlOverride = storedValue?.trim()
      ? normalizeBaseUrl(storedValue.trim())
      : "";
  } catch (error) {
    console.error("Error hydrating server API base URL override:", error);
  }

  return serverApiBaseUrlOverride;
};

export const setServerApiBaseUrlOverride = async (value: string) => {
  const normalizedValue = value.trim() ? normalizeBaseUrl(value.trim()) : "";
  serverApiBaseUrlOverride = normalizedValue;

  try {
    if (normalizedValue) {
      await AsyncStorage.setItem(
        SERVER_API_BASE_URL_OVERRIDE_KEY,
        normalizedValue,
      );
    } else {
      await AsyncStorage.removeItem(SERVER_API_BASE_URL_OVERRIDE_KEY);
    }
  } catch (error) {
    console.error("Error saving server API base URL override:", error);
  }

  lastWorkingServerBaseUrl = normalizedValue;
  return normalizedValue;
};

const getServerApiBaseUrls = () => {
  if (serverApiBaseUrlOverride) {
    return [serverApiBaseUrlOverride];
  }

  const urls: string[] = [];
  const runtimeHost = getRuntimeHost();
  const explicitServerUrl = process.env.EXPO_PUBLIC_SERVER_API_URL?.trim();
  const uploadApiUrl = process.env.EXPO_PUBLIC_UPLOAD_API_URL?.trim();

  // In dev builds, prefer the active Metro host so server access follows
  // the current laptop IP instead of relying on a stale .env value.
  if (__DEV__ && runtimeHost) {
    appendUniqueUrl(urls, buildServerUrl(runtimeHost));
  }

  appendUniqueUrl(urls, explicitServerUrl || "");
  appendUniqueUrl(urls, uploadApiUrl || "");

  if (!__DEV__ && runtimeHost) {
    appendUniqueUrl(urls, buildServerUrl(runtimeHost));
  }

  if (Platform.OS === "android") {
    appendUniqueUrl(urls, buildServerUrl("10.0.2.2"));
    appendUniqueUrl(urls, buildServerUrl("127.0.0.1"));
    appendUniqueUrl(urls, buildServerUrl("localhost"));
  } else {
    appendUniqueUrl(urls, buildServerUrl("localhost"));
    appendUniqueUrl(urls, buildServerUrl("127.0.0.1"));
  }

  if (lastWorkingServerBaseUrl) {
    const preferredUrls = [lastWorkingServerBaseUrl];

    urls.forEach((url) => {
      if (url !== lastWorkingServerBaseUrl) {
        preferredUrls.push(url);
      }
    });

    return preferredUrls;
  }

  return urls;
};

export const getServerApiBaseUrl = () => {
  const [firstUrl] = getServerApiBaseUrls();
  return firstUrl || buildServerUrl("localhost");
};

export const buildServerApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getServerApiBaseUrl()}${normalizedPath}`;
};

export const fetchServerApi = async (
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidateBaseUrls = getServerApiBaseUrls();
  const attemptedBaseUrls: string[] = [];
  let lastError: unknown = null;

  try {
    for (const baseUrl of candidateBaseUrls) {
      attemptedBaseUrls.push(baseUrl);

      try {
        const response = await fetch(`${baseUrl}${normalizedPath}`, {
          ...init,
          signal: controller.signal,
        });

        lastWorkingServerBaseUrl = baseUrl;
        return response;
      } catch (error) {
        lastError = error;

        if (error instanceof Error && error.name === "AbortError") {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("Network request failed");
  } catch (error) {
    const displayedBaseUrl =
      attemptedBaseUrls[0] || getServerApiBaseUrl();

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Server UFIXED di ${displayedBaseUrl} tidak merespons. Pastikan backend berjalan dan HP serta laptop berada di jaringan yang sama.`,
      );
    }

    const detail = error instanceof Error && error.message ? ` Detail: ${error.message}` : "";
    throw new Error(
      `Tidak dapat menghubungi server UFIXED di ${displayedBaseUrl}.${detail}`,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
};
