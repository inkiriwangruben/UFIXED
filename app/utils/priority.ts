export const formatPriorityLabel = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'Kritis';
    case 'high':
      return 'Tinggi';
    case 'medium':
      return 'Sedang';
    default:
      return 'Rendah';
  }
};
