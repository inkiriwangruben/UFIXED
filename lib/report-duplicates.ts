import type { Kategori } from "@/lib/workflow";

export interface ReportDuplicateTextInput {
  kategori: Kategori;
  judul: string;
  deskripsi?: string;
}

export interface ReportDuplicateSignals {
  categoryKey: string;
  duplicateKey: string;
  titleKey: string;
  locationKey: string;
  titleTokens: string[];
}

const BUILDING_LOCATION_PATTERN =
  /\b([a-z]{1,8})\s+(\d{1,3}[a-z]?)\s+lt\s+(\d{1,4}[a-z]?)\b/;
const ROOM_LOCATION_PATTERN =
  /\b(?:ruang|kelas|lab|laboratorium)\s+([a-z]{1,8}\s+\d{1,4}[a-z]?|\d{1,4}[a-z]?|[a-z]{1,6})\b/;
const TITLE_STOPWORDS = new Set([
  "di",
  "yang",
  "dan",
  "ada",
  "ke",
  "dengan",
  "untuk",
  "pada",
  "atau",
  "dari",
  "itu",
  "ini",
]);

export const normalizeBaseDuplicateText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeDuplicateTitleText = (value: string) =>
  normalizeBaseDuplicateText(value)
    .replace(/\b(lantai|tingkat)\b/g, "lt")
    .replace(/\b(ruangan|room|rm)\b/g, "ruang")
    .replace(/([a-z])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLocationText = (value: string) =>
  normalizeBaseDuplicateText(value)
    .replace(/\b(lantai|tingkat)\b/g, "lt")
    .replace(/\b(ruangan|room|rm)\b/g, "ruang")
    .replace(/\b(gedung|gdg|blok|block)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const uniqueTokens = (tokens: string[]) => [...new Set(tokens.filter(Boolean))];

const tokenizeNormalizedTitle = (judul: string) =>
  normalizeDuplicateTitleText(judul)
    .split(" ")
    .filter(Boolean);

const filterTitleTokens = (tokens: string[], locationKeyPart: string) => {
  const locationTokenCounts = new Map<string, number>();

  locationKeyPart
    .split(" ")
    .filter(Boolean)
    .forEach((token) => {
      locationTokenCounts.set(token, (locationTokenCounts.get(token) ?? 0) + 1);
    });

  const filteredTokens: string[] = [];

  for (const token of tokens) {
    if (TITLE_STOPWORDS.has(token)) {
      continue;
    }

    const remainingLocationCount = locationTokenCounts.get(token) ?? 0;

    if (remainingLocationCount > 0) {
      locationTokenCounts.set(token, remainingLocationCount - 1);
      continue;
    }

    filteredTokens.push(token);
  }

  const uniqueFilteredTokens = uniqueTokens(filteredTokens);

  if (uniqueFilteredTokens.length > 0) {
    return uniqueFilteredTokens;
  }

  return uniqueTokens(tokens.filter((token) => !TITLE_STOPWORDS.has(token)));
};

export const extractLocationKey = ({
  judul,
  deskripsi = "",
}: Pick<ReportDuplicateTextInput, "judul" | "deskripsi">) => {
  const source = normalizeLocationText(`${judul} ${deskripsi}`);

  const buildingMatch = source.match(BUILDING_LOCATION_PATTERN);

  if (buildingMatch) {
    return `${buildingMatch[1]} ${buildingMatch[2]} lt ${buildingMatch[3]}`.trim();
  }

  const roomMatch = source.match(ROOM_LOCATION_PATTERN);

  if (roomMatch) {
    return `ruang ${roomMatch[1]}`.replace(/\s+/g, " ").trim();
  }

  return "";
};

export const buildReportDuplicateSignals = ({
  kategori,
  judul,
  deskripsi = "",
}: ReportDuplicateTextInput): ReportDuplicateSignals => {
  const categoryKey = normalizeBaseDuplicateText(kategori);
  const locationKeyPart = extractLocationKey({ judul, deskripsi });
  const titleTokens = filterTitleTokens(
    tokenizeNormalizedTitle(judul),
    locationKeyPart,
  );
  const titleKey = [categoryKey, ...titleTokens].filter(Boolean).join(" ").trim();
  const locationKey = locationKeyPart
    ? [categoryKey, locationKeyPart].filter(Boolean).join(" ").trim()
    : "";

  return {
    categoryKey,
    duplicateKey: titleKey,
    titleKey,
    locationKey,
    titleTokens,
  };
};

export const calculateTitleSimilarity = (
  leftTokens: string[],
  rightTokens: string[],
) => {
  const leftSet = new Set(uniqueTokens(leftTokens));
  const rightSet = new Set(uniqueTokens(rightTokens));

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersectionCount = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersectionCount += 1;
    }
  }

  const unionCount = new Set([...leftSet, ...rightSet]).size;

  return unionCount > 0 ? intersectionCount / unionCount : 0;
};

export const buildReportDuplicateKey = (input: ReportDuplicateTextInput) =>
  buildReportDuplicateSignals(input).duplicateKey;
