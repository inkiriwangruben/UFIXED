// This file is now deprecated. All report data is stored in Firebase Firestore.
// The interfaces below are kept for reference only.

export type ReportCategory = "IT" | "Non-IT";
export type ReportIcon = "monitor" | "tools";
export type PelaporStatus = "proses" | "selesai";
export type Priority = "low" | "medium" | "high" | "critical";

// Legacy interfaces - no longer used
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
  status: "pending" | "verifikasi";
  priority: Priority;
  icon: ReportIcon;
  date: string;
  author: string;
  actionState: "new" | "accepted";
}

export interface MockDepartmentITReport {
  id: string;
  title: string;
  description: string;
  tabStatus: "proses" | "selesai";
  priority: Priority;
  icon: "monitor";
  date: string;
  author: string;
  actionState: "new" | "accepted" | "repairing" | "completed";
}

export interface MockTukangReport {
  id: string;
  title: string;
  description: string;
  tabStatus: "proses" | "selesai";
  priority: Priority;
  icon: "tools";
  date: string;
  author: string;
  actionState: "new" | "accepted" | "repairing" | "completed";
}

export interface MockBusinessOfficeReport {
  id: string;
  title: string;
  description: string;
  tabStatus: "approved" | "selesai";
  priority: Priority;
  icon: ReportIcon;
  date: string;
  author: string;
  actionState: "new" | "accepted";
}

// All mock data has been removed. Reports are now stored in Firebase Firestore.
// Use the respective dashboard screens to fetch real data.
