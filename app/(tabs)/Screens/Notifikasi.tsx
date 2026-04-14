import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { LOGIN_ROUTE } from "@/lib/session";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

import ScreenLoader from "@/components/ui/ScreenLoader";

type NotifStatus =
  | "diverifikasi"
  | "dimulai"
  | "terverifikasi"
  | "selesai"
  | "ditolak";

interface NotifikasiItem {
  id: string;
  title: string;
  description: string;
  status: NotifStatus;
  date: string;
  time: string;
  updatedAtValue: number;
}

const NotifikasiScreen: React.FC = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotifikasiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user.uid);
      } else {
        setCurrentUser(null);
        setLoading(false);
        router.replace(LOGIN_ROUTE);
      }

      setAuthResolved(true);
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!authResolved) return;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "notifications"), where("userUid", "==", currentUser));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const notifs: NotifikasiItem[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date();
          notifs.push({
            id: doc.id,
            title: data.title || "Notifikasi",
            description: data.description || "",
            status: (data.status as NotifStatus) || "diverifikasi",
            date: updatedAt.toLocaleDateString("id-ID"),
            time: updatedAt.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            updatedAtValue: updatedAt.getTime(),
          });
        });

        notifs.sort((a, b) => b.updatedAtValue - a.updatedAtValue);

        setNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        Alert.alert("Error", "Gagal memuat notifikasi");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [authResolved, currentUser]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/Screens/DashboardPelapor");
    }
  };

  const getStatusStyle = (status: NotifStatus) => {
    if (status === "dimulai") {
      return {
        iconName: "progress-clock",
        iconColor: "#2563EB",
        borderColor: "#DBEAFE",
        dotColor: "#2563EB",
      };
    }

    // semua status hijau
    return {
      iconName: "check-decagram-outline",
      iconColor: "#16A34A",
      borderColor: "#DCFCE7",
      dotColor: "#16A34A",
    };
  };

  if (loading) {
    return (
      <ScreenLoader
        message="Memuat notifikasi..."
        accentColor="#7C3AED"
        backgroundColor="#FFFFFF"
      />
    );
  }

  const jumlahBaru = notifications.filter(
    (n) => n.status === "diverifikasi" || n.status === "ditolak",
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={28} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifikasi</Text>
          <Text style={styles.headerSubtitle}>
            {jumlahBaru} notifikasi baru
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.bellWrapper}>
            <Feather name="bell" size={18} color="#1E5BFF" />
            <View style={styles.bellDot} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="bell-off" size={28} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Belum ada notifikasi</Text>
            <Text style={styles.emptySubtitle}>
              Notifikasi dari proses laporan akan tampil di sini.
            </Text>
          </View>
        ) : (
          notifications.map((item, index) => {
            const stylesStatus = getStatusStyle(item.status);
            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  { borderColor: stylesStatus.borderColor },
                  index === 0 && styles.cardFirst,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.statusIconWrapper}>
                    <MaterialCommunityIcons
                      name={stylesStatus.iconName as any}
                      size={20}
                      color={stylesStatus.iconColor}
                    />
                  </View>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardTime}>
                      {item.date}, {item.time}
                    </Text>
                  </View>
                  {index < jumlahBaru && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 8,
  },
  bellWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  emptyCard: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardFirst: {
    marginTop: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  cardTime: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    marginLeft: 8,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#374151",
    marginTop: 4,
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

export default NotifikasiScreen;
