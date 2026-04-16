import { Feather } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockingLoader from "@/components/ui/BlockingLoader";
import {
  getEmailValidationMessageForRole,
  isEmailAllowedForRole,
} from "@/lib/auth-policy";
import { auth } from "@/lib/firebase";
import { syncPelaporGoogleProfile } from "@/lib/pelapor-auth-service";
import {
  LOGIN_ROLE_OPTIONS,
  getDashboardRouteByRole,
  getLoginRoleLabel,
  type CanonicalUserRole,
} from "@/lib/roles";
import {
  clearNativeGoogleSession,
  requestPasswordReset,
  signOutCurrentUser,
} from "@/lib/session";
import { getUserProfileByUid } from "@/lib/user-profile";

WebBrowser.maybeCompleteAuthSession();

type GoogleClientConfig = {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
  selectAccount: true;
};

type NativeGoogleSigninModule =
  typeof import("@react-native-google-signin/google-signin");

type PelaporAuthSessionGoogleLoginCardProps = {
  clientConfig: GoogleClientConfig;
  googleLoading: boolean;
  loginError: string;
  setGoogleLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoginError: React.Dispatch<React.SetStateAction<string>>;
};

type PelaporAndroidGoogleLoginCardProps = {
  nativeGoogleModule: NativeGoogleSigninModule;
  nativeWebClientId: string;
  googleLoading: boolean;
  loginError: string;
  setGoogleLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoginError: React.Dispatch<React.SetStateAction<string>>;
};

type PelaporGoogleUnavailableCardProps = {
  loginError: string;
  reason: "missing-config" | "expo-go" | "native-module";
};

const getInlineLoginError = (error: unknown) => {
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  if (
    errorCode === "auth/invalid-credential" ||
    errorCode === "auth/wrong-password" ||
    errorCode === "auth/user-not-found" ||
    errorCode === "auth/invalid-email"
  ) {
    return "Email atau kata sandi anda salah!";
  }

  return "";
};

const getGoogleClientIdConfig = (): GoogleClientConfig | null => {
  if (Platform.OS === "android") {
    return null;
  }

  const androidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || "";
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";

  const platformClientId =
    Platform.select({
      android: androidClientId,
      ios: iosClientId,
      default: webClientId,
    }) || "";

  if (!platformClientId) {
    return null;
  }

  return {
    ...(androidClientId ? { androidClientId } : {}),
    ...(iosClientId ? { iosClientId } : {}),
    ...(webClientId ? { webClientId } : {}),
    selectAccount: true,
  };
};

const getNativeGoogleWebClientId = () =>
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";

const getGoogleClientIdVariableName = () =>
  Platform.select({
    android: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    ios: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
    default: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  }) || "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID";

const isRunningInExpoGo = Constants.executionEnvironment === "storeClient";

const getNativeGoogleSigninModule = (): NativeGoogleSigninModule | null => {
  if (Platform.OS !== "android" || isRunningInExpoGo) {
    return null;
  }

  try {
    // We load the native module lazily so the login screen can still render in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as NativeGoogleSigninModule;
  } catch (error) {
    console.error("Native Google Sign-In module is unavailable:", error);
    return null;
  }
};

const clearPelaporGoogleSession = async () => {
  try {
    await signOutCurrentUser();
  } catch (error) {
    console.error("Error signing out Google pelapor session:", error);
  }
};

const PelaporAuthSessionGoogleLoginCard: React.FC<
  PelaporAuthSessionGoogleLoginCardProps
> = ({
  clientConfig,
  googleLoading,
  loginError,
  setGoogleLoading,
  setLoginError,
}) => {
  const router = useRouter();
  const [googleRequest, googleResponse, promptGoogleAsync] =
    Google.useIdTokenAuthRequest(clientConfig);

  useEffect(() => {
    const completePelaporGoogleLogin = async (idToken: string) => {
      try {
        setGoogleLoading(true);
        setLoginError("");

        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const googleEmail = userCredential.user.email?.trim().toLowerCase() || "";

        if (!isEmailAllowedForRole(googleEmail, "pelapor")) {
          await signOutCurrentUser();
          setLoginError(getEmailValidationMessageForRole("pelapor"));
          return;
        }

        await syncPelaporGoogleProfile();
        router.replace(getDashboardRouteByRole("pelapor"));
      } catch (error) {
        console.error("Error signing in pelapor with Google:", error);

        try {
          await signOutCurrentUser();
        } catch (signOutError) {
          console.error("Error signing out after Google login failed:", signOutError);
        }

        setLoginError(
          error instanceof Error
            ? error.message
            : "Login Google pelapor gagal. Coba lagi.",
        );
      } finally {
        setGoogleLoading(false);
      }
    };

    if (!googleResponse) {
      return;
    }

    if (googleResponse.type === "success") {
      const responseToken =
        googleResponse.authentication?.idToken ||
        (typeof googleResponse.params?.id_token === "string"
          ? googleResponse.params.id_token
          : "");

      if (!responseToken) {
        setLoginError("Google tidak mengembalikan token login yang valid.");
        return;
      }

      void completePelaporGoogleLogin(responseToken);
      return;
    }

    if (googleResponse.type === "error") {
      setLoginError("Login Google pelapor gagal. Silakan coba lagi.");
    }
  }, [googleResponse, router, setGoogleLoading, setLoginError]);

  const handleGooglePelaporLogin = async () => {
    if (!googleRequest) {
      setLoginError("Google Sign-In sedang dipersiapkan. Coba lagi sebentar.");
      return;
    }

    setLoginError("");

    try {
      await promptGoogleAsync();
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Google Sign-In gagal dijalankan.",
      );
    }
  };

  return (
    <View style={styles.googleCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.googleButton,
          (!googleRequest || googleLoading) && styles.buttonDisabled,
        ]}
        onPress={handleGooglePelaporLogin}
        disabled={!googleRequest || googleLoading}
      >
        <Feather name="chrome" size={18} color="#FFFFFF" />
        <Text style={styles.googleButtonText}>
          {googleLoading ? "Menyambungkan..." : "Masuk dengan Google"}
        </Text>
      </TouchableOpacity>
      {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
    </View>
  );
};

const PelaporAndroidGoogleLoginCard: React.FC<
  PelaporAndroidGoogleLoginCardProps
> = ({
  nativeGoogleModule,
  nativeWebClientId,
  googleLoading,
  loginError,
  setGoogleLoading,
  setLoginError,
}) => {
  const router = useRouter();

  useEffect(() => {
    nativeGoogleModule.GoogleSignin.configure({
      webClientId: nativeWebClientId,
      offlineAccess: false,
    });
  }, [nativeGoogleModule, nativeWebClientId]);

  const handleGooglePelaporLogin = async () => {
    const { GoogleSignin, isSuccessResponse } = nativeGoogleModule;

    try {
      setGoogleLoading(true);
      setLoginError("");

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      if (GoogleSignin.hasPreviousSignIn()) {
        await clearNativeGoogleSession();
      }

      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        setLoginError("");
        return;
      }

      const idToken = response.data.idToken;

      if (!idToken) {
        throw new Error("Google tidak mengembalikan token login yang valid.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const googleEmail = userCredential.user.email?.trim().toLowerCase() || "";

      if (!isEmailAllowedForRole(googleEmail, "pelapor")) {
        await clearPelaporGoogleSession();
        setLoginError(getEmailValidationMessageForRole("pelapor"));
        return;
      }

      await syncPelaporGoogleProfile();
      router.replace(getDashboardRouteByRole("pelapor"));
    } catch (error) {
      console.error("Error signing in pelapor with native Google:", error);

      if (nativeGoogleModule.isErrorWithCode(error)) {
        if (error.code === nativeGoogleModule.statusCodes.SIGN_IN_CANCELLED) {
          setLoginError("");
          return;
        }

        if (error.code === nativeGoogleModule.statusCodes.IN_PROGRESS) {
          setLoginError("Proses login Google masih berjalan. Tunggu sebentar.");
          return;
        }

        if (
          error.code === nativeGoogleModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE
        ) {
          setLoginError(
            "Google Play Services tidak tersedia atau perlu diperbarui di perangkat ini.",
          );
          return;
        }
      }

      await clearPelaporGoogleSession();
      setLoginError(
        error instanceof Error
          ? error.message
          : "Login Google pelapor gagal. Coba lagi.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.googleCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
        onPress={handleGooglePelaporLogin}
        disabled={googleLoading}
      >
        <Feather name="chrome" size={18} color="#FFFFFF" />
        <Text style={styles.googleButtonText}>
          {googleLoading ? "Menyambungkan..." : "Masuk dengan Google"}
        </Text>
      </TouchableOpacity>
      {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
    </View>
  );
};

const PelaporGoogleUnavailableCard: React.FC<
  PelaporGoogleUnavailableCardProps
> = ({ loginError, reason }) => {
  const fallbackMessage =
    reason === "expo-go"
      ? "Google Sign-In pelapor belum bisa dipakai di Expo Go."
      : reason === "native-module"
        ? "Build ulang aplikasi Android untuk mengaktifkan login Google."
        : `Isi ${getGoogleClientIdVariableName()} di file .env aplikasi.`;

  return (
    <View style={styles.googleCard}>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.googleButton, styles.buttonDisabled]}
        disabled
      >
        <Feather name="chrome" size={18} color="#FFFFFF" />
        <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
      </TouchableOpacity>
      <Text style={styles.errorText}>{loginError || fallbackMessage}</Text>
    </View>
  );
};

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<CanonicalUserRole>("pelapor");
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  const router = useRouter();
  const googleClientConfig = useMemo(() => getGoogleClientIdConfig(), []);
  const nativeGoogleWebClientId = useMemo(() => getNativeGoogleWebClientId(), []);
  const nativeGoogleModule = useMemo(() => getNativeGoogleSigninModule(), []);

  useEffect(() => {
    let isMounted = true;

    const redirectAuthenticatedUser = async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        const profile = await getUserProfileByUid(auth.currentUser.uid);

        if (!isMounted) {
          return;
        }

        if (!profile) {
          await signOutCurrentUser();
          Alert.alert(
            "Akun tidak valid",
            "Data role akun tidak ditemukan atau belum lengkap. Silakan hubungi admin.",
          );
          return;
        }

        router.replace(getDashboardRouteByRole(profile.role));
      } catch (error) {
        console.error("Error checking login session:", error);

        if (isMounted) {
          Alert.alert(
            "Gagal memuat sesi",
            "Terjadi masalah saat membaca profil user. Silakan login kembali.",
          );
        }
      }
    };

    void redirectAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError("Email dan password wajib diisi");
      return;
    }

    try {
      setLoading(true);
      setLoginError("");
      const normalizedEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      const profile = await getUserProfileByUid(userCredential.user.uid);

      if (!profile) {
        await signOutCurrentUser();
        Alert.alert(
          "Akun tidak valid",
          "Data role akun tidak ditemukan atau belum lengkap. Silakan hubungi admin.",
        );
        return;
      }

      if (profile.role !== selectedRole) {
        setLoginError("");
        await signOutCurrentUser();
        return;
      }

      router.replace(getDashboardRouteByRole(profile.role));
    } catch (error) {
      const inlineError = getInlineLoginError(error);

      if (inlineError) {
        setLoginError(inlineError);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Login gagal. Coba lagi.";
      Alert.alert("Login gagal", message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = () => {
    setRoleModalVisible((prev) => !prev);
  };

  const handleRequestPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLoginError("Masukkan email terlebih dahulu untuk reset password.");
      return;
    }

    try {
      setResettingPassword(true);
      setLoginError("");
      await requestPasswordReset(normalizedEmail);
      Alert.alert(
        "Email reset terkirim",
        "Silakan cek inbox email Anda untuk mengatur ulang password.",
      );
    } catch (error) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "";

      if (
        errorCode === "auth/user-not-found" ||
        errorCode === "auth/invalid-email"
      ) {
        setLoginError("Email tidak ditemukan atau formatnya tidak valid.");
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Gagal mengirim email reset password.";
      Alert.alert("Reset password gagal", message);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Image
                source={require("@/assets/images/wrench.png")}
                contentFit="contain"
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.title}>U-FIXED</Text>
            <Text style={styles.subtitle}>Masuk ke akun anda</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Pilih Role</Text>
              <View style={styles.rolePickerWrapper}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.rolePicker,
                    roleModalVisible && styles.rolePickerActive,
                  ]}
                  onPress={handleSelectRole}
                >
                  <Text style={styles.roleText}>
                    {getLoginRoleLabel(selectedRole)}
                  </Text>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                {roleModalVisible && (
                  <View style={styles.roleDropdown}>
                    <ScrollView
                      bounces={false}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {LOGIN_ROLE_OPTIONS.map((role) => {
                        const isActive = role.value === selectedRole;
                        return (
                          <TouchableOpacity
                            key={role.value}
                            activeOpacity={0.8}
                            style={[
                              styles.roleOptionRow,
                              isActive && styles.roleOptionRowActive,
                            ]}
                            onPress={() => {
                              setSelectedRole(role.value);
                              setLoginError("");
                              setRoleModalVisible(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.roleOptionText,
                                isActive && styles.roleOptionTextActive,
                              ]}
                            >
                              {role.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {selectedRole === "pelapor" ? (
              isRunningInExpoGo ? (
                <PelaporGoogleUnavailableCard
                  loginError={loginError}
                  reason="expo-go"
                />
              ) : Platform.OS === "android" ? (
                nativeGoogleModule ? (
                  nativeGoogleWebClientId ? (
                    <PelaporAndroidGoogleLoginCard
                      nativeGoogleModule={nativeGoogleModule}
                      nativeWebClientId={nativeGoogleWebClientId}
                      googleLoading={googleLoading}
                      loginError={loginError}
                      setGoogleLoading={setGoogleLoading}
                      setLoginError={setLoginError}
                    />
                  ) : (
                    <PelaporGoogleUnavailableCard
                      loginError={loginError}
                      reason="missing-config"
                    />
                  )
                ) : (
                  <PelaporGoogleUnavailableCard
                    loginError={loginError}
                    reason="native-module"
                  />
                )
              ) : googleClientConfig ? (
                <PelaporAuthSessionGoogleLoginCard
                  clientConfig={googleClientConfig}
                  googleLoading={googleLoading}
                  loginError={loginError}
                  setGoogleLoading={setGoogleLoading}
                  setLoginError={setLoginError}
                />
              ) : (
                <PelaporGoogleUnavailableCard
                  loginError={loginError}
                  reason="missing-config"
                />
              )
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.iconBox}>
                      <Feather name="mail" size={18} color="#6B7280" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="nama@unklab.ac.id"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (loginError) {
                          setLoginError("");
                        }
                      }}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.iconCircle}>
                      <Feather name="lock" size={18} color="#6B7280" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="*******"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (loginError) {
                          setLoginError("");
                        }
                      }}
                    />
                  </View>
                  {loginError ? (
                    <Text style={styles.errorText}>{loginError}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.forgotPasswordButton}
                  onPress={handleRequestPasswordReset}
                  disabled={loading || resettingPassword}
                >
                  <Text style={styles.forgotPasswordText}>Lupa Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? "Memverifikasi..." : "Masuk"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
      <BlockingLoader
        visible={loading || resettingPassword || googleLoading}
        message={
          resettingPassword
            ? "Mengirim email reset..."
            : googleLoading
              ? "Menyambungkan akun Google..."
              : "Memverifikasi akun..."
        }
        accentColor="#1E5BFF"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E9F3FF",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1E5BFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  roleDropdown: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    zIndex: 1000,
    maxHeight: 210,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 12,
  },
  roleOptionRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  roleOptionRowActive: {
    backgroundColor: "#1E5BFF",
  },
  roleOptionText: {
    fontSize: 14,
    color: "#111827",
  },
  roleOptionTextActive: {
    color: "#FFFFFF",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#1D4ED8",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  card: {
    width: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  googleCard: {
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  rolePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rolePickerWrapper: {
    position: "relative",
    zIndex: 1000,
  },
  rolePickerActive: {
    borderColor: "#1E5BFF",
  },
  roleText: {
    fontSize: 14,
    color: "#4B5563",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  button: {
    marginTop: 8,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#1E5BFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1E5BFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: "#A5B4FC",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  googleButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorText: {
    marginTop: 6,
    marginLeft: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E5BFF",
  },
});

export default LoginScreen;
