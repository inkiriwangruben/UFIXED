export type Kategori = "IT" | "Non-IT";
export type Priority = "low" | "medium" | "high" | "critical";
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
}

export interface WorkflowReport {
  id: string;
  title: string;
  description: string;
  kategori: Kategori;
  priority: Priority;
  icon: "monitor" | "tools";
  author: string;
  authorUid?: string;
  date: string;
  status: string;
  workflowStage: WorkflowStage;
  workflowState: WorkflowState;
  unitTarget: UnitTarget;
  rejectionReason?: string;
  rejectedByRole?: string;
  photos: ReportPhoto[];
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

const normalizeLegacyWorkflow = (
  data: Record<string, any>,
): { workflowStage: WorkflowStage; workflowState: WorkflowState; status: string } => {
  const status = (data.status as string) || "menunggu";
  const actionState = (data.actionState as string) || "";

  if (status === "ditolak" || actionState === "rejected") {
    return { workflowStage: "rejected", workflowState: "rejected", status: "ditolak" };
  }

  if (status === "selesai" || actionState === "completed") {
    return { workflowStage: "done", workflowState: "completed", status: "selesai" };
  }

  if (actionState === "repairing") {
    return { workflowStage: "unit_repair", workflowState: "repairing", status: "diproses" };
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

  return {
    id,
    title: data.judul || data.title || "",
    description: data.deskripsi || data.description || "",
    kategori,
    priority: (data.priority as Priority) || "medium",
    icon: kategori === "IT" ? "monitor" : "tools",
    author:
      data.author || data.authorName || data.authorEmail || data.email || "Unknown",
    authorUid: data.authorUid,
    date: data.createdAt?.toDate?.()?.toLocaleDateString("id-ID") || "",
    status,
    workflowStage,
    workflowState,
    unitTarget,
    rejectionReason: data.rejectionReason,
    rejectedByRole: data.rejectedByRole,
    photos: Array.isArray(data.photos)
      ? data.photos.filter((photo: ReportPhoto | null | undefined) => photo?.url)
      : [],
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
