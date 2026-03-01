import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const LoginScreen: React.FC = () => {
  type RoleOption =
    | 'Pelapor (Mahasiswa/Dosen/Staf)'
    | 'Admin'
    | 'Department IT'
    | 'Tukang'
    | 'Bussines Office';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] =
    useState<RoleOption>('Pelapor (Mahasiswa/Dosen/Staf)');
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const handleLogin = () => {
    Alert.alert('Login', 'Fitur login belum diimplementasikan.');
  };

  const handleSelectRole = () => {
    setRoleModalVisible(prev => !prev);
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
                source={require('@/assets/images/wrench.png')}
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
                  style={[styles.rolePicker, roleModalVisible && styles.rolePickerActive]}
                  onPress={handleSelectRole}
                >
                  <Text style={styles.roleText}>{selectedRole}</Text>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                {roleModalVisible && (
                  <View style={styles.roleDropdown}>
                    <ScrollView
                      bounces={false}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {(
                        [
                          'Pelapor (Mahasiswa/Dosen/Staf)',
                          'Admin',
                          'Department IT',
                          'Tukang',
                          'Bussines Office',
                        ] as RoleOption[]
                      ).map(role => {
                        const isActive = role === selectedRole;
                        return (
                          <TouchableOpacity
                            key={role}
                            activeOpacity={0.8}
                            style={[styles.roleOptionRow, isActive && styles.roleOptionRowActive]}
                            onPress={() => {
                              setSelectedRole(role);
                              setRoleModalVisible(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.roleOptionText,
                                isActive && styles.roleOptionTextActive,
                              ]}
                            >
                              {role}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconBox}>
                  <Feather name="mail" size={18} color="#6B7280" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="s22210208@unklab.ac.id"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
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
                  onChangeText={setPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.button}
              onPress={handleLogin}
            >
              <Text style={styles.buttonText}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9F3FF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1E5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  roleDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 1000,
    maxHeight: 210,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 12,
  },
  roleOptionRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  roleOptionRowActive: {
    backgroundColor: '#1E5BFF',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#1D4ED8',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    width: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  rolePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rolePickerWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  rolePickerActive: {
    borderColor: '#1E5BFF',
  },
  roleText: {
    fontSize: 14,
    color: '#4B5563',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  button: {
    marginTop: 8,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#1E5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E5BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LoginScreen;

