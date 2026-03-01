export type UserRole = 'pelapor' | 'admin' | 'it' | 'tukang' | 'business-office';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string;
}
