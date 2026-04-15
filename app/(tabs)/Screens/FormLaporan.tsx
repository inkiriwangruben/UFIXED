import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
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
import { auth, db } from "@/lib/firebase";
import { getServerApiBaseUrl } from "@/lib/server-api";
import { getWorkflowDefaults } from "@/app/utils/workflow";
import {
  getDefaultNameFromEmail,
  getUserProfileByUid,
} from "@/lib/user-profile";
import BlockingLoader from "@/components/ui/BlockingLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Kategori = "IT" | "Non-IT";
type Priority = "low" | "medium" | "high" | "critical";
type LocalPhoto = {
  uri: string;
  name: string;
  type: string;
};

const MAX_PHOTOS = 3;

const isGenericUploadMessage = (message: string) => {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    normalizedMessage === "upload foto gagal." ||
    normalizedMessage === "upload foto gagal" ||
    normalizedMessage === "terjadi kesalahan saat upload." ||
    normalizedMessage === "terjadi kesalahan saat upload"
  );
};

const getUploadErrorMessage = (
  payload: Record<string, any> | null,
  fallbackMessage: string,
) => {
  const message =
    typeof payload?.message === "string" ? payload.message.trim() : "";
  const detail =
    typeof payload?.error === "string" ? payload.error.trim() : "";

  if (message && !isGenericUploadMessage(message)) {
    return message;
  }

  if (message && detail && detail !== message) {
    return `${message} Detail: ${detail}`;
  }

  if (message) {
    return message;
  }

  if (detail) {
    return detail;
  }

  return fallbackMessage;
};

type UploadResponseError = Error & {
  isUploadResponseError: true;
};

const createUploadResponseError = (message: string): UploadResponseError => {
  const error = new Error(message) as UploadResponseError;
  error.isUploadResponseError = true;
  return error;
};

const isUploadResponseError = (error: unknown): error is UploadResponseError =>
  error instanceof Error &&
  "isUploadResponseError" in error &&
  error.isUploadResponseError === true;

const parseUploadPayload = (rawBody: string) => {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as Record<string, any>;
  } catch {
    return { message: rawBody };
  }
};

const FormLaporan: React.FC = () => {
  const router = useRouter();
  const [kategori, setKategori] = useState<Kategori>("IT");
  const [priority, setPriority] = useState<Priority>("medium");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    email: string | null;
    name: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const fallbackName =
          user.displayName?.trim() ||
          getDefaultNameFromEmail(user.email || "user@local");
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          name: fallbackName,
        });

        void (async () => {
          try {
            const profile = await getUserProfileByUid(user.uid);

            if (isMounted && profile?.name) {
              setCurrentUser({
                uid: user.uid,
                email: user.email,
                name: profile.name,
              });
            }
          } catch (error) {
            console.error("Error loading current pelapor profile:", error);
          }
        })();
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleBack = () => {
    router.replace("/(tabs)/Screens/DashboardPelapor");
  };

  const savePickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Batas foto tercapai", "Maksimal 3 foto untuk satu laporan.");
      return;
    }

    const fallbackExt = asset.uri.toLowerCase().endsWith(".png") ? "png" : "jpg";
    const mimeType =
      asset.mimeType && asset.mimeType.startsWith("image/")
        ? asset.mimeType
        : fallbackExt === "png"
          ? "image/png"
          : "image/jpeg";

    setPhotos((current) => {
      if (current.length >= MAX_PHOTOS) {
        return current;
      }

      return [
        ...current,
        {
          uri: asset.uri,
          name: asset.fileName || `laporan-${Date.now()}.${fallbackExt}`,
          type: mimeType,
        },
      ];
    });
  };

  const handleTakePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Batas foto tercapai", "Maksimal 3 foto untuk satu laporan.");
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Izin kamera dibutuhkan",
        "Aktifkan izin kamera agar bisa mengambil foto laporan.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      savePickedAsset(result.assets[0]);
    }
  };

  const handlePickFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Batas foto tercapai", "Maksimal 3 foto untuk satu laporan.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Izin galeri dibutuhkan",
        "Aktifkan izin galeri agar bisa memilih foto laporan.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: true,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets[0]) {
      savePickedAsset(result.assets[0]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleOpenPhotoPicker = () => {
    setPhotoPickerVisible(true);
  };

  const uploadSinglePhoto = async (photo: LocalPhoto) => {
    const parseUploadedPhoto = (
      payload: Record<string, any> | null,
    ) => {
      if (!payload?.photo?.url) {
        throw createUploadResponseError(
          "Upload foto tidak mengembalikan URL yang valid.",
        );
      }

      return payload.photo;
    };

    try {
      const response = await FileSystem.uploadAsync(
        `${getServerApiBaseUrl()}/uploads/report-image`,
        photo.uri,
        {
          fieldName: "photo",
          httpMethod: "POST",
          mimeType: photo.type,
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        },
      );

      const payload = parseUploadPayload(response.body);

      if (response.status < 200 || response.status >= 300) {
        throw createUploadResponseError(
          getUploadErrorMessage(payload, "Upload foto gagal."),
        );
      }

      return parseUploadedPhoto(payload);
    } catch (nativeUploadError) {
      if (isUploadResponseError(nativeUploadError)) {
        throw nativeUploadError;
      }

      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(`${getServerApiBaseUrl()}/uploads/report-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          base64,
          name: photo.name,
          type: photo.type,
        }),
      });

      const rawBody = await response.text();
      const payload = parseUploadPayload(rawBody);

      if (!response.ok) {
        throw createUploadResponseError(
          getUploadErrorMessage(payload, "Upload foto gagal."),
        );
      }

      return parseUploadedPhoto(payload);
    }
  };

  const handleKirim = async () => {
    const trimmedJudul = judul.trim();
    const trimmedDeskripsi = deskripsi.trim();

    if (!currentUser) {
      Alert.alert(
        "Akses ditolak",
        "Silakan login terlebih dahulu untuk mengirim laporan.",
      );
      return;
    }

    if (!trimmedJudul) {
      Alert.alert(
        "Judul wajib diisi",
        "Masukkan judul laporan terlebih dahulu.",
      );
      return;
    }

    if (trimmedDeskripsi.length < 20) {
      Alert.alert(
        "Deskripsi terlalu singkat",
        "Deskripsi laporan minimal 20 karakter.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const workflowDefaults = getWorkflowDefaults(kategori);
      const uploadedPhotos = await Promise.all(photos.map(uploadSinglePhoto));

      await addDoc(collection(db, "laporan"), {
        kategori,
        priority,
        judul: trimmedJudul,
        deskripsi: trimmedDeskripsi,
        status: workflowDefaults.status,
        workflowStage: workflowDefaults.workflowStage,
        workflowState: workflowDefaults.workflowState,
        unitTarget: workflowDefaults.unitTarget,
        authorUid: currentUser.uid,
        authorEmail: currentUser.email,
        author: currentUser.name || "User",
        authorName: currentUser.name || "User",
        photos: uploadedPhotos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setKategori("IT");
      setPriority("medium");
      setJudul("");
      setDeskripsi("");
      setPhotos([]);
      setSuccessModalVisible(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan laporan.";
      Alert.alert("Gagal mengirim laporan", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const horizontalPadding = Math.max(16, Math.min(24, SCREEN_WIDTH * 0.06));

  const priorityOptions: {
    label: string;
    value: Priority;
    color: string;
    desc: string;
  }[] = [
    { label: "Rendah", value: "low", color: "#10B981", desc: "Tidak mendesak" },
    {
      label: "Sedang",
      value: "medium",
      color: "#F59E0B",
      desc: "Butuh perhatian",
    },
    { label: "Tinggi", value: "high", color: "#EF4444", desc: "Mendesak" },
    {
      label: "Kritis",
      value: "critical",
      color: "#7F1D1D",
      desc: "Darurat/Bahaya",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Modal
        transparent
        animationType="fade"
        visible={photoPickerVisible}
        onRequestClose={() => setPhotoPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upload Foto</Text>
            <Text style={styles.modalSubtitle}>Pilih sumber foto laporan.</Text>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.modalActionButtonPrimary]}
              onPress={async () => {
                setPhotoPickerVisible(false);
                await handleTakePhoto();
              }}
            >
              <Feather name="camera" size={16} color="#FFFFFF" />
              <Text style={styles.modalActionPrimaryText}>Ambil Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={async () => {
                setPhotoPickerVisible(false);
                await handlePickFromGallery();
              }}
            >
              <Feather name="image" size={16} color="#2563EB" />
              <Text style={styles.modalActionText}>Pilih dari Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setPhotoPickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        animationType="fade"
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Laporan terkirim</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setSuccessModalVisible(false)}
              activeOpacity={0.9}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Feather name="arrow-left" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>Buat Laporan Baru</Text>
            <Text style={styles.subtitle}>
              Laporkan Kerusakan Barang di Kampus
            </Text>
          </View>

          {/* Kategori Kerusakan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kategori Kerusakan</Text>
            <View style={styles.kategoriRow}>
              {/* Kartu IT */}
              <TouchableOpacity
                style={[
                  styles.kategoriCard,
                  kategori === "IT" && styles.kategoriCardITActive,
                ]}
                onPress={() => setKategori("IT")}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.kategoriIconWrap,
                    kategori === "IT" && styles.kategoriIconWrapITActive,
                  ]}
                >
                  <Feather
                    name="monitor"
                    size={28}
                    color={kategori === "IT" ? "#FFFFFF" : "#2563EB"}
                  />
                </View>
                <Text
                  style={[
                    styles.kategoriTitle,
                    kategori === "IT" && styles.kategoriTitleITActive,
                  ]}
                >
                  IT
                </Text>
                <View style={styles.kategoriDescWrap}>
                  <Text
                    style={[
                      styles.kategoriDesc,
                      kategori === "IT" && styles.kategoriDescActive,
                    ]}
                    numberOfLines={2}
                  >
                    Komputer,Proyektor,
                    {"\n"}
                    wifi
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Kartu Non-IT */}
              <TouchableOpacity
                style={[
                  styles.kategoriCard,
                  kategori === "Non-IT" && styles.kategoriCardNonITActive,
                ]}
                onPress={() => setKategori("Non-IT")}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.kategoriIconWrap,
                    kategori === "Non-IT" && styles.kategoriIconWrapNonITActive,
                  ]}
                >
                  <Feather
                    name="tool"
                    size={28}
                    color={kategori === "Non-IT" ? "#FFFFFF" : "#6B7280"}
                  />
                </View>
                <Text
                  style={[
                    styles.kategoriTitle,
                    kategori === "Non-IT" && styles.kategoriTitleNonITActive,
                  ]}
                >
                  Non-IT
                </Text>
                <View style={styles.kategoriDescWrap}>
                  <Text
                    style={[
                      styles.kategoriDesc,
                      kategori === "Non-IT" && styles.kategoriDescActive,
                    ]}
                    numberOfLines={2}
                  >
                    AC,Kursi,Meja,
                    {"\n"}
                    Pintu
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tingkat Urgensi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tingkat Urgensi</Text>
            <View style={styles.priorityRow}>
              {priorityOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.priorityChip,
                    priority === opt.value && {
                      borderColor: opt.color,
                      backgroundColor: opt.color + "10",
                    },
                  ]}
                  onPress={() => setPriority(opt.value)}
                >
                  <View
                    style={[styles.priorityDot, { backgroundColor: opt.color }]}
                  />
                  <Text
                    style={[
                      styles.priorityText,
                      priority === opt.value && {
                        color: opt.color,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {priorityOptions.find((o) => o.value === priority)?.desc}
            </Text>
          </View>

          {/* Judul Laporan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Judul Laporan</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Proyektor 301 tidak menyala"
              placeholderTextColor="#9CA3AF"
              value={judul}
              onChangeText={setJudul}
            />
          </View>

          {/* Deskripsi Kerusakan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Deskripsi Kerusakan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Jelaskan detail kerusakan, lokasi dan kapan terjadi.."
              placeholderTextColor="#9CA3AF"
              value={deskripsi}
              onChangeText={setDeskripsi}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.hint}>Minimal 20 Karakter</Text>
          </View>

          {/* Upload Foto */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Upload Foto (Opsional)</Text>
            <TouchableOpacity style={styles.uploadArea} onPress={handleOpenPhotoPicker}>
              <Feather name="camera" size={40} color="#9CA3AF" />
              <Text style={styles.uploadText}>Pilih atau ambil foto</Text>
              <Text style={styles.uploadHint}>
                PNG, JPG hingga 10mb (Maksimal 3 foto)
              </Text>
            </TouchableOpacity>
            {photos.length > 0 ? (
              <FlatList
                data={photos}
                keyExtractor={(item) => item.uri}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoList}
                renderItem={({ item, index }) => (
                  <View style={styles.photoCard}>
                    <Image source={{ uri: item.uri }} style={styles.photoPreview} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            ) : null}
          </View>

          {/* Kirim Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleKirim}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Mengirim..." : "Kirim Laporan"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <BlockingLoader
        visible={isSubmitting}
        message="Mengirim laporan..."
        detail="Foto dan data laporan sedang diproses."
        accentColor="#1E5BFF"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  keyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 16,
  },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 10,
  },
  modalActionButtonPrimary: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
  modalActionPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  successModalCard: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 10,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 20,
  },
  successButton: {
    minWidth: 128,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  successButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === "android" ? 12 : 16,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginLeft: -4,
  },
  title: {
    fontSize: SCREEN_WIDTH < 360 ? 20 : 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
    width: "100%",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
  },
  kategoriRow: {
    flexDirection: "row",
    gap: 10,
  },
  kategoriCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  kategoriCardITActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  kategoriCardNonITActive: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
  },
  kategoriIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  kategoriIconWrapITActive: {
    backgroundColor: "#2563EB",
  },
  kategoriIconWrapNonITActive: {
    backgroundColor: "#F97316",
  },
  kategoriTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  kategoriTitleITActive: {
    color: "#2563EB",
  },
  kategoriTitleNonITActive: {
    color: "#111827",
  },
  kategoriDescWrap: {
    alignSelf: "stretch",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  kategoriDesc: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
  kategoriDescActive: {
    color: "#6B7280",
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 13,
    color: "#6B7280",
  },
  input: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
  },
  uploadArea: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  uploadText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  photoList: {
    paddingTop: 12,
    gap: 10,
  },
  photoCard: {
    position: "relative",
    marginRight: 10,
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  removePhotoButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(17, 24, 39, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#1E5BFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default FormLaporan;
