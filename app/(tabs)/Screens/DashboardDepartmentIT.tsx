import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { laporanDepartmentITMock } from '@/app/data/mockReports';
import { formatPriorityLabel } from '@/app/utils/priority';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type DepartmentITTab = 'semua' | 'proses' | 'selesai';
type DepartmentITActionState = 'new' | 'accepted' | 'repairing' | 'completed' | 'rejected';

interface DepartmentITReport {
  id: string;
  title: string;
  description: string;
  tabStatus: Exclude<DepartmentITTab, 'semua'>;
  priority: string;
  icon: 'monitor';
  date: string;
  author: string;
  actionState: DepartmentITActionState;
}

const laporanDepartmentIT: DepartmentITReport[] = laporanDepartmentITMock;

const DashboardDepartmentIT: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DepartmentITTab>('semua');
  const [laporanList, setLaporanList] = useState<DepartmentITReport[]>(laporanDepartmentIT);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const visibleLaporan = useMemo(
    () => laporanList.filter((item) => item.actionState !== 'rejected'),
    [laporanList]
  );

  const filteredLaporan = useMemo(() => {
    if (activeTab === 'semua') {
      return visibleLaporan;
    }

    return visibleLaporan.filter((item) => item.tabStatus === activeTab);
  }, [activeTab, visibleLaporan]);

  const summary = useMemo(
    () => ({
      semua: visibleLaporan.length,
      proses: visibleLaporan.filter((item) => item.tabStatus === 'proses').length,
      selesai: visibleLaporan.filter((item) => item.tabStatus === 'selesai').length,
    }),
    [visibleLaporan]
  );

  const handleAcceptReport = (id: string) => {
    setLaporanList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              actionState: 'accepted',
            }
          : item
      )
    );
  };

  const handleStartRepair = (id: string) => {
    setLaporanList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              actionState: 'repairing',
            }
          : item
      )
    );
  };

  const handleFinishRepair = (id: string) => {
    setLaporanList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              tabStatus: 'selesai',
              actionState: 'completed',
            }
          : item
      )
    );
  };

  const handleOpenRejectModal = (id: string) => {
    setSelectedRejectId(id);
    setRejectReason(rejectionReasons[id] ?? '');
    setShowRejectModal(true);
  };

  const handleCloseRejectModal = () => {
    setShowRejectModal(false);
    setSelectedRejectId(null);
    setRejectReason('');
  };

  const handleSubmitRejectReason = () => {
    if (!selectedRejectId || !rejectReason.trim()) {
      return;
    }

    const cleanedReason = rejectReason.trim();

    setRejectionReasons((prev) => ({
      ...prev,
      [selectedRejectId]: cleanedReason,
    }));

    setLaporanList((prev) =>
      prev.map((item) =>
        item.id === selectedRejectId
          ? {
              ...item,
              actionState: 'rejected',
            }
          : item
      )
    );

    handleCloseRejectModal();
  };

  const isRejectDisabled = !rejectReason.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E5BFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(tabs)/Screens/LoginScreen')}
            >
              <Feather name="arrow-left" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Department IT</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

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

        <View style={styles.content}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'semua' && styles.tabItemActive]}
              onPress={() => setActiveTab('semua')}
            >
              <Text style={[styles.tabText, activeTab === 'semua' && styles.tabTextActive]}>
                Semua
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'proses' && styles.tabItemActive]}
              onPress={() => setActiveTab('proses')}
            >
              <Text style={[styles.tabText, activeTab === 'proses' && styles.tabTextActive]}>
                Laporan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'selesai' && styles.tabItemActive]}
              onPress={() => setActiveTab('selesai')}
            >
              <Text style={[styles.tabText, activeTab === 'selesai' && styles.tabTextActive]}>
                Selesai
              </Text>
            </TouchableOpacity>
          </View>

          {filteredLaporan.map((item, index) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.reportCard, index > 0 && styles.reportCardSpacing]}
              activeOpacity={0.9}
              onPress={() => 
                router.push({
                  pathname: '/(tabs)/Screens/DetailLaporan',
                  params: {
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    status: item.tabStatus,
                    icon: item.icon,
                    category: 'IT',
                    date: item.date,
                    author: item.author,
                    priority: item.priority,
                    actionState: item.actionState,
                    workflowSource: 'unit',
                    returnPath: '/(tabs)/Screens/DashboardDepartmentIT'
                  }
                })
              }
            >
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleRow}>
                  <View style={styles.reportIconCircle}>
                    <Feather name={item.icon} size={16} color="#1E40AF" />
                  </View>
                  <Text style={styles.reportTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </View>

              <Text style={styles.reportDescription} numberOfLines={3}>
                {item.description}
              </Text>

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

              {activeTab === 'proses' && item.actionState === 'new' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonAccept}
                    activeOpacity={0.9}
                    onPress={() => handleAcceptReport(item.id)}
                  >
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Terima</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButtonReject}
                    activeOpacity={0.9}
                    onPress={() => handleOpenRejectModal(item.id)}
                  >
                    <Feather name="x-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'proses' && item.actionState === 'accepted' && (
                <View style={styles.singleActionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonRepair}
                    activeOpacity={0.9}
                    onPress={() => handleStartRepair(item.id)}
                  >
                    <Feather name="tool" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Mulai Perbaikan</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'proses' && item.actionState === 'repairing' && (
                <View style={styles.singleActionRow}>
                  <TouchableOpacity
                    style={styles.actionButtonComplete}
                    activeOpacity={0.9}
                    onPress={() => handleFinishRepair(item.id)}
                  >
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Selesai</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {showRejectModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tolak Laporan</Text>
            <Text style={styles.modalSubtitle}>
              Masukkan Alasan Penolakan Untuk Pelapor
            </Text>

            <TextInput
              style={styles.modalTextArea}
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Tulis alasan penolakan..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.modalRejectButton,
                  isRejectDisabled && styles.modalRejectButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleSubmitRejectReason}
                disabled={isRejectDisabled}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Tolak</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                activeOpacity={0.9}
                onPress={handleCloseRejectModal}
              >
                <Feather name="x-circle" size={14} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Batal</Text>
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
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#1E5BFF',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 56,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#DBEAFE',
  },
  headerSpacer: {
    width: 40,
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
    marginTop: 2,
    fontSize: 12,
    color: '#DBEAFE',
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 20,
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
  reportCardSpacing: {
    marginTop: 12,
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
    backgroundColor: '#E8EEFF',
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
    color: '#6B7280',
    marginBottom: 12,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  singleActionRow: {
    marginTop: 10,
  },
  actionButtonAccept: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonReject: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonRepair: {
    backgroundColor: '#EA580C',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonComplete: {
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(69, 91, 146, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  modalTextArea: {
    marginTop: 10,
    minHeight: 105,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  modalActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalRejectButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalRejectButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 32,
  },
});

export default DashboardDepartmentIT;


