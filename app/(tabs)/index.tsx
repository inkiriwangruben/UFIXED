import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth } from "@/lib/firebase";
import { getDashboardRouteByRole } from "@/lib/roles";
import { LOGIN_ROUTE, signOutCurrentUser } from "@/lib/session";
import { getUserProfileByUid } from "@/lib/user-profile";

export default function EntryGateScreen() {
  const router = useRouter();
  const hasHandledNavigation = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasHandledNavigation.current) {
        return;
      }

      if (!user) {
        hasHandledNavigation.current = true;
        router.replace(LOGIN_ROUTE);
        return;
      }

      try {
        const profile = await getUserProfileByUid(user.uid);

        if (!profile) {
          hasHandledNavigation.current = true;
          await signOutCurrentUser();
          Alert.alert(
            "Akun tidak valid",
            "Profil akun tidak ditemukan atau role belum lengkap. Silakan login ulang atau hubungi admin.",
          );
          router.replace(LOGIN_ROUTE);
          return;
        }

        hasHandledNavigation.current = true;
        router.replace(getDashboardRouteByRole(profile.role));
      } catch (error) {
        console.error("Error checking current session:", error);
        hasHandledNavigation.current = true;

        try {
          await signOutCurrentUser();
        } catch (signOutError) {
          console.error("Error signing out after session check failed:", signOutError);
        }

        Alert.alert(
          "Gagal memuat sesi",
          "Terjadi masalah saat memeriksa data akun. Silakan login kembali.",
        );
        router.replace(LOGIN_ROUTE);
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logoCircle}>
          <Image
            source={require("@/assets/images/wrench.png")}
            contentFit="contain"
            style={styles.logoImage}
          />
        </View>
        <Text style={styles.title}>U-FIXED</Text>
        <Text style={styles.subtitle}>Menyiapkan sesi aplikasi...</Text>
        <ActivityIndicator size="large" color="#1E5BFF" style={styles.loader} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E9F3FF",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#1E5BFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#1D4ED8",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
  },
  loader: {
    marginTop: 24,
  },
});
