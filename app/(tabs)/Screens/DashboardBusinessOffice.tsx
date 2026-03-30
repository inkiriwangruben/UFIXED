import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";
import { formatPriorityLabel } from "@/app/utils/priority";
import {
  normalizeWorkflowReport,
  type WorkflowStage,
  type WorkflowState,
} from "@/app/utils/workflow";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";

type BusinessOfficeTab = "semua" | "approved" | "selesai";

interface BusinessOfficeReport {
  id: string;
  title: string;
  description: string;
  tabStatus: Exclude<BusinessOfficeTab, "semua">;
  priority: string;
  icon: "monitor" | "tools";
  date: string;
  author: string;
  workflowStage: WorkflowStage;
  workflowState: WorkflowState;
  authorUid?: string;
}

const DashboardBusinessOffice: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BusinessOfficeTab>("semua");
  const [laporanList, setLaporanList] = useState<BusinessOfficeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "laporan"),
      (querySnapshot) => {
        const reports: BusinessOfficeReport[] = [];

        querySnapshot.forEach((doc) => {
          const data = normalizeWorkflowReport(doc.id, doc.data());
          if (
            !["business_office_review", "unit_repair", "done"].includes(
              data.workflowStage,
            )
          ) {
            return;
          }
          reports.push({
            id: data.id,
            title: data.title,
            description: data.description,
            tabStatus:
              data.workflowStage === "business_office_review" ? "approved" : "selesai",
            priority: data.priority || "medium",
            icon: data.icon,
            date: data.date,
            author: data.author || "",
            authorUid: data.authorUid,
            workflowStage: data.workflowStage,
            workflowState: data.workflowState,
          });
        });

        setLaporanList(reports);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching reports:", error);
        Alert.alert("Error", "Gagal memuat data laporan");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const visibleLaporan = useMemo(
    () => laporanList,
    [laporanList],
  );

  const filteredLaporan = useMemo(() => {
    if (activeTab === "semua") {
      return visibleLaporan;
    }

    return visibleLaporan.filter((item) => item.tabStatus === activeTab);
  }, [activeTab, visibleLaporan]);

  const summary = useMemo(
    () => ({
      semua: visibleLaporan.length,
      approved: visibleLaporan.filter((item) => item.workflowStage === "business_office_review")
        .length,
      selesai: visibleLaporan.filter((item) => item.tabStatus === "selesai")
        .length,
    }),
    [visibleLaporan],
  );

  const handleAcceptReport = async (id: string) => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, "laporan", id), {
        workflowStage: "unit_repair",
        workflowState: "bo_approved",
        approvedByBusinessOfficeAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const selectedReport = laporanList.find((item) => item.id === id);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: id,
          title: "Laporan Disetujui Business Office",
          description: `Laporan '${selectedReport.title}' telah disetujui Business Office dan dikirim ke unit untuk diperbaiki.`,
          status: "terverifikasi",
        });
      }

      setLaporanList((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                tabStatus: "selesai",
                workflowStage: "unit_repair",
                workflowState: "bo_approved",
              }
            : item,
        ),
      );
      Alert.alert("Berhasil", "Laporan disetujui dan dikirim ke unit.");
    } catch (error) {
      console.error("Error accepting BO approval:", error);
      Alert.alert("Error", "Gagal menyetujui laporan");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenRejectModal = (id: string) => {
    setSelectedRejectId(id);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleCloseRejectModal = () => {
    setShowRejectModal(false);
    setSelectedRejectId(null);
    setRejectReason("");
  };

  const handleSubmitRejectReason = async () => {
    if (!selectedRejectId || !rejectReason.trim()) return;

    try {
      setUpdating(true);
      const cleanedReason = rejectReason.trim();
      await updateDoc(doc(db, "laporan", selectedRejectId), {
        workflowStage: "rejected",
        workflowState: "rejected",
        status: "ditolak",
        rejectionReason: cleanedReason,
        rejectedByRole: "business-office",
        updatedAt: serverTimestamp(),
      });

      const selectedReport = laporanList.find((item) => item.id === selectedRejectId);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: selectedRejectId,
          title: "Laporan Ditolak",
          description: `Laporan '${selectedReport.title}' ditolak oleh Business Office. ${cleanedReason}`,
          status: "ditolak",
        });
      }

      setLaporanList((prev) => prev.filter((item) => item.id !== selectedRejectId));
      Alert.alert("Berhasil", "Laporan ditolak.");
      handleCloseRejectModal();
    } catch (error) {
      console.error("Error rejecting BO approval:", error);
      Alert.alert("Error", "Gagal menolak laporan");
    } finally {
      setUpdating(false);
    }
  };

  const isRejectDisabled = !rejectReason.trim();

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#08A63A" />
        <Text style={styles.loadingText}>Memuat data laporan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#08A63A" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/(tabs)/Screens/LoginScreen")}
            >
              <Feather name="arrow-left" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bussines Office</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="file-text" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>{summary.semua}</Text>
              <Text style={styles.statLabel}>Semua</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>{summary.approved}</Text>
              <Text style={styles.statLabel}>Laporan</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="check-circle" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>{summary.selesai}</Text>
              <Text style={styles.statLabel}>Selesai</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "semua" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("semua")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "semua" && styles.tabTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "approved" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("approved")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "approved" && styles.tabTextActive,
                ]}
              >
                Laporan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "selesai" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("selesai")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "selesai" && styles.tabTextActive,
                ]}
              >
                Selesai
              </Text>
            </TouchableOpacity>
          </View>

          {filteredLaporan.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.reportCard, index > 0 && styles.reportCardSpacing]}
              activeOpacity={0.92}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/Screens/DetailLaporan",
                  params: {
                    id: item.id,
                    workflowSource: "business-office",
                    returnPath: "/(tabs)/Screens/DashboardBusinessOffice",
                  },
                })
              }
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View
                    style={[
                      styles.reportIconCircle,
                      item.icon === "tools" && styles.reportIconCircleOrange,
                    ]}
                  >
                    {item.icon === "monitor" ? (
                      <Feather name="monitor" size={16} color="#1E40AF" />
                    ) : (
                      <Feather name="tool" size={16} color="#F97316" />
                    )}
                  </View>
                  <Text style={styles.reportTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </View>

              <Text style={styles.reportDescription} numberOfLines={3}>
                {item.description}
              </Text>

              <View style={styles.reportFooterRow}>
                <View style={styles.reportMetaRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={styles.reportMetaItem}>
                      <Feather name="user" size={12} color="#6B7280" />
                      <Text style={styles.reportMetaText}>{item.author}</Text>
                    </View>
                    <View style={styles.reportMetaItem}>
                      <Feather name="calendar" size={12} color="#6B7280" />
                      <Text style={styles.reportMetaText}>{item.date}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor:
                          item.priority === "critical"
                            ? "#FEF2F2"
                            : item.priority === "high"
                              ? "#FFF7ED"
                              : item.priority === "medium"
                                ? "#EFF6FF"
                                : "#F0FDF4",
                        borderColor:
                          item.priority === "critical"
                            ? "#EF4444"
                            : item.priority === "high"
                              ? "#F97316"
                              : item.priority === "medium"
                                ? "#3B82F6"
                                : "#22C55E",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        {
                          color:
                            item.priority === "critical"
                              ? "#B91C1C"
                              : item.priority === "high"
                                ? "#C2410C"
                                : item.priority === "medium"
                                  ? "#1D4ED8"
                                  : "#15803D",
                        },
                      ]}
                    >
                      {formatPriorityLabel(item.priority)}
                    </Text>
                  </View>
                </View>
              </View>

              {activeTab === "approved" && item.workflowStage === "business_office_review" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonAccept}
                    activeOpacity={0.9}
                    onPress={() => handleAcceptReport(item.id)}
                    disabled={updating}
                  >
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Setujui</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButtonReject}
                    activeOpacity={0.9}
                    onPress={() => handleOpenRejectModal(item.id)}
                    disabled={updating}
                  >
                    <Feather name="x-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {showRejectModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tolak Laporan</Text>
            <Text style={styles.modalSubtitle}>
              Masukkan alasan penolakan Business Office untuk pelapor.
            </Text>

            <TextInput
              style={styles.modalTextArea}
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
                style={[
                  styles.modalRejectButton,
                  isRejectDisabled && styles.modalRejectButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleSubmitRejectReason}
                disabled={isRejectDisabled || updating}
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
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: "#08A63A",
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 50,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 40,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: "#E8FFEE",
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    borderRadius: 15,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: {
    backgroundColor: "#08A63A",
  },
  tabText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    textAlign: "center",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  reportCardSpacing: {
    marginTop: 12,
  },
  reportHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  reportIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  reportIconCircleOrange: {
    backgroundColor: "#FFF1E7",
  },
  reportTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  reportDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#374151",
    marginBottom: 12,
  },
  reportFooterRow: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  reportMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  reportMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportMetaText: {
    marginLeft: 4,
    fontSize: 11,
    color: "#6B7280",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  actionButtonAccept: {
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
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
  modalTextArea: {
    marginTop: 10,
    minHeight: 105,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#FFFFFF",
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
  modalRejectButtonDisabled: {
    backgroundColor: "#EF4444",
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
  bottomSpacer: {
    height: 32,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
});

export default DashboardBusinessOffice;
