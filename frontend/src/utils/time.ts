// Convierte una fecha en un texto corto como "Hace 5m", igual al formato que
// tenían los comentarios de prueba. Pasados 7 días se muestra la fecha.
export const timeAgo = (isoDate: string): string => {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (seconds < 60) return "Ahora";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;

  return new Date(isoDate).toLocaleDateString();
};
