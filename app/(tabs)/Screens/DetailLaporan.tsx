import { formatPriorityLabel } from "@/app/utils/priority";
import {
  formatTimelineDate,
  getPelaporStatusLabel,
  getUnitLabel,
  normalizeWorkflowReport,
  type WorkflowReport,
} from "@/app/utils/workflow";
import { auth, db } from "@/lib/firebase";
import {
  approveReportAsAdmin,
  approveReportAsBusinessOffice,
  approveReportAsUnit,
  rejectReportAsAdmin,
  rejectReportAsBusinessOffice,
  rejectReportAsUnit,
} from "@/lib/report-workflow-mutations";
import {
  getDefaultNameFromEmail,
  getUserProfileByUid,
  type AppUserProfile,
} from "@/lib/user-profile";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type TimelineTone = "warning" | "info" | "accent" | "success";

interface TimelineItem {
  id: string;
  title: string;
  badge?: string;
  tone: TimelineTone;
  actor: string;
  role?: string;
  date: string;
}

const formatRupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

const getPriorityPalette = (priority: string) => {
  switch (priority.toLowerCase()) {
    case "critical":
      return { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" };
    case "high":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    case "medium":
      return { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" };
    default:
      return { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" };
  }
};

const getToneStyle = (tone: TimelineTone) => {
  switch (tone) {
    case "warning":
      return { bg: "#FEF3C7", text: "#A16207", icon: "clock-outline" as const };
    case "accent":
      return { bg: "#FFF1E7", text: "#EA580C", icon: "progress-clock" as const };
    case "success":
      return { bg: "#DCFCE7", text: "#166534", icon: "check-circle-outline" as const };
    default:
      return { bg: "#DBEAFE", text: "#2563EB", icon: "check-circle-outline" as const };
  }
};

const getRejectedStepIndex = (report: WorkflowReport) => {
  switch (report.rejectedByRole) {
    case "department-it":
    case "tukang":
      return 2;
    case "business-office":
      return 3;
    case "admin":
    default:
      return 1;
  }
};

const buildTimeline = (
  report: WorkflowReport,
  displayAuthorName: string,
): TimelineItem[] => {
  const unitName = getUnitLabel(report.unitTarget);
  const allSteps: TimelineItem[] = [
    {
      id: "created",
      title: "Pelapor Membuat Laporan",
      tone: "info",
      actor: displayAuthorName,
      role: "pelapor",
      date: formatTimelineDate(report.createdAtValue),
    },
    {
      id: "admin",
      title: "Admin Konfirmasi Laporan",
      badge: "Diterima Admin",
      tone: "info",
      actor: "Admin",
      date: formatTimelineDate(report.approvedByAdminAtValue),
    },
    {
      id: "unit",
      title: `${unitName} Konfirmasi Laporan`,
      badge: `Diterima ${unitName}`,
      tone: "info",
      actor: unitName,
      date: formatTimelineDate(report.approvedByUnitAtValue),
    },
    {
      id: "bo",
      title: "Business Office Konfirmasi Laporan",
      badge: "Diterima Business Office",
      tone: "info",
      actor: "Business Office",
      date: formatTimelineDate(report.approvedByBusinessOfficeAtValue),
    },
    {
      id: "repair",
      title: "Perbaikan sedang berjalan",
      badge: "Proses",
      tone: "accent",
      actor: unitName,
      date: formatTimelineDate(report.repairStartedAtValue),
    },
    {
      id: "done",
      title: "Perbaikan Selesai",
      badge: "Selesai",
      tone: "success",
      actor: unitName,
      date: formatTimelineDate(report.completedAtValue),
    },
  ];

  const currentIndexMap = {
    admin_review: 1,
    unit_review: 2,
    business_office_review: 3,
    unit_repair: report.workflowState === "repairing" ? 4 : 4,
    done: 5,
    rejected: getRejectedStepIndex(report),
  } as const;

  const lastIndex = currentIndexMap[report.workflowStage];
  const steps: TimelineItem[] = allSteps.slice(0, lastIndex + 1).map((item, index) => {
    if (index < lastIndex) return item;

    if (report.workflowStage === "admin_review") {
      return { ...item, badge: "Menunggu Admin", tone: "warning" };
    }
    if (report.workflowStage === "unit_review") {
      return { ...item, badge: `Menunggu ${unitName}`, tone: "warning" };
    }
    if (report.workflowStage === "business_office_review") {
      return { ...item, badge: "Menunggu Business Office", tone: "warning" };
    }
    if (report.workflowStage === "unit_repair" && report.workflowState === "bo_approved") {
      return { ...item, badge: "Menunggu Dikerjakan", tone: "warning" };
    }
    if (report.workflowStage === "unit_repair" && report.workflowState === "repairing") {
      return { ...item, badge: "Proses", tone: "accent" };
    }
    if (report.workflowStage === "done") {
      return { ...item, badge: "Selesai", tone: "success" };
    }
    return { ...item, badge: "Ditolak", tone: "warning" };
  });

  return steps;
};

const DetailLaporan: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [report, setReport] = useState<WorkflowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [resolvedAuthorName, setResolvedAuthorName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showUnitApproveModal, setShowUnitApproveModal] = useState(false);
  const [unitApproveCost, setUnitApproveCost] = useState("");
  const [unitApproveEstimate, setUnitApproveEstimate] = useState("");
  const [unitApproveNeedsCost, setUnitApproveNeedsCost] = useState<boolean | null>(
    null,
  );
  const [unitApproveNote, setUnitApproveNote] = useState("");
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUserProfile | null>(null);
  const [unitApprovalMeta, setUnitApprovalMeta] = useState<{
    estimatedCost?: number | null;
    estimatedWorkText?: string | null;
    needsPurchase?: boolean | null;
    unitApprovalNote?: string | null;
    approvedByUid?: string | null;
    approvedAtValue?: number | null;
  } | null>(null);

  const workflowSource = useMemo(() => {
    const raw = params.workflowSource;
    if (typeof raw === "string") {
      return raw;
    }
    if (Array.isArray(raw) && typeof raw[0] === "string") {
      return raw[0];
    }
    return undefined;
  }, [params.workflowSource]);

  useEffect(() => {
    if (!params.id || typeof params.id !== "string") {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "laporan", params.id),
      (snap) => {
        if (snap.exists()) {
          setReport(normalizeWorkflowReport(snap.id, snap.data()));
        } else {
          setReport(null);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [params.id]);

  useEffect(() => {
    let isMounted = true;

    if (!report) {
      setResolvedAuthorName("");
      return () => {
        isMounted = false;
      };
    }

    const fallbackAuthor =
      typeof report.author === "string" && report.author.includes("@")
        ? getDefaultNameFromEmail(report.author)
        : report.author;

    setResolvedAuthorName(fallbackAuthor);

    if (!report.authorUid) {
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      try {
        const profile = await getUserProfileByUid(report.authorUid!);

        if (isMounted && profile?.name) {
          setResolvedAuthorName(profile.name);
        }
      } catch (error) {
        console.error("Error resolving report author name:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [report]);

  useEffect(() => {
    let isMounted = true;
    const uid = auth.currentUser?.uid;

    if (!uid) return () => {
      isMounted = false;
    };

    void (async () => {
      try {
        const profile = await getUserProfileByUid(uid);
        if (isMounted) setCurrentUserProfile(profile);
      } catch (error) {
        console.error("Error resolving current user profile:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!report) {
      setUnitApprovalMeta(null);
      return;
    }

    const metaRef = doc(db, "laporan", report.id, "unitApproval", "meta");
    const unsubscribeMeta = onSnapshot(
      metaRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, any>;
          const approvedAt = data.approvedAt;
          const approvedAtValue =
            approvedAt && typeof approvedAt.toDate === "function"
              ? approvedAt.toDate().getTime()
              : null;

          setUnitApprovalMeta({
            estimatedCost:
              typeof data.estimatedCost === "number"
                ? data.estimatedCost
                : typeof data.estimatedCost === "string" && data.estimatedCost?.trim()
                ? Number(data.estimatedCost)
                : undefined,
            estimatedWorkText:
              typeof data.estimatedWorkText === "string"
                ? data.estimatedWorkText
                : undefined,
            needsPurchase:
              typeof data.needsPurchase === "boolean" ? data.needsPurchase : undefined,
            unitApprovalNote: typeof data.unitApprovalNote === "string" ? data.unitApprovalNote : undefined,
            approvedByUid: typeof data.approvedByUid === "string" ? data.approvedByUid : undefined,
            approvedAtValue,
          });
        } else {
          setUnitApprovalMeta(null);
        }
      },
      (err) => {
        console.error("Error fetching unit approval meta:", err);
        setUnitApprovalMeta(null);
      },
    );

    return () => unsubscribeMeta();
  }, [report?.id]);

  const canViewUnitMeta = useMemo(() => {
    const meUid = auth.currentUser?.uid;
    if (!unitApprovalMeta) return false;
    if (currentUserProfile?.role === "business-office") return true;
    if (meUid && unitApprovalMeta.approvedByUid && meUid === unitApprovalMeta.approvedByUid) return true;
    return false;
  }, [currentUserProfile, unitApprovalMeta]);

  const handleBack = () => {
    if (params.returnPath) {
      router.replace(params.returnPath as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/Screens/LoginScreen");
    }
  };

  const timeline = useMemo(
    () => (report ? buildTimeline(report, resolvedAuthorName || report.author) : []),
    [report, resolvedAuthorName],
  );

  const showWorkflowPanel = useMemo(() => {
    if (!report || !workflowSource) {
      return false;
    }
    if (workflowSource === "admin" && report.workflowStage === "admin_review") {
      return true;
    }
    if (workflowSource === "unit" && report.workflowStage === "unit_review") {
      return true;
    }
    if (
      workflowSource === "business-office" &&
      report.workflowStage === "business_office_review"
    ) {
      return true;
    }
    return false;
  }, [report, workflowSource]);

  useEffect(() => {
    if (!showWorkflowPanel) {
      setShowRejectModal(false);
      setRejectReason("");
      setShowUnitApproveModal(false);
      setUnitApproveCost("");
      setUnitApproveEstimate("");
      setUnitApproveNeedsCost(null);
      setUnitApproveNote("");
    }
  }, [showWorkflowPanel]);

  const notifyCtx = useMemo(
    () =>
      report
        ? { authorUid: report.authorUid, title: report.title }
        : { authorUid: undefined as string | undefined, title: "" },
    [report],
  );

  const rejectModalSubtitle = useMemo(() => {
    if (workflowSource === "admin") {
      return "Masukkan Alasan Penolakan Untuk Pelapor";
    }
    if (workflowSource === "business-office") {
      return "Masukkan alasan penolakan Business Office untuk pelapor.";
    }
    if (workflowSource === "unit" && report) {
      return `Masukkan alasan penolakan ${getUnitLabel(report.unitTarget)} untuk pelapor.`;
    }
    return "";
  }, [workflowSource, report]);

  const handleAcceptWorkflow = useCallback(async () => {
    if (!report || !workflowSource) {
      return;
    }
    try {
      setUpdating(true);
      if (workflowSource === "admin") {
        await approveReportAsAdmin(report.id, notifyCtx);
        Alert.alert("Berhasil", "Laporan telah diterima");
      } else if (workflowSource === "unit") {
        // For unit approvals, open a simple mobile form before sending to BO.
        setShowUnitApproveModal(true);
        setUnitApproveCost("");
        setUnitApproveEstimate("");
        setUnitApproveNeedsCost(null);
        setUnitApproveNote("");
        return;
      } else if (workflowSource === "business-office") {
        await approveReportAsBusinessOffice(report.id, notifyCtx);
        Alert.alert("Berhasil", "Laporan disetujui dan dikirim ke unit.");
      }
    } catch (error) {
      console.error("Error accepting report from detail:", error);
      Alert.alert("Error", "Gagal menerima laporan");
    } finally {
      setUpdating(false);
    }
  }, [report, workflowSource, notifyCtx]);

  const handleCloseUnitApproveModal = useCallback(() => {
    setShowUnitApproveModal(false);
    setUnitApproveCost("");
    setUnitApproveEstimate("");
    setUnitApproveNeedsCost(null);
    setUnitApproveNote("");
  }, []);

  const handleSubmitUnitApprove = useCallback(async () => {
    if (!report || !workflowSource) return;
    const note = unitApproveNote.trim();
    const estimatedWork = unitApproveEstimate.trim();
    const raw = (unitApproveCost || "").toString();
    const normalized = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
    const parsed = Number(normalized);

    if (
      !note ||
      !estimatedWork ||
      unitApproveNeedsCost === null ||
      (unitApproveNeedsCost && (!raw.trim() || Number.isNaN(parsed)))
    ) {
      Alert.alert(
        "Validasi",
        "Lengkapi biaya, estimasi pengerjaan, kebutuhan pembelian, dan catatan unit.",
      );
      return;
    }

    try {
      setUpdating(true);
      await approveReportAsUnit(report.id, notifyCtx, {
        estimatedCost: unitApproveNeedsCost ? parsed : undefined,
        estimatedWorkText: estimatedWork,
        needsPurchase: unitApproveNeedsCost,
        unitApprovalNote: note,
      });
      Alert.alert("Berhasil", "Laporan diterima dan dikirim ke Business Office.");
      handleCloseUnitApproveModal();
    } catch (error) {
      console.error("Error approving report as unit:", error);
      Alert.alert("Error", "Gagal mengirim persetujuan unit.");
    } finally {
      setUpdating(false);
    }
  }, [
    report,
    workflowSource,
    unitApproveCost,
    unitApproveEstimate,
    unitApproveNeedsCost,
    unitApproveNote,
    notifyCtx,
    handleCloseUnitApproveModal,
  ]);

  const handleOpenRejectModal = useCallback(() => {
    setRejectReason("");
    setShowRejectModal(true);
  }, []);

  const handleCloseRejectModal = useCallback(() => {
    setShowRejectModal(false);
    setRejectReason("");
  }, []);

  const handleSubmitReject = useCallback(async () => {
    if (!report || !workflowSource || !rejectReason.trim()) {
      return;
    }
    try {
      setUpdating(true);
      if (workflowSource === "admin") {
        await rejectReportAsAdmin(report.id, rejectReason, notifyCtx);
        Alert.alert("Berhasil", "Laporan telah ditolak");
      } else if (workflowSource === "unit") {
        await rejectReportAsUnit(report.id, rejectReason, report.unitTarget, notifyCtx);
        Alert.alert("Berhasil", "Laporan telah ditolak");
      } else if (workflowSource === "business-office") {
        await rejectReportAsBusinessOffice(report.id, rejectReason, notifyCtx);
        Alert.alert("Berhasil", "Laporan ditolak.");
      }
      handleCloseRejectModal();
    } catch (error) {
      console.error("Error rejecting report from detail:", error);
      Alert.alert("Error", "Gagal menolak laporan");
    } finally {
      setUpdating(false);
    }
  }, [report, workflowSource, rejectReason, notifyCtx, handleCloseRejectModal]);

  const isRejectDisabled = !rejectReason.trim();
  const isUnitApproveDisabled =
    !unitApproveNote.trim() ||
    !unitApproveEstimate.trim() ||
    unitApproveNeedsCost === null ||
    (unitApproveNeedsCost &&
      (!unitApproveCost.trim() ||
        Number.isNaN(
          Number(unitApproveCost.replace(/[^0-9.,-]/g, "").replace(/,/g, ".")),
        )));

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#1E5BFF" />
        <Text style={styles.loadingText}>Memuat detail laporan...</Text>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <Text style={styles.loadingText}>Laporan tidak ditemukan.</Text>
      </SafeAreaView>
    );
  }

  const priorityPalette = getPriorityPalette(report.priority);
  const infoDate = formatTimelineDate(report.createdAtValue);
  const displayAuthorName = resolvedAuthorName || report.author;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFCFE" />
      <Modal
        visible={Boolean(selectedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setSelectedPhotoUrl(null)}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedPhotoUrl ? (
            <Image
              source={{ uri: selectedPhotoUrl }}
              style={styles.photoModalImage}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Modal>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Detail Laporan</Text>
          <Text style={styles.headerSubtitle}>Informasi lengkap laporan</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryLeft}>
              <View
                style={[
                  styles.iconWrap,
                  report.kategori === "Non-IT" && styles.iconWrapNonIT,
                ]}
              >
                <Feather
                  name={report.icon === "monitor" ? "monitor" : "tool"}
                  size={18}
                  color={report.kategori === "IT" ? "#1D4ED8" : "#EA580C"}
                />
              </View>
            </View>
            <View style={styles.summaryBadgeRow}>
              <View
                style={[
                  styles.categoryChip,
                  report.kategori === "Non-IT" && styles.categoryChipNonIT,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    report.kategori === "Non-IT" && styles.categoryChipTextNonIT,
                  ]}
                >
                  {report.kategori}
                </Text>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: priorityPalette.bg,
                    borderColor: priorityPalette.border,
                  },
                ]}
              >
                <Text style={[styles.priorityBadgeText, { color: priorityPalette.text }]}>
                  {formatPriorityLabel(report.priority)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.summaryTitle}>{report.title}</Text>

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Feather
                name="user"
                size={16}
                color="#9CA3AF"
              />
              <Text style={styles.metaText}>{displayAuthorName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={16} color="#9CA3AF" />
              <Text style={styles.metaText}>Dibuat {infoDate}</Text>
            </View>
          </View>

          {report.rejectionReason ? (
            <View style={styles.rejectBox}>
              <Text style={styles.rejectTitle}>Alasan Penolakan</Text>
              <Text style={styles.rejectText}>{report.rejectionReason}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Deskripsi kerusakan</Text>
          <Text style={styles.sectionDescription}>{report.description}</Text>
        </View>

        {unitApprovalMeta && canViewUnitMeta ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Informasi Unit</Text>
            {unitApprovalMeta.needsPurchase !== false &&
            typeof unitApprovalMeta.estimatedCost !== "undefined" &&
            unitApprovalMeta.estimatedCost !== null ? (
              <Text style={styles.sectionDescription}>
                Perkiraan Biaya: {formatRupiah(unitApprovalMeta.estimatedCost)}
              </Text>
            ) : null}

            {unitApprovalMeta.estimatedWorkText ? (
              <Text style={[styles.sectionDescription, styles.sectionMetaSpacing]}>
                Estimasi Pengerjaan: {unitApprovalMeta.estimatedWorkText}
              </Text>
            ) : null}

            {typeof unitApprovalMeta.needsPurchase === "boolean" ? (
              <Text style={[styles.sectionDescription, styles.sectionMetaSpacing]}>
                Kebutuhan Biaya:{" "}
                {unitApprovalMeta.needsPurchase
                  ? "Perlu biaya"
                  : "Tidak perlu biaya"}
              </Text>
            ) : null}

            {unitApprovalMeta.unitApprovalNote ? (
              <View style={styles.sectionBlockSpacing}>
                <Text style={styles.subsectionTitle}>Catatan Unit</Text>
                <Text style={styles.sectionDescription}>{unitApprovalMeta.unitApprovalNote}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {report.photos.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Foto kerusakan</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoScroll}
            >
              {report.photos.map((photo, index) => (
                <TouchableOpacity
                  key={`${photo.url}-${index}`}
                  activeOpacity={0.9}
                  onPress={() => setSelectedPhotoUrl(photo.url)}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.reportPhoto}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status Laporan</Text>
          {timeline.map((item) => {
            const tone = getToneStyle(item.tone);
            return (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      item.id === timeline[timeline.length - 1]?.id && styles.timelineDotActive,
                    ]}
                  />
                  {item.id !== timeline[timeline.length - 1]?.id ? (
                    <View style={styles.timelineLine} />
                  ) : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  {item.badge ? (
                    <View style={[styles.timelineBadgePill, { backgroundColor: tone.bg }]}>
                      <MaterialCommunityIcons name={tone.icon} size={12} color={tone.text} />
                      <Text style={[styles.timelineBadge, { color: tone.text }]}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.timelineActor}>
                    {item.actor}
                    {item.role ? (
                      <Text style={styles.timelineRole}> ({item.role})</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.timelineDate}>{item.date}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {showWorkflowPanel ? (
          <View style={styles.card}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButtonVerify}
                activeOpacity={0.9}
                onPress={() => {
                  void handleAcceptWorkflow();
                }}
                disabled={updating}
              >
                <Feather name="check-circle" size={14} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Terima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonReject}
                activeOpacity={0.9}
                onPress={handleOpenRejectModal}
                disabled={updating}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRejectModal}
      >
        <View style={styles.rejectModalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tolak Laporan</Text>
            <Text style={styles.modalSubtitle}>{rejectModalSubtitle}</Text>

            <TextInput
              style={[styles.modalTextArea, styles.modalStandaloneInput]}
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Tulis alasan penolakan..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalRejectButton}
                activeOpacity={isRejectDisabled || updating ? 1 : 0.9}
                onPress={() => {
                  if (isRejectDisabled || updating) {
                    return;
                  }
                  void handleSubmitReject();
                }}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Tolak</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                activeOpacity={0.9}
                onPress={handleCloseRejectModal}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUnitApproveModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseUnitApproveModal}
      >
        <View style={styles.rejectModalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Unit</Text>
            <Text style={styles.modalSubtitle}>
              Isi ringkasan singkat sebelum laporan dikirim ke Business Office.
            </Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalFieldLabel}>Estimasi pengerjaan</Text>
              <TextInput
                style={styles.modalInput}
                value={unitApproveEstimate}
                onChangeText={setUnitApproveEstimate}
                placeholder="Contoh: 1-2 hari kerja"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalFieldLabel}>Perlu biaya?</Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[
                    styles.choiceChip,
                    unitApproveNeedsCost === true && styles.choiceChipActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => setUnitApproveNeedsCost(true)}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      unitApproveNeedsCost === true && styles.choiceChipTextActive,
                    ]}
                  >
                    Ya, perlu
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.choiceChip,
                    unitApproveNeedsCost === false && styles.choiceChipActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => {
                    setUnitApproveNeedsCost(false);
                    setUnitApproveCost("");
                  }}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      unitApproveNeedsCost === false && styles.choiceChipTextActive,
                    ]}
                  >
                    Tidak perlu
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {unitApproveNeedsCost ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalFieldLabel}>Estimasi biaya</Text>
                <TextInput
                  style={styles.modalInput}
                  value={unitApproveCost}
                  onChangeText={setUnitApproveCost}
                  placeholder="Contoh: 250000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            ) : null}

            <View style={styles.modalSection}>
              <Text style={styles.modalFieldLabel}>Catatan unit</Text>
              <TextInput
                style={styles.modalTextArea}
                multiline
                numberOfLines={4}
                value={unitApproveNote}
                onChangeText={setUnitApproveNote}
                placeholder="Tulis ringkasan kebutuhan, tindakan, atau alasan persetujuan..."
                placeholderTextColor="#9CA3AF"
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                activeOpacity={isUnitApproveDisabled || updating ? 1 : 0.9}
                onPress={() => {
                  if (isUnitApproveDisabled || updating) return;
                  void handleSubmitUnitApprove();
                }}
              >
                <Feather name="check-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Terima</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                activeOpacity={0.9}
                onPress={handleCloseUnitApproveModal}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  photoModalClose: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 16 : 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  photoModalImage: {
    width: "100%",
    height: "82%",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryLeft: {
    marginRight: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapNonIT: {
    backgroundColor: "#FFF2E8",
  },
  summaryBadgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipNonIT: {
    backgroundColor: "#FFF2E8",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730A3",
  },
  categoryChipTextNonIT: {
    color: "#C2410C",
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  metaGroup: {
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaText: {
    fontSize: 13,
    color: "#6B7280",
  },
  rejectBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
  },
  rejectTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B91C1C",
    marginBottom: 4,
  },
  rejectText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7F1D1D",
  },
  sectionTitle: {
    fontSize: 24 / 1.5,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  sectionMetaSpacing: {
    marginTop: 6,
  },
  sectionBlockSpacing: {
    marginTop: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  photoScroll: {
    gap: 12,
  },
  reportPhoto: {
    width: 180,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  timelineRail: {
    width: 22,
    alignItems: "center",
    paddingTop: 2,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#A1A1AA",
  },
  timelineDotActive: {
    backgroundColor: "#2563EB",
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: "#A1A1AA",
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  timelineBadgePill: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  timelineBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  timelineActor: {
    marginTop: 8,
    fontSize: 13,
    color: "#111827",
  },
  timelineRole: {
    color: "#9CA3AF",
  },
  timelineDate: {
    marginTop: 3,
    fontSize: 12,
    color: "#9CA3AF",
  },
  workflowActionHint: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  actionButtonVerify: {
    flex: 1,
    backgroundColor: "#16A34A",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionButtonReject: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(69, 91, 146, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
  },
  modalSection: {
    marginTop: 12,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  modalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  modalTextArea: {
    minHeight: 105,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  modalStandaloneInput: {
    marginTop: 10,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  choiceChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  choiceChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  choiceChipTextActive: {
    color: "#1D4ED8",
  },
  modalActionRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalRejectButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  modalActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default DetailLaporan;
