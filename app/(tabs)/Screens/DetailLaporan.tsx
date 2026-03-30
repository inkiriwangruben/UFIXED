import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "@/lib/firebase";
import { formatPriorityLabel } from "@/app/utils/priority";
import {
  getPelaporStatusLabel,
  getUnitLabel,
  getWorkflowStageLabel,
  normalizeWorkflowReport,
  type WorkflowReport,
} from "@/app/utils/workflow";

type TimelineTone = "warning" | "info" | "accent" | "success";

interface TimelineItem {
  id: string;
  title: string;
  badge: string;
  tone: TimelineTone;
  actor: string;
  role?: string;
  date: string;
}

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

const buildTimeline = (report: WorkflowReport): TimelineItem[] => {
  const unitName = getUnitLabel(report.unitTarget);
  const displayDate = report.date ? `${report.date}, 08:00` : "-";
  const allSteps: TimelineItem[] = [
    {
      id: "created",
      title: "Pelapor Membuat Laporan",
      badge: "Selesai",
      tone: "info",
      actor: report.author,
      role: "pelapor",
      date: displayDate,
    },
    {
      id: "admin",
      title: "Admin Konfirmasi Laporan",
      badge: "Selesai",
      tone: "info",
      actor: "Admin",
      date: displayDate,
    },
    {
      id: "unit",
      title: `${unitName} Konfirmasi Laporan`,
      badge: "Selesai",
      tone: "info",
      actor: unitName,
      date: displayDate,
    },
    {
      id: "bo",
      title: "Business Office Konfirmasi Laporan",
      badge: "Selesai",
      tone: "info",
      actor: "Business Office",
      date: displayDate,
    },
    {
      id: "repair",
      title: "Perbaikan sedang berjalan",
      badge: "Selesai",
      tone: "accent",
      actor: unitName,
      date: displayDate,
    },
    {
      id: "done",
      title: "Perbaikan Selesai",
      badge: "Selesai",
      tone: "success",
      actor: unitName,
      date: displayDate,
    },
  ];

  const currentIndexMap = {
    admin_review: 1,
    unit_review: 2,
    business_office_review: 3,
    unit_repair: report.workflowState === "repairing" ? 4 : 4,
    done: 5,
    rejected: report.workflowState === "submitted" ? 0 : report.workflowStage === "rejected" ? 1 : 1,
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
      return { ...item, badge: "Sedang Diperbaiki", tone: "accent" };
    }
    if (report.workflowStage === "done") {
      return { ...item, badge: "Selesai", tone: "success" };
    }
    return { ...item, badge: "Ditolak", tone: "warning" };
  });

  if (report.workflowStage === "rejected" && report.rejectionReason) {
    steps.push({
      id: "rejected",
      title: "Laporan ditolak",
      badge: "Ada alasan penolakan",
      tone: "warning",
      actor: report.rejectedByRole || "System",
      date: displayDate,
    });
  }

  return steps;
};

const DetailLaporan: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [report, setReport] = useState<WorkflowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

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

  const handleBack = () => {
    if (params.returnPath) {
      router.replace(params.returnPath as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/Screens/LoginScreen");
    }
  };

  const timeline = useMemo(() => (report ? buildTimeline(report) : []), [report]);

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
  const statusLabel = getPelaporStatusLabel(report.workflowStage, report.workflowState);
  const infoDate = report.date ? `${report.date}, 08:00` : "-";

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
          <Text style={styles.headerSubtitle}>ID : {report.id}</Text>
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
              <Text style={styles.metaText}>{report.author}</Text>
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
          <Text style={styles.sectionTitle}>Timeline Proses</Text>
          <Text style={styles.currentStatusText}>
            {getWorkflowStageLabel(report.workflowStage, report.workflowState)} / {statusLabel}
          </Text>
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
                  <View style={[styles.timelineBadgePill, { backgroundColor: tone.bg }]}>
                    <MaterialCommunityIcons name={tone.icon} size={12} color={tone.text} />
                    <Text style={[styles.timelineBadge, { color: tone.text }]}>{item.badge}</Text>
                  </View>
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
      </ScrollView>
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
  photoScroll: {
    gap: 12,
  },
  reportPhoto: {
    width: 180,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
  },
  currentStatusText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 8,
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
});

export default DetailLaporan;
