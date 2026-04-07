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
import { LOGIN_ROUTE, signOutCurrentUser } from "@/lib/session";
import { resolveReportAuthorName } from "@/lib/user-profile";
import { formatPriorityLabel } from "@/app/utils/priority";
import {
  getUnitLabel,
  getWorkflowStageLabel,
  normalizeWorkflowReport,
  type UnitTarget,
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

type AdminStatus = "semua" | "pending" | "verifikasi";

interface AdminLaporan {
  id: string;
  title: string;
  description: string;
  status: AdminStatus;
  priority: string;
  icon: "monitor" | "tools";
  date: string;
  author: string;
  workflowStage: WorkflowStage;
  workflowState: WorkflowState;
  unitTarget: UnitTarget;
  authorUid?: string;
  rejectReason?: string;
}

const DashboardAdmin: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminStatus>("semua");
  const [laporanList, setLaporanList] = useState<AdminLaporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch reports from Firestore
  useEffect(() => {
    let isActive = true;
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "laporan"),
      (querySnapshot) => {
        void (async () => {
          const reports = await Promise.all(
            querySnapshot.docs.map(async (reportDoc) => {
              const data = normalizeWorkflowReport(reportDoc.id, reportDoc.data());

              return {
                id: data.id,
                title: data.title,
                description: data.description,
                status:
                  data.workflowStage === "admin_review" ? "pending" : "verifikasi",
                priority: data.priority,
                icon: data.icon,
                date: data.date,
                author: await resolveReportAuthorName({
                  author: data.author,
                  authorUid: data.authorUid,
                }),
                authorUid: data.authorUid,
                workflowStage: data.workflowStage,
                workflowState: data.workflowState,
                unitTarget: data.unitTarget,
                rejectReason: data.rejectionReason,
              } satisfies AdminLaporan;
            }),
          );

          if (!isActive) {
            return;
          }

          setLaporanList(
            reports.filter((item) =>
              [
                "admin_review",
                "unit_review",
                "business_office_review",
                "unit_repair",
                "done",
                "rejected",
              ].includes(item.workflowStage),
            ),
          );
          setLoading(false);
        })();
      },
      (error) => {
        console.error("Error fetching reports:", error);
        Alert.alert("Error", "Gagal memuat data laporan");
        setLoading(false);
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const visibleLaporan = useMemo(
    () => laporanList,
    [laporanList],
  );

  const filteredLaporan = useMemo(() => {
    if (activeTab === "semua") {
      return visibleLaporan;
    }

    if (activeTab === "pending") {
      return visibleLaporan.filter((item) => item.workflowStage === "admin_review");
    }

    return visibleLaporan.filter((item) => item.workflowStage !== "admin_review");
  }, [activeTab, visibleLaporan]);

  const summary = useMemo(
    () => ({
      semua: visibleLaporan.length,
      laporan: visibleLaporan.filter((item) => item.workflowStage === "admin_review")
        .length,
      selesai: visibleLaporan.filter((item) => item.workflowStage !== "admin_review")
        .length,
    }),
    [visibleLaporan],
  );

  const handleLogout = async () => {
    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error("Error signing out admin:", error);
    } finally {
      router.replace(LOGIN_ROUTE);
    }
  };

  const handleAcceptReport = async (id: string) => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, "laporan", id), {
        status: "diproses",
        workflowStage: "unit_review",
        workflowState: "admin_approved",
        approvedByAdminAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const selectedReport = laporanList.find((item) => item.id === id);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: id,
          title: "Laporan Diverifikasi",
          description: `Laporan '${selectedReport.title}' telah diverifikasi oleh Admin.`,
          status: "diverifikasi",
        });
      }

      // Update local state
      setLaporanList((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "verifikasi",
                workflowStage: "unit_review",
                workflowState: "admin_approved",
              }
            : item,
        ),
      );

      Alert.alert("Berhasil", "Laporan telah diterima");
    } catch (error) {
      console.error("Error accepting report:", error);
      Alert.alert("Error", "Gagal menerima laporan");
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
    if (!selectedRejectId || !rejectReason.trim()) {
      return;
    }

    try {
      setUpdating(true);
      const cleanedReason = rejectReason.trim();

      await updateDoc(doc(db, "laporan", selectedRejectId), {
        workflowStage: "rejected",
        workflowState: "rejected",
        status: "ditolak",
        rejectionReason: cleanedReason,
        rejectedByRole: "admin",
        updatedAt: serverTimestamp(),
      });

      const selectedReport = laporanList.find((item) => item.id === selectedRejectId);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: selectedRejectId,
          title: "Laporan Ditolak",
          description: `Laporan '${selectedReport.title}' ditolak oleh Admin. ${cleanedReason}`,
          status: "ditolak",
        });
      }

      // Update local state
      setLaporanList((prev) =>
        prev.map((item) =>
          item.id === selectedRejectId
            ? {
                ...item,
                workflowStage: "rejected",
                workflowState: "rejected",
                rejectReason: cleanedReason,
              }
            : item,
        ),
      );

      Alert.alert("Berhasil", "Laporan telah ditolak");
      handleCloseRejectModal();
    } catch (error) {
      console.error("Error rejecting report:", error);
      Alert.alert("Error", "Gagal menolak laporan");
    } finally {
      setUpdating(false);
    }
  };

  const isRejectDisabled = !rejectReason.trim();

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Memuat data laporan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleLogout}
            >
              <Feather name="arrow-left" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin</Text>
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
              <Text style={styles.statValue}>{summary.laporan}</Text>
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
          <View style={styles.manageUserWrapper}>
            <TouchableOpacity
              style={styles.manageUserCard}
              activeOpacity={0.9}
              onPress={() => router.push("/(tabs)/Screens/KelolaUser")}
            >
              <View style={styles.manageUserLeft}>
                <View style={styles.manageUserAvatar}>
                  <Feather name="users" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.manageUserTitle}>Kelola User</Text>
                  <Text style={styles.manageUserSubtitle}>
                    Tambah atau hapus user
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

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
                activeTab === "pending" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("pending")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "pending" && styles.tabTextActive,
                ]}
              >
                Laporan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "verifikasi" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("verifikasi")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "verifikasi" && styles.tabTextActive,
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
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/Screens/DetailLaporan",
                  params: {
                    id: item.id,
                    workflowSource: "admin",
                    returnPath: "/(tabs)/Screens/DashboardAdmin",
                  },
                })
              }
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View style={styles.reportIconCircle}>
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

              <Text style={styles.reportDescription} numberOfLines={1}>
                Tahap: {getWorkflowStageLabel(item.workflowStage, item.workflowState)} • Tujuan:{" "}
                {getUnitLabel(item.unitTarget)}
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

              {activeTab === "pending" && item.workflowStage === "admin_review" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonVerify}
                    activeOpacity={0.9}
                    onPress={() => handleAcceptReport(item.id)}
                    disabled={updating}
                  >
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Terima</Text>
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
              Masukkan Alasan Penolakan Untuk Pelapor
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
                style={styles.modalRejectButton}
                activeOpacity={isRejectDisabled || updating ? 1 : 0.9}
                onPress={() => {
                  if (isRejectDisabled || updating) {
                    return;
                  }

                  void handleSubmitRejectReason();
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
    backgroundColor: "#7C3AED",
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 90,
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
    backgroundColor: "#A855F7",
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
    color: "#F3E8FF",
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  manageUserWrapper: {
    marginTop: -40,
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  manageUserCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  manageUserLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  manageUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  manageUserTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  manageUserSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
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
    backgroundColor: "#7C3AED",
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
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  reportTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 8,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
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
    borderColor: "#C084FC",
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

export default DashboardAdmin;
