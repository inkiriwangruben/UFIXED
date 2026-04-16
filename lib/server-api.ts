import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

const DEFAULT_SERVER_PORT = 8080;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

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

export const getServerApiBaseUrl = () => {
  const explicitServerUrl = process.env.EXPO_PUBLIC_SERVER_API_URL?.trim();

  if (explicitServerUrl) {
    return normalizeBaseUrl(explicitServerUrl);
  }

  const uploadApiUrl = process.env.EXPO_PUBLIC_UPLOAD_API_URL?.trim();

  if (uploadApiUrl) {
    return normalizeBaseUrl(uploadApiUrl);
  }

  const runtimeHost = getRuntimeHost();

  if (runtimeHost) {
    return buildServerUrl(runtimeHost);
  }

  if (Platform.OS === "android") {
    return buildServerUrl("10.0.2.2");
  }

  return buildServerUrl("localhost");
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
  const serverUrl = buildServerApiUrl(path);

  try {
    return await fetch(serverUrl, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Server UFIXED di ${getServerApiBaseUrl()} tidak merespons. Pastikan backend berjalan dan HP serta laptop berada di jaringan yang sama.`,
      );
    }

    const detail = error instanceof Error && error.message ? ` Detail: ${error.message}` : "";
    throw new Error(
      `Tidak dapat menghubungi server UFIXED di ${getServerApiBaseUrl()}.${detail}`,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
};
