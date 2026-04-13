import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import {
  ActivityIndicator,
  Alert,
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

import { db, secondaryAuth } from "@/lib/firebase";
import {
  ROLE_OPTIONS,
  getRoleLabel,
  type CanonicalUserRole,
} from "@/lib/roles";
import {
  buildCanonicalUserProfileInput,
  getDefaultNameFromEmail,
  mapUserDocumentToProfile,
} from "@/lib/user-profile";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: CanonicalUserRole;
}

const NAME_REGEX = /^[\p{L}\s]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getNameValidationError = (
  value: string,
  role: CanonicalUserRole | "",
  touched: boolean,
) => {
  if (role !== "pelapor") {
    return "";
  }

  const trimmedValue = value.trim();
  if (!touched && !trimmedValue) {
    return "";
  }

  if (!trimmedValue) {
    return "Nama pelapor wajib diisi.";
  }

  if (!NAME_REGEX.test(trimmedValue)) {
    return "Nama hanya boleh berisi huruf dan spasi.";
  }

  return "";
};

const getPasswordValidationError = (value: string, touched: boolean) => {
  if (!touched && !value) {
    return "";
  }

  if (value.length < 8) {
    return "Password minimal 8 karakter.";
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return "Password harus mengandung huruf besar, huruf kecil, dan angka.";
  }

  return "";
};

const MANAGEABLE_ROLE_OPTIONS = ROLE_OPTIONS.filter(
  (role) => role.value !== "admin",
);

const HIDDEN_ROLES: CanonicalUserRole[] = ["admin"];

const getRoleBadgeStyle = (role: CanonicalUserRole) => {
  switch (role) {
    case "admin":
      return { backgroundColor: "#F3E8FF", textColor: "#7C3AED" };
    case "department-it":
      return { backgroundColor: "#DBEAFE", textColor: "#2563EB" };
    case "tukang":
      return { backgroundColor: "#FEF3C7", textColor: "#B45309" };
    case "business-office":
      return { backgroundColor: "#DCFCE7", textColor: "#15803D" };
    default:
      return { backgroundColor: "#E0E7FF", textColor: "#4338CA" };
  }
};

const KelolaUserScreen: React.FC = () => {
  const router = useRouter();
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<CanonicalUserRole | "">("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (querySnapshot) => {
        const dedupedUsers = new Map<string, UserItem>();

        querySnapshot.forEach((snapshot) => {
          const profile = mapUserDocumentToProfile(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          );

          if (!profile) {
            return;
          }

          dedupedUsers.set(profile.uid, {
            id: profile.uid,
            name: profile.name,
            email: profile.email,
            role: profile.role,
          });
        });

        setUserList(
          [...dedupedUsers.values()]
            .filter((user) => !HIDDEN_ROLES.includes(user.role))
            .sort((left, right) => left.email.localeCompare(right.email)),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        Alert.alert("Error", "Gagal memuat data pengguna");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const resetAddForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("");
    setShowRoleMenu(false);
    setNameError("");
    setPasswordError("");
    setNameTouched(false);
    setPasswordTouched(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/Screens/DashboardAdmin");
    }
  };

  const handleOpenDeleteModal = (user: UserItem) => {
    if (user.role === "admin") {
      return;
    }

    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) {
      return;
    }

    if (selectedUser.role === "admin") {
      Alert.alert("Error", "Akun admin tidak bisa dihapus dari halaman ini");
      handleCloseDeleteModal();
      return;
    }

    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      Alert.alert(
        "Berhasil",
        "Profil pengguna berhasil dihapus. Akses aplikasi untuk akun ini telah dicabut.",
      );
      handleCloseDeleteModal();
    } catch (error) {
      console.error("Error deleting user:", error);
      Alert.alert("Error", "Gagal menghapus profil pengguna");
    }
  };

  const handleAddUser = async () => {
    const normalizedEmail = newEmail.trim().toLowerCase();
    const normalizedName = newName.trim();
    const nextNameError = getNameValidationError(newName, newRole, true);
    const nextPasswordError = getPasswordValidationError(newPassword, true);

    setNameTouched(newRole === "pelapor");
    setPasswordTouched(true);
    setNameError(nextNameError);
    setPasswordError(nextPasswordError);

    if (!normalizedEmail || !newPassword.trim() || !newRole) {
      return;
    }

    if (nextNameError || nextPasswordError) {
      return;
    }

    if (newRole === "admin") {
      Alert.alert("Error", "Role admin tidak bisa dibuat dari halaman ini");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert("Error", "Format email tidak valid");
      return;
    }

    try {
      setAdding(true);

      const emailQuery = query(
        collection(db, "users"),
        where("email", "==", normalizedEmail),
      );
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        Alert.alert("Error", "Email sudah terdaftar di sistem");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        newPassword,
      );
      const uid = userCredential.user.uid;
      const profile = buildCanonicalUserProfileInput({
        uid,
        email: normalizedEmail,
        name:
          newRole === "pelapor"
            ? normalizedName
            : getDefaultNameFromEmail(normalizedEmail),
        role: newRole,
      });

      await setDoc(doc(db, "users", uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await signOut(secondaryAuth);

      resetAddForm();
      setShowAddModal(false);
      Alert.alert("Berhasil", "Pengguna berhasil ditambahkan");
    } catch (error: any) {
      console.error("Error adding user:", error);
      let errorMessage = "Gagal menambahkan pengguna";

      if (error?.code) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "Email sudah digunakan oleh akun lain";
            break;
          case "auth/weak-password":
            errorMessage =
              "Password terlalu lemah. Gunakan minimal 8 karakter dengan huruf besar, huruf kecil, dan angka.";
            break;
          case "auth/invalid-email":
            errorMessage = "Format email tidak valid";
            break;
          case "auth/operation-not-allowed":
            errorMessage = "Pendaftaran akun dinonaktifkan";
            break;
          default:
            errorMessage = error.message || errorMessage;
            break;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const isAddButtonDisabled =
    adding ||
    !newEmail.trim() ||
    !newRole ||
    Boolean(getNameValidationError(newName, newRole, nameTouched)) ||
    Boolean(getPasswordValidationError(newPassword, passwordTouched)) ||
    (newRole === "pelapor" && !newName.trim()) ||
    !newPassword;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Memuat data pengguna...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelola User</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tombol Tambah User Baru */}
        <View style={styles.addUserWrapper}>
          <View style={styles.addUserCard}>
            <TouchableOpacity
              style={styles.addUserButton}
              activeOpacity={0.9}
              onPress={() => setShowAddModal(true)}
            >
              <Feather name="user-plus" size={18} color="#FFFFFF" />
              <Text style={styles.addUserText}>Tambah User Baru</Text>
            </TouchableOpacity>
          </View>
        </View>

        {userList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="users" size={28} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Belum ada user demo</Text>
            <Text style={styles.emptySubtitle}>
              Tambahkan akun terlebih dahulu agar login per role bisa diuji.
            </Text>
          </View>
        ) : (
          userList.map((user) => {
            const badgeStyle = getRoleBadgeStyle(user.role);

            return (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userLeft}>
                  <View style={styles.userAvatar}>
                    <Feather name="user" size={20} color="#9CA3AF" />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <View style={styles.userEmailRow}>
                      <Feather
                        name="mail"
                        size={14}
                        color="#6B7280"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                    <View
                      style={[
                        styles.roleBadge,
                        { backgroundColor: badgeStyle.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          { color: badgeStyle.textColor },
                        ]}
                      >
                        {getRoleLabel(user.role)}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  activeOpacity={0.9}
                  onPress={() => handleOpenDeleteModal(user)}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Tambah User Baru */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tambah User Baru</Text>

            {newRole === "pelapor" ? (
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>Nama</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    nameError ? styles.modalInputError : undefined,
                  ]}
                  placeholder="Masukkan nama pelapor"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  value={newName}
                  onBlur={() => {
                    setNameTouched(true);
                    setNameError(getNameValidationError(newName, newRole, true));
                  }}
                  onChangeText={(value) => {
                    setNewName(value);
                    setNameTouched(true);
                    setNameError(getNameValidationError(value, newRole, true));
                  }}
                />
                {nameError ? (
                  <Text style={styles.modalErrorText}>{nameError}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalLabel}>Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="email@unklab.ac.id"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmail}
                onChangeText={setNewEmail}
              />
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalLabel}>Password</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  passwordError ? styles.modalInputError : undefined,
                ]}
                placeholder="Masukkan password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={newPassword}
                onBlur={() => {
                  setPasswordTouched(true);
                  setPasswordError(getPasswordValidationError(newPassword, true));
                }}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setPasswordTouched(true);
                  setPasswordError(getPasswordValidationError(value, true));
                }}
              />
              {passwordError ? (
                <Text style={styles.modalErrorText}>{passwordError}</Text>
              ) : null}
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalLabel}>Role</Text>
              <View>
                <TouchableOpacity
                  style={styles.modalSelect}
                  activeOpacity={0.8}
                  onPress={() => setShowRoleMenu((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.modalSelectText,
                      !newRole && { color: "#9CA3AF" },
                    ]}
                  >
                    {newRole ? getRoleLabel(newRole) : "Pilih role user"}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {showRoleMenu && (
                  <View style={styles.roleMenu}>
                    {MANAGEABLE_ROLE_OPTIONS.map((role) => (
                      <TouchableOpacity
                        key={role.value}
                        style={styles.roleMenuItem}
                        activeOpacity={0.8}
                        onPress={() => {
                          setNewRole(role.value);
                          if (role.value !== "pelapor") {
                            setNewName("");
                          }
                          setNameTouched(false);
                          setNameError("");
                          setShowRoleMenu(false);
                        }}
                      >
                        <Text style={styles.roleMenuItemText}>{role.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                activeOpacity={0.8}
                onPress={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
              >
                <Text style={styles.modalButtonCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButtonSubmit,
                  isAddButtonDisabled && styles.modalButtonSubmitDisabled,
                ]}
                activeOpacity={0.8}
                onPress={handleAddUser}
                disabled={isAddButtonDisabled}
              >
                <Text style={styles.modalButtonSubmitText}>
                  {adding ? "Menambah..." : "Tambah"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal Konfirmasi Hapus User */}
      {showDeleteModal && selectedUser && (
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconWrap}>
              <Feather name="alert-triangle" size={20} color="#DC2626" />
            </View>

            <Text style={styles.deleteModalSubtitle}>
              {"Apakah Anda yakin ingin menghapus akun " +
                selectedUser.name +
                "?"}
            </Text>

            <View style={styles.deleteModalButtonRow}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                activeOpacity={0.9}
                onPress={handleCloseDeleteModal}
              >
                <Text style={styles.deleteModalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                activeOpacity={0.9}
                onPress={handleConfirmDelete}
              >
                <Feather name="trash-2" size={14} color="#FFFFFF" />
                <Text style={styles.deleteModalConfirmText}>Hapus</Text>
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
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 16,
    paddingBottom: 30,
    backgroundColor: "#7C3AED",
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  addUserWrapper: {
    marginTop: -10,
    marginBottom: 10,
  },
  addUserCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  addUserButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 999,
    paddingVertical: 10,
  },
  addUserText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  userEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 13,
    color: "#6B7280",
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 14,
  },
  modalFieldGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
  },
  modalInputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  modalErrorText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#DC2626",
  },
  modalSelect: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalSelectText: {
    fontSize: 13,
    color: "#111827",
  },
  roleMenu: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  roleMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleMenuItemText: {
    fontSize: 13,
    color: "#111827",
  },
  modalButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  modalButtonCancel: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  modalButtonCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  modalButtonSubmit: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "#7C3AED",
  },
  modalButtonSubmitDisabled: {
    backgroundColor: "#C4B5FD",
  },
  modalButtonSubmitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 9,
  },
  deleteModalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
  },
  deleteModalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  deleteModalButtonRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteModalCancelButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  deleteModalConfirmButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    flexDirection: "row",
    gap: 6,
  },
  deleteModalCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  deleteModalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
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

export default KelolaUserScreen;
