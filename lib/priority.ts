export const formatPriorityLabel = (priority?: string | null) => {
  if (!priority) {
    return "Belum ditentukan";
  }

  switch (priority.toLowerCase()) {
    case "critical":
      return "Kritis";
    case "high":
      return "Tinggi";
    case "medium":
      return "Sedang";
    case "low":
      return "Rendah";
    default:
      return "Belum ditentukan";
  }
};
