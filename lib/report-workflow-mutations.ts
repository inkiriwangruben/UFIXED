import type { UnitTarget } from "@/app/utils/workflow";
import { auth, db } from "@/lib/firebase";
import type { NotificationStatus } from "@/lib/notifications";
import { createNotification } from "@/lib/notifications";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

/** Metadata needed to notify the report author (optional if no authorUid). */
export interface WorkflowReportNotifyContext {
  authorUid?: string;
  title: string;
}

export interface UnitApprovalInput {
  estimatedCost?: number | string;
  estimatedWorkText?: string;
  needsPurchase?: boolean;
  unitApprovalNote?: string;
}

async function notifyAuthorIfPresent(
  reportId: string,
  ctx: WorkflowReportNotifyContext,
  payload: {
    title: string;
    description: string;
    status: NotificationStatus;
  },
) {
  if (!ctx.authorUid) return;
  await createNotification({
    userUid: ctx.authorUid,
    reportId,
    title: payload.title,
    description: payload.description,
    status: payload.status,
  });
}

export async function approveReportAsAdmin(
  reportId: string,
  ctx: WorkflowReportNotifyContext,
) {
  await updateDoc(doc(db, "laporan", reportId), {
    status: "diproses",
    workflowStage: "unit_review",
    workflowState: "admin_approved",
    approvedByAdminAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Laporan Diverifikasi",
    description: `Laporan '${ctx.title}' telah diverifikasi oleh Admin.`,
    status: "diverifikasi",
  });
}

export async function rejectReportAsAdmin(
  reportId: string,
  reason: string,
  ctx: WorkflowReportNotifyContext,
) {
  const cleanedReason = reason.trim();
  await updateDoc(doc(db, "laporan", reportId), {
    workflowStage: "rejected",
    workflowState: "rejected",
    status: "ditolak",
    rejectionReason: cleanedReason,
    rejectedByRole: "admin",
    updatedAt: serverTimestamp(),
  });

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Laporan Ditolak",
    description: `Laporan '${ctx.title}' ditolak oleh Admin. ${cleanedReason}`,
    status: "ditolak",
  });
}

export async function approveReportAsUnit(
  reportId: string,
  ctx: WorkflowReportNotifyContext,
  approval?: UnitApprovalInput,
) {
  const cleanedNote =
    typeof approval?.unitApprovalNote === "string"
      ? approval.unitApprovalNote.trim()
      : "";
  const cleanedEstimatedWork =
    typeof approval?.estimatedWorkText === "string"
      ? approval.estimatedWorkText.trim()
      : "";
  const costNeededValue =
    typeof approval?.needsPurchase === "boolean"
      ? approval.needsPurchase
      : undefined;
  const costValue =
    typeof approval?.estimatedCost === "number"
      ? approval.estimatedCost
      : typeof approval?.estimatedCost === "string" && approval.estimatedCost.trim()
      ? Number(approval.estimatedCost)
      : undefined;

  // Update workflow state on the main laporan document
  await updateDoc(doc(db, "laporan", reportId), {
    workflowStage: "business_office_review",
    workflowState: "unit_approved",
    approvedByUnitAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Persist unit-provided metadata to a protected subdocument so we can
  // restrict read access via security rules (only BO and approving technician)
  try {
    const metaRef = doc(db, "laporan", reportId, "unitApproval", "meta");
    await setDoc(
      metaRef,
      {
        ...(typeof costValue !== "undefined" &&
        !Number.isNaN(costValue) &&
        costNeededValue
          ? { estimatedCost: costValue }
          : {}),
        ...(cleanedEstimatedWork ? { estimatedWorkText: cleanedEstimatedWork } : {}),
        ...(typeof costNeededValue === "boolean"
          ? { needsPurchase: costNeededValue }
          : {}),
        ...(cleanedNote ? { unitApprovalNote: cleanedNote } : {}),
        approvedByUid: auth.currentUser?.uid || null,
        approvedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    // non-fatal: still continue, but log for diagnostics
    console.error("Failed to persist unit approval meta:", err);
  }

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Menunggu Business Office",
    description: `Laporan '${ctx.title}' telah disetujui unit. ${
      costNeededValue &&
      typeof costValue !== "undefined" &&
      !Number.isNaN(costValue)
        ? `Perkiraan biaya: Rp ${costValue.toLocaleString("id-ID")}. `
        : ""
    }${cleanedEstimatedWork ? `Estimasi pengerjaan: ${cleanedEstimatedWork}. ` : ""}${
      typeof costNeededValue === "boolean"
        ? costNeededValue
          ? "Perlu biaya. "
          : "Tidak perlu biaya. "
        : ""
    }${cleanedNote ? `Catatan: ${cleanedNote}` : ""}`,
    status: "terverifikasi",
  });
}

function unitRejectLabel(unitTarget: UnitTarget): string {
  return unitTarget === "department-it" ? "Department IT" : "Tukang";
}

export async function rejectReportAsUnit(
  reportId: string,
  reason: string,
  unitTarget: UnitTarget,
  ctx: WorkflowReportNotifyContext,
) {
  const cleanedReason = reason.trim();
  const rejectedByRole = unitTarget === "department-it" ? "department-it" : "tukang";
  const label = unitRejectLabel(unitTarget);

  await updateDoc(doc(db, "laporan", reportId), {
    workflowStage: "rejected",
    workflowState: "rejected",
    status: "ditolak",
    rejectionReason: cleanedReason,
    rejectedByRole,
    updatedAt: serverTimestamp(),
  });

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Laporan Ditolak",
    description: `Laporan '${ctx.title}' ditolak oleh ${label}. ${cleanedReason}`,
    status: "ditolak",
  });
}

export async function approveReportAsBusinessOffice(
  reportId: string,
  ctx: WorkflowReportNotifyContext,
) {
  await updateDoc(doc(db, "laporan", reportId), {
    workflowStage: "unit_repair",
    workflowState: "bo_approved",
    approvedByBusinessOfficeAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Laporan Disetujui Business Office",
    description: `Laporan '${ctx.title}' telah disetujui Business Office dan dikirim ke unit untuk diperbaiki.`,
    status: "terverifikasi",
  });
}

export async function rejectReportAsBusinessOffice(
  reportId: string,
  reason: string,
  ctx: WorkflowReportNotifyContext,
) {
  const cleanedReason = reason.trim();
  await updateDoc(doc(db, "laporan", reportId), {
    workflowStage: "rejected",
    workflowState: "rejected",
    status: "ditolak",
    rejectionReason: cleanedReason,
    rejectedByRole: "business-office",
    updatedAt: serverTimestamp(),
  });

  await notifyAuthorIfPresent(reportId, ctx, {
    title: "Laporan Ditolak",
    description: `Laporan '${ctx.title}' ditolak oleh Business Office. ${cleanedReason}`,
    status: "ditolak",
  });
}
