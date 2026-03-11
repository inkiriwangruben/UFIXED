import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

const DetailLaporan: React.FC = () => {
  const router = useRouter();

  // Dummy data contoh, nanti bisa disambungkan ke backend / params
  const data = {
    id: 'L001',
    kategori: 'IT',
    judul: 'GK 2, komputer lab 1, monitor tidak menyala',
    pelapor: 'Ruben Inkiriwang',
    dibuatPada: 'Dibuat 15/01/2026, 08:00',
    deskripsi:
      'tadi pagi di jam 10:00 saya masuk kelas, dan pada saat saya mau pakai monitor monitornya tidak bisa menyala',
    statusLabel: 'Menunggu',
    statusBadge: 'Menunggu',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/Screens/DashboardPelapor')}
        >
          <Feather name="arrow-left" size={28} color="#111827" />
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
        {/* KARTU UTAMA */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View style={styles.kategoriRow}>
              <View style={styles.kategoriIconCircle}>
                <Feather name="monitor" size={22} color="#1E40AF" />
              </View>
              <View style={styles.kategoriChip}>
                <Text style={styles.kategoriChipText}>{data.kategori}</Text>
              </View>
            </View>

            <View style={styles.statusChip}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color="#92400E"
              />
              <Text style={styles.statusChipText}>{data.statusBadge}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>{data.judul}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItemRow}>
              <Feather name="user" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{data.pelapor}</Text>
            </View>
          </View>

          <View style={styles.metaItemRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{data.dibuatPada}</Text>
          </View>
        </View>

        {/* DESKRIPSI KERUSAKAN */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Deskripsi kerusakan</Text>
          <Text style={styles.descriptionText}>{data.deskripsi}</Text>
        </View>

        {/* TIMELINE PROSES */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline Proses</Text>

          <View style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={styles.timelineDotOuter}>
                <View style={styles.timelineDotInner} />
              </View>
            </View>

            <View style={styles.timelineContent}>
              <View style={styles.timelineHeaderRow}>
                <Text style={styles.timelineTitle}>Laporan dibuat</Text>
                <View style={[styles.statusChip, styles.statusChipSmall]}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="#92400E"
                  />
                  <Text style={styles.statusChipText}>{data.statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.timelineMetaName}>
                {data.pelapor}
                <Text style={styles.timelineMetaRole}>(pelapor)</Text>
              </Text>
              <Text style={styles.timelineMetaDate}>15/01/2026, 08:00</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 6) : 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kategoriRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kategoriIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  kategoriChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  kategoriChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
  },
  statusChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
  timelineRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  timelineLeft: {
    paddingTop: 6,
    paddingRight: 10,
  },
  timelineDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  timelineMetaName: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  timelineMetaRole: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timelineMetaDate: {
    fontSize: 11,
    color: '#6B7280',
  },
});

export default DetailLaporan;

