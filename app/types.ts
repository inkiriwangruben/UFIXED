import type { CanonicalUserRole } from "@/lib/roles";

export type UserRole = CanonicalUserRole;

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string;
}
