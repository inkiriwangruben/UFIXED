import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type TimelineTone = 'warning' | 'info' | 'accent' | 'success';
type TimelineState = 'done' | 'current';
type WorkflowSource =
  | 'pelapor'
  | 'admin'
  | 'unit'
  | 'business-office'
  | 'unknown';

interface TimelineItem {
  id: string;
  title: string;
  badge: string;
  actor: string;
  role: string;
  date: string;
  tone: TimelineTone;
  state: TimelineState;
}

interface TimelineStepDefinition {
  id: string;
  title: string;
  currentBadge: string;
  doneBadge: string;
  actor: string;
  role: string;
  currentTone: TimelineTone;
  doneTone: TimelineTone;
}

const formatPriorityLabel = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'Kritis';
    case 'high':
      return 'Tinggi';
    case 'medium':
      return 'Sedang';
    default:
      return 'Rendah';
  }
};

const getPriorityPalette = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
      return { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C' };
    case 'high':
      return { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C' };
    case 'medium':
      return { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8' };
    default:
      return { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D' };
  }
};

const getTimelineBadgeStyle = (tone: TimelineTone) => {
  switch (tone) {
    case 'warning':
      return {
        backgroundColor: '#FEF3C7',
        color: '#A16207',
        icon: 'clock-outline' as const,
      };
    case 'accent':
      return {
        backgroundColor: '#FFF1E7',
        color: '#EA580C',
        icon: 'progress-clock' as const,
      };
    case 'success':
      return {
        backgroundColor: '#DCFCE7',
        color: '#166534',
        icon: 'check-circle-outline' as const,
      };
    default:
      return {
        backgroundColor: '#DBEAFE',
        color: '#2563EB',
        icon: 'check-circle-outline' as const,
      };
  }
};

const withDefaultTime = (date: string) => {
  if (date.includes(':')) {
    return date;
  }

  return `${date}, 08:00`;
};

const withoutTime = (date: string) => date.replace(/,\s*\d{1,2}:\d{2}$/, '');

const resolveWorkflowSource = (
  workflowSource?: string,
  returnPath?: string
): WorkflowSource => {
  switch (workflowSource) {
    case 'pelapor':
    case 'admin':
    case 'unit':
    case 'business-office':
      return workflowSource;
    default:
      break;
  }

  if (!returnPath) {
    return 'unknown';
  }

  if (returnPath.includes('DashboardPelapor')) {
    return 'pelapor';
  }

  if (returnPath.includes('DashboardAdmin')) {
    return 'admin';
  }

  if (
    returnPath.includes('DashboardDepartmentIT') ||
    returnPath.includes('DashboardTukang')
  ) {
    return 'unit';
  }

  if (returnPath.includes('DashboardBusinessOffice')) {
    return 'business-office';
  }

  return 'unknown';
};

const inferCurrentStepIndex = ({
  source,
  status,
  actionState,
}: {
  source: WorkflowSource;
  status: string;
  actionState: string;
}) => {
  const normalizedStatus = status.toLowerCase();
  const normalizedAction = actionState.toLowerCase();

  if (normalizedStatus === 'selesai' || normalizedAction === 'completed') {
    return 5;
  }

  if (normalizedAction === 'repairing') {
    return 4;
  }

  switch (source) {
    case 'pelapor':
      return normalizedStatus === 'selesai' ? 5 : 4;
    case 'admin':
      return normalizedAction === 'accepted' || normalizedStatus === 'verifikasi' ? 2 : 1;
    case 'unit':
      if (normalizedAction === 'accepted') {
        return 3;
      }
      if (normalizedAction === 'new') {
        return 2;
      }
      return normalizedStatus === 'proses' ? 4 : 2;
    case 'business-office':
      if (normalizedAction === 'accepted') {
        return 4;
      }
      return 3;
    default:
      if (normalizedStatus === 'pending') {
        return 1;
      }
      if (normalizedStatus === 'verifikasi') {
        return 2;
      }
      if (normalizedStatus === 'approved') {
        return 3;
      }
      if (normalizedStatus === 'proses') {
        return 4;
      }
      return 0;
  }
};

const buildTimeline = ({
  source,
  status,
  actionState,
  isIT,
  pelapor,
  dibuatPada,
}: {
  source: WorkflowSource;
  status: string;
  actionState: string;
  isIT: boolean;
  pelapor: string;
  dibuatPada: string;
}): TimelineItem[] => {
  const handlerName = isIT ? 'Department IT' : 'Tukang';
  const handlerRole = isIT ? 'department it' : 'tukang';
  const currentIndex = inferCurrentStepIndex({ source, status, actionState });

  const template: TimelineStepDefinition[] = [
    {
      id: 'reporter',
      title: 'Pelapor membuat laporan',
      currentBadge: 'Laporan berhasil dibuat',
      doneBadge: 'Laporan berhasil dibuat',
      actor: pelapor,
      role: 'pelapor',
      currentTone: 'info',
      doneTone: 'info',
    },
    {
      id: 'admin-review',
      title: 'Admin konfirmasi laporan',
      currentBadge: 'Menunggu konfirmasi admin',
      doneBadge: 'Diterima',
      actor: 'Admin',
      role: 'admin',
      currentTone: 'warning',
      doneTone: 'info',
    },
    {
      id: 'unit-review',
      title: `${handlerName} konfirmasi laporan`,
      currentBadge: `Menunggu konfirmasi ${handlerName}`,
      doneBadge: 'Diterima',
      actor: handlerName,
      role: handlerRole,
      currentTone: 'warning',
      doneTone: 'info',
    },
    {
      id: 'business-office-review',
      title: 'Business Office konfirmasi laporan',
      currentBadge: 'Menunggu konfirmasi biaya',
      doneBadge: 'Diterima',
      actor: 'Business Office',
      role: 'business office',
      currentTone: 'warning',
      doneTone: 'info',
    },
    {
      id: 'repair-progress',
      title: 'Perbaikan sedang berjalan',
      currentBadge: 'Proses',
      doneBadge: 'Proses',
      actor: handlerName,
      role: handlerRole,
      currentTone: 'accent',
      doneTone: 'accent',
    },
    {
      id: 'repair-complete',
      title: 'Perbaikan selesai',
      currentBadge: 'Selesai',
      doneBadge: 'Selesai',
      actor: handlerName,
      role: handlerRole,
      currentTone: 'success',
      doneTone: 'success',
    },
  ];

  const visibleTimeline = template.slice(0, currentIndex + 1);

  return visibleTimeline.map((item, index) => {
    const isCurrent = index === visibleTimeline.length - 1;

    return {
      id: item.id,
      title: item.title,
      badge: isCurrent ? item.currentBadge : item.doneBadge,
      actor: item.actor,
      role: item.role,
      date: withoutTime(dibuatPada),
      tone: isCurrent ? item.currentTone : item.doneTone,
      state: isCurrent ? 'current' : 'done',
    };
  });
};

const DetailLaporan: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const data = {
    id: (params.id as string) || 'L000',
    kategori: (params.category as string) || 'IT',
    judul: (params.title as string) || 'Judul Laporan',
    pelapor: (params.author as string) || 'Nama Pelapor',
    dibuatPada: withDefaultTime((params.date as string) || '15/01/2026'),
    deskripsi: (params.description as string) || 'Tidak ada deskripsi.',
    statusBadge: (params.status as string) || 'proses',
    actionState: (params.actionState as string) || '',
    workflowSource: resolveWorkflowSource(
      params.workflowSource as string,
      params.returnPath as string
    ),
    icon: (params.icon as string) || 'monitor',
    priority: (params.priority as string) || 'medium',
  };

  const isIT = data.kategori === 'IT';
  const priorityPalette = getPriorityPalette(data.priority);
  const timelineItems = buildTimeline({
    source: data.workflowSource,
    status: data.statusBadge,
    actionState: data.actionState,
    isIT,
    pelapor: data.pelapor,
    dibuatPada: data.dibuatPada,
  });

  const handleBack = () => {
    if (params.returnPath) {
      router.replace(params.returnPath as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/Screens/LoginScreen');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFCFE" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Detail Laporan</Text>
          <Text style={styles.headerSubtitle}>ID : {data.id}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.summaryTopRow}>
            <View
              style={[
                styles.summaryIconCard,
                !isIT && styles.summaryIconCardNonIT,
              ]}
            >
              <Feather
                name={data.icon === 'monitor' ? 'monitor' : 'tool'}
                size={21}
                color={isIT ? '#2D5BFF' : '#EA580C'}
              />
            </View>

            <View style={styles.summaryBadgeRow}>
              <View
                style={[
                  styles.categoryChip,
                  !isIT && styles.categoryChipNonIT,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    !isIT && styles.categoryChipTextNonIT,
                  ]}
                >
                  {data.kategori}
                </Text>
              </View>

              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: priorityPalette.bg,
                    borderColor: priorityPalette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.priorityBadgeText,
                    { color: priorityPalette.text },
                  ]}
                >
                  {formatPriorityLabel(data.priority)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.reportTitle}>{data.judul}</Text>

          <View style={styles.metaItem}>
            <MaterialCommunityIcons
              name="account-circle"
              size={18}
              color="#9CA3AF"
            />
            <Text style={styles.metaText}>{data.pelapor}</Text>
          </View>

          <View style={styles.metaItem}>
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={17}
              color="#9CA3AF"
            />
            <Text style={styles.metaText}>Dibuat {data.dibuatPada}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Deskripsi kerusakan</Text>
          <Text style={styles.descriptionText}>{data.deskripsi}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline Proses</Text>

          <View style={styles.timelineList}>
            {timelineItems.map((item, index) => {
              const badgeStyle = getTimelineBadgeStyle(item.tone);
              const isCurrent = item.state === 'current';
              const isDone = item.state === 'done';
              const isLast = index === timelineItems.length - 1;

              return (
                <View key={item.id} style={styles.timelineItemRow}>
                  <View style={styles.timelineIndicatorColumn}>
                    <View
                      style={[
                        styles.timelineDot,
                        isCurrent && styles.timelineDotCurrent,
                        isDone && styles.timelineDotDone,
                      ]}
                    />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  <View
                    style={[
                      styles.timelineContent,
                      isLast && styles.timelineContentLast,
                    ]}
                  >
                    <Text style={styles.timelineTitle}>{item.title}</Text>

                    <View
                      style={[
                        styles.timelineBadge,
                        { backgroundColor: badgeStyle.backgroundColor },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={badgeStyle.icon}
                        size={12}
                        color={badgeStyle.color}
                      />
                      <Text
                        style={[
                          styles.timelineBadgeText,
                          { color: badgeStyle.color },
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>

                    <Text style={styles.timelineActor}>
                      {item.actor}
                      <Text style={styles.timelineRole}> ({item.role})</Text>
                    </Text>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCFCFE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D4DAE5',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 14,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryIconCard: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryIconCardNonIT: {
    backgroundColor: '#FFF1E7',
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  categoryChip: {
    borderRadius: 7,
    backgroundColor: '#EFF4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  categoryChipNonIT: {
    backgroundColor: '#FFF1E7',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D5BFF',
  },
  categoryChipTextNonIT: {
    color: '#EA580C',
  },
  priorityBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reportTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  metaText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
  },
  timelineList: {
    paddingTop: 4,
  },
  timelineItemRow: {
    flexDirection: 'row',
  },
  timelineIndicatorColumn: {
    width: 22,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A1A1AA',
    marginTop: 5,
  },
  timelineDotDone: {
    backgroundColor: '#8B8E98',
  },
  timelineDotCurrent: {
    backgroundColor: '#2D5BFF',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#C8CDD8',
    marginTop: 6,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
  },
  timelineContentLast: {
    paddingBottom: 0,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  timelineBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  timelineBadgeText: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: '600',
  },
  timelineActor: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 3,
  },
  timelineRole: {
    color: '#9CA3AF',
  },
  timelineDate: {
    fontSize: 12,
    color: '#98A2B3',
  },
});

export default DetailLaporan;
