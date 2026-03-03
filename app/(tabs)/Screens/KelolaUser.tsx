import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type UserRole = 'Admin' | 'Department IT' | 'Tukang' | 'Business Office';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const roleOptions: UserRole[] = ['Admin', 'Department IT', 'Tukang', 'Business Office'];

const users: UserItem[] = [
  {
    id: '1',
    name: 'Admin UNKLAB',
    email: 'admin@unklab.ac.id',
    role: 'Admin',
  },
  {
    id: '2',
    name: 'IT Support',
    email: 'it@unklab.ac.id',
    role: 'Department IT',
  },
  {
    id: '3',
    name: 'Tukang Kampus',
    email: 'tukang@unklab.ac.id',
    role: 'Tukang',
  },
  {
    id: '4',
    name: 'Business Office',
    email: 'bo@unklab.ac.id',
    role: 'Business Office',
  },
];

const getRoleStyle = (role: UserRole) => {
  switch (role) {
    case 'Admin':
      return { bg: '#F3E8FF', text: '#7C3AED' };
    case 'Department IT':
      return { bg: '#DBEAFE', text: '#1D4ED8' };
    case 'Tukang':
      return { bg: '#FEF3C7', text: '#92400E' };
    case 'Business Office':
    default:
      return { bg: '#DCFCE7', text: '#166534' };
  }
};

const KelolaUserScreen: React.FC = () => {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('');
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/Screens/DashboardAdmin')}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelola User</Text>
        <View style={{ width: 32 }} />
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

        {/* List User */}
        {users.map((user) => {
          const roleStyle = getRoleStyle(user.role);
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
                      { backgroundColor: roleStyle.bg },
                    ]}
                  >
                    <Text
                      style={[styles.roleBadgeText, { color: roleStyle.text }]}
                    >
                      {user.role}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.deleteButton}>
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Tambah User Baru */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tambah User Baru</Text>

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
                style={styles.modalInput}
                placeholder="Masukkan password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalLabel}>Role</Text>
              <View>
                <TouchableOpacity
                  style={styles.modalSelect}
                  activeOpacity={0.8}
                  onPress={() => setShowRoleMenu(prev => !prev)}
                >
                  <Text
                    style={[
                      styles.modalSelectText,
                      !newRole && { color: '#9CA3AF' },
                    ]}
                  >
                    {newRole || 'Pilih role user'}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {showRoleMenu && (
                  <View style={styles.roleMenu}>
                    {roleOptions.map(role => (
                      <TouchableOpacity
                        key={role}
                        style={styles.roleMenuItem}
                        activeOpacity={0.8}
                        onPress={() => {
                          setNewRole(role);
                          setShowRoleMenu(false);
                        }}
                      >
                        <Text style={styles.roleMenuItemText}>{role}</Text>
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
                  setNewEmail('');
                  setNewPassword('');
                  setNewRole('');
                  setShowRoleMenu(false);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSubmit}
                activeOpacity={0.8}
                onPress={() => {
                  // TODO: logika tambah user
                  setShowAddModal(false);
                  setNewEmail('');
                  setNewPassword('');
                  setNewRole('');
                  setShowRoleMenu(false);
                }}
              >
                <Text style={styles.modalButtonSubmitText}>Tambah</Text>
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 16,
    paddingBottom: 30,
    backgroundColor: '#7C3AED',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  addUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 10,
  },
  addUserText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  userEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },
  modalFieldGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
  },
  modalSelect: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalSelectText: {
    fontSize: 13,
    color: '#111827',
  },
  roleMenu: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  roleMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleMenuItemText: {
    fontSize: 13,
    color: '#111827',
  },
  modalButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  modalButtonCancel: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  modalButtonCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalButtonSubmit: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: '#7C3AED',
  },
  modalButtonSubmitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default KelolaUserScreen;

