import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type AdminStatus = 'semua' | 'pending' | 'verifikasi';

interface AdminLaporan {
  id: string;
  title: string;
  description: string;
  status: AdminStatus;
  statusLabel: string;
  statusType: 'process' | 'pending';
  icon: 'monitor' | 'tools';
  date: string;
  author: string;
}

const dataLaporan: AdminLaporan[] = [
  {
    id: '1',
    title: 'GK 1, lt 2, 301 Proyektor  Tidak Menyala',
    description:
      'Proyektor di ruang Kuliah 301 tidak dapat menyala sejak pagi ini sudah dicoba berkali-kali namun tetap tidak ada respon',
    status: 'pending',
    statusLabel: 'Dalam Proses',
    statusType: 'process',
    icon: 'monitor',
    date: '29/01/2026',
    author: 'Ruben Inkiriwang',
  },
  {
    id: '2',
    title: 'GK 2, komputer lab 1, monitor tidak menyala',
    description:
      'tadi pagi di jam 10:00 saya masuk kelas, dan pada saat saya mau pakai monitor monitornya tidak bisa menyala',
    status: 'pending',
    statusLabel: 'Pending',
    statusType: 'pending',
    icon: 'monitor',
    date: '16/01/2026',
    author: 'Ruben Inkiriwang',
  },
  {
    id: '3',
    title: 'AC Perpustakaan Bocor',
    description: 'ac perpustakaan bocor dan air nya keluar terus',
    status: 'verifikasi',
    statusLabel: 'Pending',
    statusType: 'pending',
    icon: 'tools',
    date: '16/01/2026',
    author: 'Ruben Inkiriwang',
  },
];

const DashboardAdmin: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminStatus>('semua');

  const filteredLaporan = useMemo(() => {
    if (activeTab === 'semua') {
      return dataLaporan;
    }
    return dataLaporan.filter(item => item.status === activeTab);
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER UNGU */}
        <View style={styles.header}>
          {/* Top row back + title */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(tabs)/Screens/LoginScreen')}
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* STAT KARTU */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="clock" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>1</Text>
              <Text style={styles.statLabel}>Semua</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="check-circle" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>1</Text>
              <Text style={styles.statLabel}>Laporan</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Feather name="file-text" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>4</Text>
              <Text style={styles.statLabel}>Verifikasi</Text>
            </View>
          </View>
        </View>

        {/* KONTEN PUTIH */}
        <View style={styles.content}>
          {/* KELOLA USER */}
          <View style={styles.manageUserWrapper}>
            <TouchableOpacity
              style={styles.manageUserCard}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/Screens/KelolaUser')}
            >
              <View style={styles.manageUserLeft}>
                <View style={styles.manageUserAvatar}>
                  <Feather name="users" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.manageUserTitle}>Kelola User</Text>
                  <Text style={styles.manageUserSubtitle}>
                    Tambah atau hapus user
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* TAB */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'semua' && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab('semua')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'semua' && styles.tabTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'pending' && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab('pending')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'pending' && styles.tabTextActive,
                ]}
              >
                Laporan Baru
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'verifikasi' && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab('verifikasi')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'verifikasi' && styles.tabTextActive,
                ]}
              >
                Verifikasi
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIST LAPORAN */}
          {filteredLaporan.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.reportCard,
                index > 0 && { marginTop: 12 },
              ]}
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View style={styles.reportIconCircle}>
                    {item.icon === 'monitor' ? (
                      <Feather name="monitor" size={16} color="#1E40AF" />
                    ) : (
                      <Feather name="tool" size={16} color="#F97316" />
                    )}
                  </View>
                  <Text style={styles.reportTitle}>{item.title}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </View>

              <Text style={styles.reportDescription} numberOfLines={3}>
                {item.description}
              </Text>

              <View style={styles.reportFooterRow}>
                {/* Status pill */}
                <View
                  style={[
                    styles.statusPill,
                    item.statusType === 'process'
                      ? styles.statusPillProcess
                      : styles.statusPillPending,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      item.statusType === 'process'
                        ? 'progress-clock'
                        : 'clock-outline'
                    }
                    size={14}
                    color={
                      item.statusType === 'process' ? '#1D4ED8' : '#92400E'
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      item.statusType === 'process'
                        ? styles.statusTextProcess
                        : styles.statusTextPending,
                    ]}
                  >
                    {item.statusLabel}
                  </Text>
                </View>

                {/* Meta row */}
                <View style={styles.reportMetaRow}>
                  <View style={styles.reportMetaItem}>
                    <Feather name="user" size={12} color="#6B7280" />
                    <Text style={styles.reportMetaText}>{item.author}</Text>
                  </View>
                  <View style={styles.reportMetaItem}>
                    <Feather name="calendar" size={12} color="#6B7280" />
                    <Text style={styles.reportMetaText}>{item.date}</Text>
                  </View>
                </View>
              </View>

              {activeTab === 'pending' && item.statusType === 'pending' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonVerify}
                    activeOpacity={0.9}
                    onPress={() => {}}
                  >
                    <Text style={styles.actionButtonText}>Verifikasi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButtonReject}
                    activeOpacity={0.9}
                    onPress={() => {}}
                  >
                    <Text style={styles.actionButtonText}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#7C3AED',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 90,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#A855F7',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#F3E8FF',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  manageUserWrapper: {
    marginTop: -40,
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  manageUserCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  manageUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  manageUserTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  manageUserSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    borderRadius: 15,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#7C3AED',
  },
  tabText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  reportIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reportTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  reportDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 12,
  },
  reportFooterRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  statusPillProcess: {
    backgroundColor: '#EEF2FF',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextProcess: {
    color: '#1D4ED8',
  },
  statusTextPending: {
    color: '#92400E',
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  reportMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportMetaText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  actionButtonVerify: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonReject: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DashboardAdmin;