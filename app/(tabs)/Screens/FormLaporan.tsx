import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Kategori = 'IT' | 'Non-IT';
type Priority = 'low' | 'medium' | 'high' | 'critical';

const FormLaporan: React.FC = () => {
  const router = useRouter();
  const [kategori, setKategori] = useState<Kategori>('IT');
  const [priority, setPriority] = useState<Priority>('medium');
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/Screens/DashboardPelapor');
    }
  };

  const handleKirim = () => {
    console.log({ kategori, priority, judul, deskripsi });
    handleBack();
  };

  const horizontalPadding = Math.max(16, Math.min(24, SCREEN_WIDTH * 0.06));

  const priorityOptions: { label: string; value: Priority; color: string; desc: string }[] = [
    { label: 'Rendah', value: 'low', color: '#10B981', desc: 'Tidak mendesak' },
    { label: 'Sedang', value: 'medium', color: '#F59E0B', desc: 'Butuh perhatian' },
    { label: 'Tinggi', value: 'high', color: '#EF4444', desc: 'Mendesak' },
    { label: 'Kritis', value: 'critical', color: '#7F1D1D', desc: 'Darurat/Bahaya' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>Buat Laporan Baru</Text>
            <Text style={styles.subtitle}>
              Laporkan Kerusakan Barang di Kampus
            </Text>
          </View>

          {/* Kategori Kerusakan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kategori Kerusakan</Text>
            <View style={styles.kategoriRow}>
              {/* Kartu IT */}
              <TouchableOpacity
                style={[
                  styles.kategoriCard,
                  kategori === 'IT' && styles.kategoriCardITActive,
                ]}
                onPress={() => setKategori('IT')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.kategoriIconWrap,
                    kategori === 'IT' && styles.kategoriIconWrapITActive,
                  ]}
                >
                  <Feather
                    name="monitor"
                    size={28}
                    color={kategori === 'IT' ? '#FFFFFF' : '#2563EB'}
                  />
                </View>
                <Text
                  style={[
                    styles.kategoriTitle,
                    kategori === 'IT' && styles.kategoriTitleITActive,
                  ]}
                >
                  IT
                </Text>
                <View style={styles.kategoriDescWrap}>
                  <Text
                    style={[
                      styles.kategoriDesc,
                      kategori === 'IT' && styles.kategoriDescActive,
                    ]}
                    numberOfLines={2}
                  >
                    Komputer,Proyektor,
                    {'\n'}
                    wifi
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Kartu Non-IT */}
              <TouchableOpacity
                style={[
                  styles.kategoriCard,
                  kategori === 'Non-IT' && styles.kategoriCardNonITActive,
                ]}
                onPress={() => setKategori('Non-IT')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.kategoriIconWrap,
                    kategori === 'Non-IT' && styles.kategoriIconWrapNonITActive,
                  ]}
                >
                  <Feather
                    name="tool"
                    size={28}
                    color={kategori === 'Non-IT' ? '#FFFFFF' : '#6B7280'}
                  />
                </View>
                <Text
                  style={[
                    styles.kategoriTitle,
                    kategori === 'Non-IT' && styles.kategoriTitleNonITActive,
                  ]}
                >
                  Non-IT
                </Text>
                <View style={styles.kategoriDescWrap}>
                  <Text
                    style={[
                      styles.kategoriDesc,
                      kategori === 'Non-IT' && styles.kategoriDescActive,
                    ]}
                    numberOfLines={2}
                  >
                    AC,Kursi,Meja,
                    {'\n'}
                    Pintu
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tingkat Urgensi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tingkat Urgensi</Text>
            <View style={styles.priorityRow}>
              {priorityOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.priorityChip,
                    priority === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '10' }
                  ]}
                  onPress={() => setPriority(opt.value)}
                >
                  <View style={[styles.priorityDot, { backgroundColor: opt.color }]} />
                  <Text style={[
                    styles.priorityText,
                    priority === opt.value && { color: opt.color, fontWeight: '700' }
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {priorityOptions.find(o => o.value === priority)?.desc}
            </Text>
          </View>

          {/* Judul Laporan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Judul Laporan</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Proyektor 301 tidak menyala"
              placeholderTextColor="#9CA3AF"
              value={judul}
              onChangeText={setJudul}
            />
          </View>

          {/* Deskripsi Kerusakan */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Deskripsi Kerusakan</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Jelaskan detail kerusakan, lokasi dan kapan terjadi.."
              placeholderTextColor="#9CA3AF"
              value={deskripsi}
              onChangeText={setDeskripsi}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.hint}>Minimal 20 Karakter</Text>
          </View>


          {/* Upload Foto */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Upload Foto (Opsional)</Text>
            <TouchableOpacity style={styles.uploadArea}>
              <Feather name="camera" size={40} color="#9CA3AF" />
              <Text style={styles.uploadText}>Pilih atau ambil foto</Text>
              <Text style={styles.uploadHint}>
                PNG, JPG hingga 5mb (Maksimal 3 foto)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Kirim Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleKirim}
          >
            <Text style={styles.submitText}>Kirim Laporan</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? 12 : 16,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginLeft: -4,
  },
  title: {
    fontSize: SCREEN_WIDTH < 360 ? 20 : 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
    width: '100%',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  kategoriRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kategoriCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  kategoriCardITActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  kategoriCardNonITActive: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  kategoriIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kategoriIconWrapITActive: {
    backgroundColor: '#2563EB',
  },
  kategoriIconWrapNonITActive: {
    backgroundColor: '#F97316',
  },
  kategoriTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  kategoriTitleITActive: {
    color: '#2563EB',
  },
  kategoriTitleNonITActive: {
    color: '#111827',
  },
  kategoriDescWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  kategoriDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  kategoriDescActive: {
    color: '#6B7280',
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 13,
    color: '#6B7280',
  },
  input: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  uploadArea: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#1E5BFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FormLaporan;

