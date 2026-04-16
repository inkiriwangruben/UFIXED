import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import BlockingLoader from "@/components/ui/BlockingLoader";
import ScreenLoader from "@/components/ui/ScreenLoader";
import { createManagedUser, deleteManagedUser } from "@/lib/admin-user-service";
import {
  getEmailValidationMessageForRole,
  isEmailAllowedForRole,
  normalizeManagedEmail,
} from "@/lib/auth-policy";
import { db } from "@/lib/firebase";
import {
  ROLE_OPTIONS,
  getRoleLabel,
  type CanonicalUserRole,
} from "@/lib/roles";
import { mapUserDocumentToProfile } from "@/lib/user-profile";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: CanonicalUserRole;
  authProvider: "google" | "password";
  source: "profile" | "access";
}

const NAME_REGEX = /^[\p{L}\s]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PELAPOR_NAME_LETTERS = 8;
const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password wajib diisi, minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka.";

const isLetterCharacter = (value: string) => /\p{L}/u.test(value);

const getPelaporNameLetterCount = (value: string) =>
  Array.from(value).filter((character) => isLetterCharacter(character)).length;

const limitPelaporNameLetters = (value: string) => {
  let letterCount = 0;
  let result = "";

  for (const character of Array.from(value)) {
    if (isLetterCharacter(character)) {
      if (letterCount >= MAX_PELAPOR_NAME_LETTERS) {
        continue;
      }

      letterCount += 1;
    }

    result += character;
  }

  return result;
};

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

  if (getPelaporNameLetterCount(trimmedValue) > MAX_PELAPOR_NAME_LETTERS) {
    return `Nama pelapor maksimal ${MAX_PELAPOR_NAME_LETTERS} huruf.`;
  }

  return "";
};

const getPasswordValidationError = (value: string, touched: boolean) => {
  const normalizedValue = value.trim();

  if (!touched && !normalizedValue) {
    return "";
  }

  if (
    !normalizedValue ||
    normalizedValue.length < 8 ||
    !/[A-Z]/.test(normalizedValue) ||
    !/[a-z]/.test(normalizedValue) ||
    !/\d/.test(normalizedValue)
  ) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  return "";
};

const getManagedEmailValidationError = (
  value: string,
  role: CanonicalUserRole | "",
  touched: boolean,
) => {
  const trimmedValue = normalizeManagedEmail(value);

  if (!touched && !trimmedValue) {
    return "";
  }

  if (!trimmedValue) {
    return "Email wajib diisi.";
  }

  if (!EMAIL_REGEX.test(trimmedValue)) {
    return "Format email tidak valid.";
  }

  if (role && !isEmailAllowedForRole(trimmedValue, role)) {
    return getEmailValidationMessageForRole(role);
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
  const insets = useSafeAreaInsets();
  const [profileUsers, setProfileUsers] = useState<UserItem[]>([]);
  const [pelaporAccessUsers, setPelaporAccessUsers] = useState<UserItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingPelaporAccess, setLoadingPelaporAccess] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<CanonicalUserRole | "">("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordFieldActive, setPasswordFieldActive] = useState(false);

  useEffect(() => {
    setLoadingProfiles(true);
    const unsubscribeProfiles = onSnapshot(
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
            authProvider:
              snapshot.data()?.authProvider === "google" ? "google" : "password",
            source: "profile",
          });
        });

        setProfileUsers(
          [...dedupedUsers.values()].filter(
            (user) => !HIDDEN_ROLES.includes(user.role),
          ),
        );
        setLoadingProfiles(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        Alert.alert("Error", "Gagal memuat data pengguna");
        setLoadingProfiles(false);
      },
    );

    setLoadingPelaporAccess(true);
    const unsubscribePelaporAccess = onSnapshot(
      collection(db, "pelapor_access"),
      (querySnapshot) => {
        const accessUsers: UserItem[] = [];

        querySnapshot.forEach((snapshot) => {
          const data = snapshot.data() as Record<string, unknown>;
          const email =
            typeof data.email === "string" ? normalizeManagedEmail(data.email) : "";
          const name =
            typeof data.name === "string" && data.name.trim()
              ? data.name.trim()
              : email.split("@")[0] || "Pelapor";

          if (!email) {
            return;
          }

          accessUsers.push({
            id: email,
            name,
            email,
            role: "pelapor",
            authProvider: "google",
            source: "access",
          });
        });

        setPelaporAccessUsers(accessUsers);
        setLoadingPelaporAccess(false);
      },
      (error) => {
        console.error("Error fetching pelapor access:", error);
        Alert.alert("Error", "Gagal memuat data akses pelapor");
        setLoadingPelaporAccess(false);
      },
    );

    return () => {
      unsubscribeProfiles();
      unsubscribePelaporAccess();
    };
  }, []);

  const userList = useMemo(() => {
    const mergedUsers = new Map<string, UserItem>();

    profileUsers.forEach((user) => {
      mergedUsers.set(user.email, user);
    });

    pelaporAccessUsers.forEach((pelaporAccessUser) => {
      const existingUser = mergedUsers.get(pelaporAccessUser.email);

      mergedUsers.set(pelaporAccessUser.email, {
        ...pelaporAccessUser,
        name: pelaporAccessUser.name || existingUser?.name || pelaporAccessUser.email,
      });
    });

    return [...mergedUsers.values()].sort((left, right) =>
      left.email.localeCompare(right.email),
    );
  }, [pelaporAccessUsers, profileUsers]);

  const loading = loadingProfiles || loadingPelaporAccess;

  const resetAddForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("");
    setShowRoleMenu(false);
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setNameTouched(false);
    setEmailTouched(false);
    setPasswordTouched(false);
    setPasswordFieldActive(false);
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
      setDeleting(true);
      await deleteManagedUser({
        id: selectedUser.id,
        email: selectedUser.email,
        role: selectedUser.role,
      });
      setProfileUsers((currentUsers) =>
        currentUsers.filter(
          (user) =>
            user.id !== selectedUser.id && user.email !== selectedUser.email,
        ),
      );
      setPelaporAccessUsers((currentUsers) =>
        currentUsers.filter((user) => user.email !== selectedUser.email),
      );
      handleCloseDeleteModal();
      Alert.alert("Berhasil", "Pengguna berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting user:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Gagal menghapus pengguna",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleAddUser = async () => {
    const normalizedEmail = normalizeManagedEmail(newEmail);
    const normalizedName = newName.trim();
    const normalizedPassword = newPassword.trim();
    const nextNameError = getNameValidationError(newName, newRole, true);
    const nextEmailError = getManagedEmailValidationError(newEmail, newRole, true);
    const nextPasswordError =
      newRole === "pelapor" ? "" : getPasswordValidationError(normalizedPassword, true);

    setNameTouched(newRole === "pelapor");
    setEmailTouched(true);
    setPasswordTouched(newRole !== "pelapor");
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (
      !normalizedEmail ||
      !newRole ||
      (newRole !== "pelapor" && !normalizedPassword)
    ) {
      return;
    }

    if (nextNameError || nextEmailError || nextPasswordError) {
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
      await createManagedUser({
        email: normalizedEmail,
        ...(newRole === "pelapor" ? {} : { password: normalizedPassword }),
        role: newRole,
        ...(newRole === "pelapor" ? { name: normalizedName } : {}),
      });

      resetAddForm();
      setShowAddModal(false);
      Alert.alert(
        "Berhasil",
        newRole === "pelapor"
          ? "Pelapor berhasil ditambahkan. Login dilakukan dengan Google memakai email yang sama."
          : "Akun internal berhasil dibuat.",
      );
    } catch (error: unknown) {
      console.error("Error adding user:", error);
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Gagal menambahkan pengguna";

      Alert.alert("Error", errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const isAddButtonDisabled =
    adding ||
    !newRole ||
    Boolean(getNameValidationError(newName, newRole, nameTouched)) ||
    (newRole !== "pelapor" &&
      Boolean(getPasswordValidationError(newPassword, passwordTouched))) ||
    (newRole === "pelapor" && !newName.trim()) ||
    (newRole !== "pelapor" && !newPassword);
  const isBusy = adding || deleting;
  const busyMessage = deleting
    ? "Menghapus pengguna..."
    : "Menyimpan pengguna...";
  const visibleEmailError = emailTouched ? emailError : "";
  const visiblePasswordError = passwordFieldActive ? passwordError : "";

  if (loading) {
    return (
      <ScreenLoader
        message="Memuat data pengguna..."
        accentColor="#7C3AED"
        backgroundColor="#F5F5F5"
      />
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
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
            <Text style={styles.emptyTitle}>Belum ada user</Text>
            <Text style={styles.emptySubtitle}>
              Tambahkan akun terlebih dahulu agar pengguna bisa login sesuai role.
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
                    const limitedValue = limitPelaporNameLetters(value);

                    setNewName(limitedValue);
                    setNameTouched(true);
                    setNameError(
                      getNameValidationError(limitedValue, newRole, true),
                    );
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
                style={[
                  styles.modalInput,
                  visibleEmailError ? styles.modalInputError : undefined,
                ]}
                placeholder="email@domain.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmail}
                onChangeText={(value) => {
                  setNewEmail(value);
                  if (emailTouched) {
                    setEmailError(
                      getManagedEmailValidationError(value, newRole, true),
                    );
                  }
                }}
              />
              {visibleEmailError ? (
                <Text style={styles.modalErrorText}>{visibleEmailError}</Text>
              ) : null}
            </View>

            {newRole && newRole !== "pelapor" ? (
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>Password</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    visiblePasswordError ? styles.modalInputError : undefined,
                  ]}
                  placeholder="Masukkan password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={newPassword}
                  onFocus={() => {
                    setPasswordFieldActive(true);
                    setPasswordTouched(true);
                    setPasswordError(getPasswordValidationError(newPassword, true));
                  }}
                  onBlur={() => {
                    setPasswordFieldActive(false);
                    setPasswordTouched(true);
                    setPasswordError(getPasswordValidationError(newPassword, true));
                  }}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    setPasswordTouched(true);
                    setPasswordError(getPasswordValidationError(value, true));
                  }}
                />
                {visiblePasswordError ? (
                  <Text style={styles.modalErrorText}>{visiblePasswordError}</Text>
                ) : null}
              </View>
            ) : null}

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
                          } else {
                            setNewPassword("");
                            setPasswordTouched(false);
                            setPasswordError("");
                            setPasswordFieldActive(false);
                          }
                          setNameTouched(false);
                          setNameError("");
                          if (emailTouched) {
                            setEmailError(
                              getManagedEmailValidationError(
                                newEmail,
                                role.value,
                                true,
                              ),
                            );
                          }
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
                  {adding ? "Menyimpan..." : "Tambah"}
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
                activeOpacity={deleting ? 1 : 0.9}
                onPress={handleCloseDeleteModal}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                activeOpacity={deleting ? 1 : 0.9}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                <Feather name="trash-2" size={14} color="#FFFFFF" />
                <Text style={styles.deleteModalConfirmText}>
                  {deleting ? "Menghapus..." : "Hapus"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <BlockingLoader
        visible={isBusy}
        message={busyMessage}
        detail="Perubahan data pengguna sedang diproses."
        accentColor="#7C3AED"
      />
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


