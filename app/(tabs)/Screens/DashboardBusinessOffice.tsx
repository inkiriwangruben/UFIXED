import { formatPriorityLabel } from "@/app/utils/priority";
import {
    normalizeWorkflowReport,
    type WorkflowStage,
    type WorkflowState,
} from "@/app/utils/workflow";
import { db } from "@/lib/firebase";
import { LOGIN_ROUTE, signOutCurrentUser } from "@/lib/session";
import { resolveReportAuthorName } from "@/lib/user-profile";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
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

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "laporan"),
      (querySnapshot) => {
        void (async () => {
          const reports = (
            await Promise.all(
              querySnapshot.docs.map(async (reportDoc) => {
                const data = normalizeWorkflowReport(reportDoc.id, reportDoc.data());

                if (
                  !["business_office_review", "unit_repair", "done"].includes(
                    data.workflowStage,
                  )
                ) {
                  return null;
                }

                return {
                  id: data.id,
                  title: data.title,
                  description: data.description,
                  // classify as 'selesai' only when workflowStage === 'done'
                  tabStatus: data.workflowStage === "done" ? "selesai" : "approved",
                  priority: data.priority || "medium",
                  icon: data.icon,
                  date: data.date,
                  author: await resolveReportAuthorName({
                    author: data.author,
                    authorUid: data.authorUid,
                  }),
                  authorUid: data.authorUid,
                  workflowStage: data.workflowStage,
                  workflowState: data.workflowState,
                } as BusinessOfficeReport;
              }),
            )
          ).filter(
            (item): item is BusinessOfficeReport => item !== null,
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
      approved: visibleLaporan.filter((item) => item.workflowStage === "business_office_review")
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
      console.error("Error signing out business office:", error);
    } finally {
      router.replace(LOGIN_ROUTE);
    }
  };

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
              onPress={handleLogout}
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
            </TouchableOpacity>
          ))}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
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
