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

type NotifStatus = 'diverifikasi' | 'dimulai' | 'terverifikasi' | 'selesai';

interface NotifikasiItem {
  id: string;
  title: string;
  description: string;
  status: NotifStatus;
  date: string;
  time: string;
}

const dataNotifikasi: NotifikasiItem[] = [
  {
    id: '1',
    title: 'Laporan Diverifikasi',
    description: "Laporan 'Proyektor Ruang 301 Tidak Menyala' telah diverifikasi oleh Admin.",
    status: 'diverifikasi',
    date: '21 Jan 2026',
    time: '09:15',
  },
  {
    id: '2',
    title: 'Perbaikan Dimulai',
    description:
      "Laporan 'Proyektor Ruang 301 Tidak Menyala' sedang dalam proses perbaikan oleh IT Support.",
    status: 'dimulai',
    date: '22 Jan 2026',
    time: '10:30',
  },
  {
    id: '3',
    title: 'Laporan Terverifikasi',
    description: "Laporan 'AC Perpustakaan Bocor' telah diverifikasi dan diteruskan ke Tukang.",
    status: 'terverifikasi',
    date: '25 Jan 2026',
    time: '09:00',
  },
  {
    id: '4',
    title: 'Perbaikan Selesai',
    description:
      "Perbaikan 'Kursi Kelas Rusak' telah selesai dan disetujui oleh Business Office.",
    status: 'selesai',
    date: '19 Jan 2026',
    time: '16:00',
  },
];

const NotifikasiScreen: React.FC = () => {
  const router = useRouter();

  const jumlahBaru = 2;

  const getStatusStyle = (status: NotifStatus) => {
    if (status === 'dimulai') {
      return {
        iconName: 'progress-clock',
        iconColor: '#2563EB',
        borderColor: '#DBEAFE',
        dotColor: '#2563EB',
      };
    }

    // semua status hijau
    return {
      iconName: 'check-decagram-outline',
      iconColor: '#16A34A',
      borderColor: '#DCFCE7',
      dotColor: '#16A34A',
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={28} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifikasi</Text>
          <Text style={styles.headerSubtitle}>{jumlahBaru} notifikasi baru</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.bellWrapper}>
            <Feather name="bell" size={18} color="#1E5BFF" />
            <View style={styles.bellDot} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {dataNotifikasi.map((item, index) => {
          const stylesStatus = getStatusStyle(item.status);
          return (
            <View
              key={item.id}
              style={[
                styles.card,
                { borderColor: stylesStatus.borderColor },
                index === 0 && styles.cardFirst,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.statusIconWrapper}>
                  <MaterialCommunityIcons
                    name={stylesStatus.iconName as any}
                    size={20}
                    color={stylesStatus.iconColor}
                  />
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardTime}>
                    {item.date}, {item.time}
                  </Text>
                </View>
                {index < jumlahBaru && <View style={styles.unreadDot} />}
              </View>

              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
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
  headerRight: {
    marginLeft: 8,
  },
  bellWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardFirst: {
    marginTop: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cardTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginLeft: 8,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
    marginTop: 4,
  },
});

export default NotifikasiScreen;

