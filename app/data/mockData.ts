import type { User } from "@/app/types";

export const mockUsers: User[] = [
  { id: '1', name: 'Pelapor Demo', role: 'pelapor', email: 'pelapor@unklab.ac.id' },
  { id: '2', name: 'Admin Demo', role: 'admin', email: 'admin@unklab.ac.id' },
  { id: '3', name: 'IT Demo', role: 'it', email: 'it@unklab.ac.id' },
  { id: '4', name: 'Tukang Demo', role: 'tukang', email: 'tukang@unklab.ac.id' },
  { id: '5', name: 'Business Demo', role: 'business-office', email: 'bo@unklab.ac.id' },
];

let currentUser: User | null = null;

export function setCurrentUser(user: User) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}
