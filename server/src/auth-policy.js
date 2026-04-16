const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INTERNAL_ALLOWED_EMAIL_DOMAINS = ["unklab.ac.id"];
const PELAPOR_ALLOWED_EMAIL_DOMAINS = [
  "student.unklab.ac.id",
  "unklab.ac.id",
];

const normalizeEmail = (value = "") =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";

const getEmailDomain = (email = "") => normalizeEmail(email).split("@")[1] || "";

const getAllowedDomainsForRole = (role = "") => {
  if (role === "pelapor") {
    return PELAPOR_ALLOWED_EMAIL_DOMAINS;
  }

  return INTERNAL_ALLOWED_EMAIL_DOMAINS;
};

const isEmailAllowedForRole = (email = "", role = "") => {
  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return false;
  }

  return getAllowedDomainsForRole(role).includes(getEmailDomain(normalizedEmail));
};

const getEmailValidationMessageForRole = (role = "") => {
  const domains = getAllowedDomainsForRole(role);

  if (domains.length === 1) {
    return `Gunakan email @${domains[0]}.`;
  }

  return `Gunakan email @${domains[0]} atau @${domains[1]}.`;
};

module.exports = {
  EMAIL_REGEX,
  INTERNAL_ALLOWED_EMAIL_DOMAINS,
  PELAPOR_ALLOWED_EMAIL_DOMAINS,
  normalizeEmail,
  getEmailDomain,
  getAllowedDomainsForRole,
  isEmailAllowedForRole,
  getEmailValidationMessageForRole,
};
