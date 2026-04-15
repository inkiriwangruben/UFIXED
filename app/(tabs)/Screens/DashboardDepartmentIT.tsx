import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";
import { LOGIN_ROUTE, signOutCurrentUser } from "@/lib/session";
import { resolveReportAuthorName } from "@/lib/user-profile";
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
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

import BlockingLoader from "@/components/ui/BlockingLoader";
import ScreenLoader from "@/components/ui/ScreenLoader";

type DepartmentITTab = "semua" | "proses" | "selesai";

interface DepartmentITReport {
  id: string;
  title: string;
  description: string;
  tabStatus: Exclude<DepartmentITTab, "semua">;
  priority: string;
  icon: "monitor";
  date: string;
  author: string;
  workflowStage: WorkflowStage;
  workflowState: WorkflowState;
  authorUid?: string;
}

const DashboardDepartmentIT: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DepartmentITTab>("semua");
  const [laporanList, setLaporanList] = useState<DepartmentITReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    const reportsQuery = query(
      collection(db, "laporan"),
      where("unitTarget", "==", "department-it"),
    );
    const unsubscribe = onSnapshot(
      reportsQuery,
      (querySnapshot) => {
        void (async () => {
          const reports = (
            await Promise.all(
              querySnapshot.docs.map(async (reportDoc) => {
                const data = normalizeWorkflowReport(reportDoc.id, reportDoc.data());

                if (
                  data.unitTarget !== "department-it" ||
                  ![
                    "unit_review",
                    "business_office_review",
                    "unit_repair",
                    "done",
                  ].includes(data.workflowStage)
                ) {
                  return null;
                }

                return {
                  id: data.id,
                  title: data.title,
                  description: data.description,
                  tabStatus: data.workflowStage === "done" ? "selesai" : "proses",
                  priority: data.priority || "medium",
                  icon: "monitor",
                  date: data.date,
                  author: await resolveReportAuthorName({
                    author: data.author,
                    authorUid: data.authorUid,
                  }),
                  authorUid: data.authorUid,
                  workflowStage: data.workflowStage,
                  workflowState: data.workflowState,
                } as DepartmentITReport;
              }),
            )
          ).filter(
            (item): item is DepartmentITReport => item !== null,
          );

          if (!isActive) {
            return;
          }

          setLaporanList(reports);
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

    return visibleLaporan.filter((item) => item.tabStatus === activeTab);
  }, [activeTab, visibleLaporan]);

  const summary = useMemo(
    () => ({
      semua: visibleLaporan.length,
      proses: visibleLaporan.filter((item) => item.tabStatus === "proses")
        .length,
      selesai: visibleLaporan.filter((item) => item.tabStatus === "selesai")
        .length,
    }),
    [visibleLaporan],
  );

  const handleLogout = async () => {
    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error("Error signing out Department IT:", error);
    } finally {
      router.replace(LOGIN_ROUTE);
    }
  };

  const handleStartRepair = async (id: string) => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, "laporan", id), {
        workflowStage: "unit_repair",
        workflowState: "repairing",
        repairStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const selectedReport = laporanList.find((item) => item.id === id);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: id,
          title: "Perbaikan Dimulai",
          description: `Laporan '${selectedReport.title}' sedang dalam proses perbaikan.`,
          status: "dimulai",
        });
      }

      setLaporanList((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                workflowStage: "unit_repair",
                workflowState: "repairing",
              }
            : item,
        ),
      );

    } catch (error) {
      console.error("Error starting repair:", error);
      Alert.alert("Error", "Gagal memulai perbaikan");
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishRepair = async (id: string) => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, "laporan", id), {
        workflowStage: "done",
        workflowState: "completed",
        status: "selesai",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const selectedReport = laporanList.find((item) => item.id === id);
      if (selectedReport?.authorUid) {
        await createNotification({
          userUid: selectedReport.authorUid,
          reportId: id,
          title: "Laporan Selesai",
          description: `Laporan '${selectedReport.title}' telah selesai diperbaiki.`,
          status: "selesai",
        });
      }

      setLaporanList((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                tabStatus: "selesai",
                workflowStage: "done",
                workflowState: "completed",
              }
            : item,
        ),
      );

    } catch (error) {
      console.error("Error finishing repair:", error);
      Alert.alert("Error", "Gagal menyelesaikan perbaikan");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <ScreenLoader
        message="Memuat data laporan..."
        accentColor="#1E5BFF"
        backgroundColor="#F3F4F6"
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E5BFF" />
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

            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Department IT</Text>
            </View>

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
              <Text style={styles.statValue}>{summary.proses}</Text>
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
                activeTab === "proses" && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab("proses")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "proses" && styles.tabTextActive,
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
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/Screens/DetailLaporan",
                  params: {
                    id: item.id,
                    workflowSource: "unit",
                    returnPath: "/(tabs)/Screens/DashboardDepartmentIT",
                  },
                })
              }
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View style={styles.reportIconCircle}>
                    <Feather name={item.icon} size={16} color="#1E40AF" />
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

              <View style={styles.reportMetaRow}>
                <View style={styles.reportMetaGroup}>
                  <View style={[styles.reportMetaItem, styles.reportMetaItemAuthor]}>
                    <Feather name="user" size={12} color="#6B7280" />
                    <Text style={styles.reportMetaText} numberOfLines={1}>
                      {item.author}
                    </Text>
                  </View>

                  <View style={[styles.reportMetaItem, styles.reportMetaItemDate]}>
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

              {activeTab === "proses" &&
                item.tabStatus === "proses" &&
                item.workflowStage === "unit_repair" &&
                item.workflowState === "bo_approved" && (
                <View style={styles.singleActionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonRepair}
                    activeOpacity={0.9}
                    onPress={() => handleStartRepair(item.id)}
                    disabled={updating}
                  >
                    <Feather name="tool" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Mulai Perbaikan</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === "proses" &&
                item.tabStatus === "proses" &&
                item.workflowStage === "unit_repair" &&
                item.workflowState === "repairing" && (
                <View style={styles.singleActionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonComplete}
                    activeOpacity={0.9}
                    onPress={() => handleFinishRepair(item.id)}
                    disabled={updating}
                  >
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Selesai</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
      <BlockingLoader
        visible={updating}
        message="Memperbarui status perbaikan..."
        detail="Status laporan sedang disimpan."
        accentColor="#1E5BFF"
      />
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
    backgroundColor: "#1E5BFF",
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 56,
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
  headerTitleGroup: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#DBEAFE",
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
    backgroundColor: "#3B82F6",
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
    marginTop: 2,
    fontSize: 12,
    color: "#DBEAFE",
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 20,
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
    backgroundColor: "#1E5BFF",
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
  reportTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  reportDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 12,
  },
  reportMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  reportMetaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  reportMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  reportMetaItemAuthor: {
    flex: 1,
  },
  reportMetaItemDate: {
    flexShrink: 0,
  },
  reportMetaText: {
    marginLeft: 4,
    fontSize: 11,
    color: "#6B7280",
    flexShrink: 1,
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
  singleActionRow: {
    marginTop: 10,
  },
  actionButtonRepair: {
    backgroundColor: "#EA580C",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionButtonComplete: {
    backgroundColor: "#16A34A",
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

export default DashboardDepartmentIT;
