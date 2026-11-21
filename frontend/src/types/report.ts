import type { MemesData } from "./memesData";

// Motivos de reporte. Las claves deben coincidir con REPORT_REASONS del backend
// (backend/src/models/report.ts); los textos son solo de presentación, así que
// cambiarlos o agregar un motivo se hace aquí y allá.
export const REPORT_REASONS = [
  "hate",
  "fraud",
  "fake_news",
  "harassment",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  hate: "Violencia o discurso de odio.",
  fraud: "Estafa o fraude.",
  fake_news: "Fake news.",
  harassment: "Acoso o bullying.",
  other: "Otro",
};

// Límite que valida el backend (backend/src/models/report.ts).
export const MAX_REPORT_DETAILS_LENGTH = 200;
// Límites del motivo que escribe un admin al eliminar algo (backend/src/controllers/admin.ts).
export const MIN_REMOVAL_REASON_LENGTH = 3;
export const MAX_REMOVAL_REASON_LENGTH = 200;

export type ReportStatus = "pending" | "accepted" | "dismissed";

// Qué lista de reportes se ve: los que esperan revisión o los ya resueltos.
export type ReportFilter = "pending" | "resolved";

// Un reporte individual dentro de la vista de administración.
export type ReportEntry = {
  id: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  // Nombre de usuario de quien reportó.
  reporter: string;
  createdAt: string;
};

// Datos de la eliminación por moderación (null si el contenido sigue visible).
export type Removal = {
  at: string;
  by: string;
  reason: string | null;
};

export type ReportedMemeItem = {
  // El meme tiene el mismo formato que en la galería (incluye `commentsLocked`).
  meme: MemesData;
  removal: Removal | null;
  reports: ReportEntry[];
};

export type ReportedCommentItem = {
  comment: {
    id: string;
    // Texto ORIGINAL (aunque el comentario ya esté eliminado): es la evidencia.
    content: string;
    author: string;
    createdAt: string;
  };
  // Post donde está el comentario (null si ya no existe).
  meme: { id: string; image: string; content: string; removed: boolean } | null;
  removal: Removal | null;
  reports: ReportEntry[];
};

export type ReportedUserItem = {
  username: string;
  displayName: string;
  avatar: string | null;
  department: string;
  // Reportes sin revisar y reportes aceptados (el contenido se eliminó).
  pending: number;
  accepted: number;
};
