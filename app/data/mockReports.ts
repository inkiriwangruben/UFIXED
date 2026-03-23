export type ReportCategory = 'IT' | 'Non-IT';
export type ReportIcon = 'monitor' | 'tools';
export type PelaporStatus = 'proses' | 'selesai';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface MockPelaporReport {
  id: string;
  title: string;
  description: string;
  status: PelaporStatus;
  priority: Priority;
  icon: ReportIcon;
  category: ReportCategory;
  date: string;
  author: string;
}

export interface MockAdminReport {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'verifikasi';
  priority: Priority;
  icon: ReportIcon;
  date: string;
  author: string;
  actionState: 'new' | 'accepted';
}

export interface MockDepartmentITReport {
  id: string;
  title: string;
  description: string;
  tabStatus: 'proses' | 'selesai';
  priority: Priority;
  icon: 'monitor';
  date: string;
  author: string;
  actionState: 'new' | 'accepted' | 'repairing' | 'completed';
}

export interface MockTukangReport {
  id: string;
  title: string;
  description: string;
  tabStatus: 'proses' | 'selesai';
  priority: Priority;
  icon: 'tools';
  date: string;
  author: string;
  actionState: 'new' | 'accepted' | 'repairing' | 'completed';
}

export interface MockBusinessOfficeReport {
  id: string;
  title: string;
  description: string;
  tabStatus: 'approved' | 'selesai';
  priority: Priority;
  icon: ReportIcon;
  date: string;
  author: string;
  actionState: 'new' | 'accepted';
}

export const laporanPelaporMock: MockPelaporReport[] = [
  {
    id: '1',
    title: 'GK 2, komputer lab 1, monitor tidak menyala',
    description:
      'tadi pagi di jam 10:00 saya masuk kelas, dan pada saat saya mau pakai monitor monitornya tidak bisa menyala',
    status: 'proses',
    priority: 'medium',
    icon: 'monitor',
    category: 'IT',
    date: '29/01/2026',
    author: 'Ruben Inkiriwang',
  },
  {
    id: '2',
    title: 'AC Perpustakaan Bocor',
    description: 'ac perpustakaan bocor dan air nya keluar terus',
    status: 'selesai',
    priority: 'high',
    icon: 'tools',
    category: 'Non-IT',
    date: '16/01/2026',
    author: 'Ruben Inkiriwang',
  },
  {
    id: '3',
    title: 'LCD Ruang 204 Tidak Menampilkan Gambar',
    description:
      'layar LCD di ruang 204 menyala tetapi tidak menampilkan output dari laptop walaupun kabel HDMI sudah diganti',
    status: 'proses',
    priority: 'high',
    icon: 'monitor',
    category: 'IT',
    date: '04/03/2026',
    author: 'Ruben Inkiriwang',
  },
  {
    id: '4',
    title: 'Pintu Toilet Lantai 2 Sulit Ditutup',
    description:
      'pintu toilet di lantai 2 seret saat ditutup dan kuncinya tidak bisa berfungsi dengan baik sejak kemarin sore',
    status: 'proses',
    priority: 'low',
    icon: 'tools',
    category: 'Non-IT',
    date: '07/03/2026',
    author: 'Ruben Inkiriwang',
  },
];

export const laporanAdminMock: MockAdminReport[] = laporanPelaporMock.map((item) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  status: item.status === 'selesai' ? 'verifikasi' : 'pending',
  priority: item.priority,
  icon: item.icon,
  date: item.date,
  author: item.author,
  actionState: item.status === 'selesai' ? 'accepted' : 'new',
}));

export const laporanDepartmentITMock: MockDepartmentITReport[] = laporanPelaporMock
  .filter((item) => item.category === 'IT')
  .map((item, index) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tabStatus: item.status,
    priority: item.priority,
    icon: 'monitor',
    date: item.date,
    author: item.author,
    actionState: index === 0 ? 'accepted' : 'new',
  }));

export const laporanTukangMock: MockTukangReport[] = laporanPelaporMock
  .filter((item) => item.category === 'Non-IT')
  .map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tabStatus: item.status,
    priority: item.priority,
    icon: 'tools',
    date: item.date,
    author: item.author,
    actionState: item.status === 'selesai' ? 'completed' : 'new',
  }));

export const laporanBusinessOfficeMock: MockBusinessOfficeReport[] = laporanPelaporMock.map(
  (item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tabStatus: item.status === 'selesai' ? 'selesai' : 'approved',
    priority: item.priority,
    icon: item.icon,
    date: item.date,
    author: item.author,
    actionState: item.status === 'selesai' ? 'accepted' : 'new',
  })
);
