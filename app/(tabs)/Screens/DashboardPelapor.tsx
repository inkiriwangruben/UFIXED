import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { laporanPelaporMock } from '@/app/data/mockReports';
import { formatPriorityLabel } from '@/app/utils/priority';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type PelaporTab = 'semua' | 'proses' | 'selesai';
type PelaporStatus = Exclude<PelaporTab, 'semua'>;
type PelaporIcon = 'monitor' | 'tools';
type PelaporKategori = 'IT' | 'Non-IT';

interface PelaporLaporan {
  id: string;
  title: string;
  description: string;
  status: PelaporStatus;
  priority: string;
  icon: PelaporIcon;
  category: PelaporKategori;
  date: string;
  author: string;
}

const laporanPelapor: PelaporLaporan[] = laporanPelaporMock as any;

const DashboardPelapor: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PelaporTab>('semua');

  const filteredLaporan = useMemo(() => {
    if (activeTab === 'semua') {
      return laporanPelapor;
    }

    return laporanPelapor.filter((item) => item.status === activeTab);
  }, [activeTab]);

  const summary = {
    semua: laporanPelapor.length,
    proses: laporanPelapor.filter((item) => item.status === 'proses').length,
    selesai: laporanPelapor.filter((item) => item.status === 'selesai').length,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER BIRU */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerUserRow}>
              <View style={styles.avatarCircle}>
                <Feather name="user" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerWelcome}>Selamat datang</Text>
                <Text style={styles.headerName}>Ruben Inkiriwang</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push('/(tabs)/Screens/Notifikasi')}
              >
                <Feather name="bell" size={18} color="#1E5BFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.replace('/(tabs)/Screens/LoginScreen')}
              >
                <Feather name="log-out" size={18} color="#1E5BFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* STAT KARTU */}
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
              <Text style={styles.statValue}>{summary.proses}</Text>
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

        {/* KONTEN PUTIH DI BAWAH HEADER */}
        <View style={styles.content}>
          {/* TOMBOL BUAT LAPORAN BARU */}
          <View style={styles.newReportWrapper}>
            <TouchableOpacity
              style={styles.newReportButton}
              onPress={() => router.push('/(tabs)/Screens/FormLaporan')}
            >
              <View style={styles.newReportPlusCircle}>
                <Feather name="plus" size={22} color="#1E5BFF" />
              </View>
              <Text style={styles.newReportText}>Buat Laporan Baru</Text>
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
                activeTab === 'proses' && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab('proses')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'proses' && styles.tabTextActive,
                ]}
              >
                Laporan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'selesai' && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab('selesai')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'selesai' && styles.tabTextActive,
                ]}
              >
                Selesai
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIST LAPORAN */}
          {filteredLaporan.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.reportCard, index > 0 && { marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={() => 
                router.push({
                  pathname: '/(tabs)/Screens/DetailLaporan',
                  params: {
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    icon: item.icon,
                    category: item.category,
                    date: item.date,
                    author: item.author,
                    priority: item.priority,
                    workflowSource: 'pelapor',
                    returnPath: '/(tabs)/Screens/DashboardPelapor'
                  }
                })
              }
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View style={styles.reportIconCircle}>
                    {item.icon === 'monitor' ? (
                      <Feather name="monitor" size={16} color="#1E5BFF" />
                    ) : (
                      <Feather name="tool" size={16} color="#F97316" />
                    )}
                  </View>
                  <Text style={styles.reportTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </View>

              <Text style={styles.reportDescription} numberOfLines={3}>
                {item.description}
              </Text>

              <View style={styles.reportFooterRow}>
                <View style={styles.reportMetaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.reportMetaItem}>
                      <Feather name="user" size={12} color="#6B7280" />
                      <Text style={styles.reportMetaText}>{item.author}</Text>
                    </View>
                    <View style={styles.reportMetaItem}>
                      <Feather name="calendar" size={12} color="#6B7280" />
                      <Text style={styles.reportMetaText}>{item.date}</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.priorityBadge, 
                    { 
                      backgroundColor: 
                        item.priority === 'critical' ? '#FEF2F2' : 
                        item.priority === 'high' ? '#FFF7ED' : 
                        item.priority === 'medium' ? '#EFF6FF' : '#F0FDF4',
                      borderColor: 
                        item.priority === 'critical' ? '#EF4444' : 
                        item.priority === 'high' ? '#F97316' : 
                        item.priority === 'medium' ? '#3B82F6' : '#22C55E'
                    }
                  ]}>
                    <Text style={[
                    styles.priorityBadgeText,
                      {
                        color: 
                          item.priority === 'critical' ? '#B91C1C' : 
                          item.priority === 'high' ? '#C2410C' : 
                          item.priority === 'medium' ? '#1D4ED8' : '#15803D'
                      }
                    ]}>
                      {formatPriorityLabel(item.priority)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* space bawah */}
          <View style={{ height: 32 }} />
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
  header: {
    backgroundColor: '#1E5BFF',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 90,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff33',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerWelcome: {
    color: '#E5ECFF',
    fontSize: 12,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#3B82F6',
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
    color: '#FFFFFF',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  newReportWrapper: {
    alignItems: 'center',
    marginTop: -66,
    marginBottom: 16,
    marginHorizontal: -20,
  },
  newReportButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  newReportPlusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5EDFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  newReportText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#1E5BFF',
  },
  tabText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reportCard: {
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#E5EDFF',
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
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

export default DashboardPelapor;
