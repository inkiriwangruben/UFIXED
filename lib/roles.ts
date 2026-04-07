export type CanonicalUserRole =
  | "pelapor"
  | "admin"
  | "department-it"
  | "tukang"
  | "business-office";

export type DashboardRoute =
  | "/(tabs)/Screens/DashboardPelapor"
  | "/(tabs)/Screens/DashboardAdmin"
  | "/(tabs)/Screens/DashboardDepartmentIT"
  | "/(tabs)/Screens/DashboardTukang"
  | "/(tabs)/Screens/DashboardBusinessOffice";

type RoleMetadata = {
  shortLabel: string;
  loginLabel: string;
  dashboardRoute: DashboardRoute;
};

const ROLE_METADATA: Record<CanonicalUserRole, RoleMetadata> = {
  pelapor: {
    shortLabel: "Pelapor",
    loginLabel: "Pelapor (Mahasiswa/Dosen/Staf)",
    dashboardRoute: "/(tabs)/Screens/DashboardPelapor",
  },
  admin: {
    shortLabel: "Admin",
    loginLabel: "Admin",
    dashboardRoute: "/(tabs)/Screens/DashboardAdmin",
  },
  "department-it": {
    shortLabel: "Department IT",
    loginLabel: "Department IT",
    dashboardRoute: "/(tabs)/Screens/DashboardDepartmentIT",
  },
  tukang: {
    shortLabel: "Tukang",
    loginLabel: "Tukang",
    dashboardRoute: "/(tabs)/Screens/DashboardTukang",
  },
  "business-office": {
    shortLabel: "Business Office",
    loginLabel: "Business Office",
    dashboardRoute: "/(tabs)/Screens/DashboardBusinessOffice",
  },
};

export const ROLE_OPTIONS = (
  Object.keys(ROLE_METADATA) as CanonicalUserRole[]
).map((value) => ({
  value,
  label: ROLE_METADATA[value].shortLabel,
}));

export const LOGIN_ROLE_OPTIONS = (
  Object.keys(ROLE_METADATA) as CanonicalUserRole[]
).map((value) => ({
  value,
  label: ROLE_METADATA[value].loginLabel,
}));

export const normalizeUserRole = (
  value?: string | null,
): CanonicalUserRole | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const compactRole = value.toLowerCase().replace(/[^a-z]/g, "");

  switch (compactRole) {
    case "pelapor":
    case "pelapormahasiswadosenstaf":
      return "pelapor";
    case "admin":
      return "admin";
    case "departmentit":
    case "it":
      return "department-it";
    case "tukang":
      return "tukang";
    case "businessoffice":
    case "bo":
      return "business-office";
    default:
      return null;
  }
};

export const getRoleLabel = (role: CanonicalUserRole) =>
  ROLE_METADATA[role].shortLabel;

export const getLoginRoleLabel = (role: CanonicalUserRole) =>
  ROLE_METADATA[role].loginLabel;

export const getDashboardRouteByRole = (
  role: CanonicalUserRole,
): DashboardRoute => ROLE_METADATA[role].dashboardRoute;
