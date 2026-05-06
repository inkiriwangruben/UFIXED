export type Kategori = "IT" | "Non-IT";
export type Priority = "low" | "medium" | "high" | "critical";
export type ReportPriority = Priority | "";
export type DuplicateSource =
  | "text"
  | "image"
  | "text+image"
  | "title"
  | "location"
  | "title+location"
  | "title+image"
  | "location+image"
  | "title+location+image";
export type UnitTarget = "department-it" | "tukang";
export type WorkflowStage =
  | "admin_review"
  | "unit_review"
  | "business_office_review"
  | "unit_repair"
  | "done"
  | "rejected";
export type WorkflowState =
  | "submitted"
  | "admin_approved"
  | "unit_approved"
  | "bo_approved"
  | "repairing"
  | "completed"
  | "rejected";

export interface ReportPhoto {
  url: string;
  fileId?: string;
  filePath?: string;
  name?: string;
  thumbnailUrl?: string;
  fingerprint?: string;
}

export interface WorkflowReport {
  id: string;
  title: string;
  description: string;
  kategori: Kategori;
  priority: ReportPriority;
  icon: "monitor" | "tools";
  author: string;
  authorUid?: string;
  date: string;
  status: string;
  workflowStage: WorkflowStage;
  workflowState: WorkflowState;
  unitTarget: UnitTarget;
  duplicateKey?: string;
  duplicateTitleKey?: string;
  duplicateLocationKey?: string;
  isDuplicate: boolean;
  duplicateOfReportId?: string;
  duplicateSource?: DuplicateSource;
  photoFingerprints?: string[];
  rejectionReason?: string;
  rejectedByRole?: string;
  photos: ReportPhoto[];
  createdAtValue?: number | null;
  approvedByAdminAtValue?: number | null;
  approvedByUnitAtValue?: number | null;
  approvedByBusinessOfficeAtValue?: number | null;
  repairStartedAtValue?: number | null;
  completedAtValue?: number | null;
  updatedAtValue?: number | null;
  duplicateCheckedAtValue?: number | null;
}

export const getUnitTargetFromKategori = (kategori: Kategori): UnitTarget =>
  kategori === "IT" ? "department-it" : "tukang";

export const getUnitLabel = (unitTarget: UnitTarget) =>
  unitTarget === "department-it" ? "Department IT" : "Tukang";

export const getWorkflowDefaults = (kategori: Kategori) => ({
  status: "menunggu",
  workflowStage: "admin_review" as WorkflowStage,
  workflowState: "submitted" as WorkflowState,
  unitTarget: getUnitTargetFromKategori(kategori),
});

const getDateFromTimestamp = (value: any): Date | null => {
  const maybeDate =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;

  return maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime())
    ? maybeDate
    : null;
};

export const formatTimelineDate = (value?: number | null) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeLegacyWorkflow = (
  data: Record<string, any>,
): { workflowStage: WorkflowStage; workflowState: WorkflowState; status: string } => {
  const status = (data.status as string) || "menunggu";
  const actionState = (data.actionState as string) || "";

  if (status === "ditolak" || actionState === "rejected") {
    return {
      workflowStage: "rejected",
      workflowState: "rejected",
      status: "ditolak",
    };
  }

  if (status === "selesai" || actionState === "completed") {
    return {
      workflowStage: "done",
      workflowState: "completed",
      status: "selesai",
    };
  }

  if (actionState === "repairing") {
    return {
      workflowStage: "unit_repair",
      workflowState: "repairing",
      status: "diproses",
    };
  }

  if (actionState === "accepted") {
    return {
      workflowStage: "business_office_review",
      workflowState: "unit_approved",
      status: "diproses",
    };
  }

  if (status === "verifikasi") {
    return {
      workflowStage: "unit_review",
      workflowState: "admin_approved",
      status: "diproses",
    };
  }

  return {
    workflowStage: "admin_review",
    workflowState: "submitted",
    status: status === "menunggu" ? "menunggu" : "diproses",
  };
};

export const normalizeWorkflowReport = (
  id: string,
  data: Record<string, any>,
): WorkflowReport => {
  const legacy = normalizeLegacyWorkflow(data);
  const kategori = (data.kategori as Kategori) || "IT";
  const workflowStage = (data.workflowStage as WorkflowStage) || legacy.workflowStage;
  const workflowState = (data.workflowState as WorkflowState) || legacy.workflowState;
  const status = (data.status as string) || legacy.status;
  const unitTarget =
    (data.unitTarget as UnitTarget) || getUnitTargetFromKategori(kategori);
  const createdAt = getDateFromTimestamp(data.createdAt);
  const approvedByAdminAt = getDateFromTimestamp(data.approvedByAdminAt);
  const approvedByUnitAt = getDateFromTimestamp(data.approvedByUnitAt);
  const approvedByBusinessOfficeAt = getDateFromTimestamp(
    data.approvedByBusinessOfficeAt,
  );
  const repairStartedAt = getDateFromTimestamp(data.repairStartedAt);
  const completedAt = getDateFromTimestamp(data.completedAt);
  const updatedAt = getDateFromTimestamp(data.updatedAt);
  const duplicateCheckedAt = getDateFromTimestamp(data.duplicateCheckedAt);
  const duplicateSource =
    typeof data.duplicateSource === "string" &&
    [
      "text",
      "image",
      "text+image",
      "title",
      "location",
      "title+location",
      "title+image",
      "location+image",
      "title+location+image",
    ].includes(data.duplicateSource)
      ? (data.duplicateSource as DuplicateSource)
      : undefined;

  return {
    id,
    title: data.judul || data.title || "",
    description: data.deskripsi || data.description || "",
    kategori,
    priority: (data.priority as Priority) || "",
    icon: kategori === "IT" ? "monitor" : "tools",
    author:
      data.authorName || data.author || data.authorEmail || data.email || "Unknown",
    authorUid: data.authorUid,
    date: createdAt?.toLocaleDateString("id-ID") || "",
    status,
    workflowStage,
    workflowState,
    unitTarget,
    duplicateKey:
      typeof data.duplicateKey === "string" ? data.duplicateKey : undefined,
    duplicateTitleKey:
      typeof data.duplicateTitleKey === "string"
        ? data.duplicateTitleKey
        : undefined,
    duplicateLocationKey:
      typeof data.duplicateLocationKey === "string"
        ? data.duplicateLocationKey
        : undefined,
    isDuplicate: data.isDuplicate === true,
    duplicateOfReportId:
      typeof data.duplicateOfReportId === "string"
        ? data.duplicateOfReportId
        : undefined,
    duplicateSource,
    rejectionReason: data.rejectionReason,
    rejectedByRole: data.rejectedByRole,
    photos: Array.isArray(data.photos)
      ? data.photos
          .filter((photo: ReportPhoto | null | undefined) => photo?.url)
          .map((photo) => ({
            url: photo!.url,
            fileId: typeof photo?.fileId === "string" ? photo.fileId : undefined,
            filePath:
              typeof photo?.filePath === "string" ? photo.filePath : undefined,
            name: typeof photo?.name === "string" ? photo.name : undefined,
            thumbnailUrl:
              typeof photo?.thumbnailUrl === "string"
                ? photo.thumbnailUrl
                : undefined,
            fingerprint:
              typeof photo?.fingerprint === "string"
                ? photo.fingerprint
                : undefined,
          }))
      : [],
    photoFingerprints: Array.isArray(data.photoFingerprints)
      ? data.photoFingerprints.filter(
          (fingerprint: string | null | undefined): fingerprint is string =>
            typeof fingerprint === "string" && fingerprint.trim().length > 0,
        )
      : [],
    createdAtValue: createdAt?.getTime() ?? null,
    approvedByAdminAtValue: approvedByAdminAt?.getTime() ?? null,
    approvedByUnitAtValue: approvedByUnitAt?.getTime() ?? null,
    approvedByBusinessOfficeAtValue:
      approvedByBusinessOfficeAt?.getTime() ?? null,
    repairStartedAtValue: repairStartedAt?.getTime() ?? null,
    completedAtValue: completedAt?.getTime() ?? null,
    updatedAtValue: updatedAt?.getTime() ?? null,
    duplicateCheckedAtValue: duplicateCheckedAt?.getTime() ?? null,
  };
};

export const getPelaporStatusLabel = (
  workflowStage: WorkflowStage,
  workflowState: WorkflowState,
) => {
  if (workflowStage === "admin_review") return "Menunggu Admin";
  if (workflowStage === "unit_review") return "Menunggu Unit";
  if (workflowStage === "business_office_review") return "Menunggu Business Office";
  if (workflowStage === "unit_repair" && workflowState === "repairing") {
    return "Sedang Diperbaiki";
  }
  if (workflowStage === "unit_repair") return "Menunggu Diperbaiki";
  if (workflowStage === "done") return "Selesai";
  return "Ditolak";
};

export const getPelaporProgressBucket = (
  workflowStage: WorkflowStage,
): "proses" | "selesai" => (workflowStage === "done" ? "selesai" : "proses");

export const getWorkflowStageLabel = (
  workflowStage: WorkflowStage,
  workflowState: WorkflowState,
) => {
  if (workflowStage === "unit_repair" && workflowState === "repairing") {
    return "Perbaikan Berjalan";
  }

  switch (workflowStage) {
    case "admin_review":
      return "Review Admin";
    case "unit_review":
      return "Review Unit";
    case "business_office_review":
      return "Review Business Office";
    case "unit_repair":
      return "Menunggu Perbaikan";
    case "done":
      return "Selesai";
    case "rejected":
    default:
      return "Ditolak";
  }
};
