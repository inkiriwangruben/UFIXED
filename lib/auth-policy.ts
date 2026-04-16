import type { CanonicalUserRole } from "@/lib/roles";

export const INTERNAL_ALLOWED_EMAIL_DOMAINS = ["unklab.ac.id"] as const;
export const PELAPOR_ALLOWED_EMAIL_DOMAINS = [
  "student.unklab.ac.id",
  "unklab.ac.id",
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeManagedEmail = (value: string) =>
  value.trim().toLowerCase();

export const getEmailDomain = (email: string) =>
  normalizeManagedEmail(email).split("@")[1] || "";

export const getAllowedDomainsForRole = (
  role: CanonicalUserRole | "",
): readonly string[] => {
  if (!role) {
    return [];
  }

  if (role === "pelapor") {
    return PELAPOR_ALLOWED_EMAIL_DOMAINS;
  }

  return INTERNAL_ALLOWED_EMAIL_DOMAINS;
};

export const isEmailAllowedForRole = (
  email: string,
  role: CanonicalUserRole | "",
) => {
  const normalizedEmail = normalizeManagedEmail(email);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return false;
  }

  if (!role) {
    return true;
  }

  const domain = getEmailDomain(normalizedEmail);
  return getAllowedDomainsForRole(role).includes(
    domain as (typeof PELAPOR_ALLOWED_EMAIL_DOMAINS)[number],
  );
};

export const getEmailHintForRole = (role: CanonicalUserRole | "") => {
  const domains = getAllowedDomainsForRole(role);

  if (domains.length === 0) {
    return "Pilih role terlebih dahulu untuk melihat domain email yang diizinkan.";
  }

  if (domains.length === 1) {
    return `Gunakan email aktif @${domains[0]}.`;
  }

  return `Gunakan email aktif @${domains[0]} atau @${domains[1]}.`;
};

export const getEmailValidationMessageForRole = (
  role: CanonicalUserRole | "",
) => {
  const domains = getAllowedDomainsForRole(role);

  if (domains.length === 1) {
    return `Gunakan email @${domains[0]}.`;
  }

  if (domains.length > 1) {
    return `Gunakan email @${domains[0]} atau @${domains[1]}.`;
  }

  return "Pilih role user terlebih dahulu.";
};
