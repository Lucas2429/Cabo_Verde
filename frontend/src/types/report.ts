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
// Límites del motivo que escribe un admin al eliminar algo o banear a alguien
// (backend/src/controllers/admin.ts).
export const MIN_REMOVAL_REASON_LENGTH = 3;
export const MAX_REMOVAL_REASON_LENGTH = 200;

export type ReportStatus = "pending" | "accepted" | "dismissed";

// Contenido PROPIO del usuario que tiene reportes pendientes (ids). Mientras un
// admin no los resuelva, el autor no puede editarlo ni eliminarlo.
export type ContentUnderReview = {
  memes: string[];
  comments: string[];
};

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

// Datos de una acción de moderación ya hecha: la eliminación de un contenido o
// el baneo de un usuario (null si el contenido sigue visible o el usuario activo).
export type Removal = {
  at: string;
  by: string;
  reason: string | null;
};

// Todos los elementos de las listas de reportes traen `inAlert`: lo calcula el
// backend (es la única definición del umbral de alerta), y significa que tienen
// REPORT_ALERT_THRESHOLD o más reportes pendientes y siguen activos.

export type ReportedMemeItem = {
  // El meme tiene el mismo formato que en la galería (incluye `commentsLocked`).
  meme: MemesData;
  removal: Removal | null;
  inAlert: boolean;
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
  inAlert: boolean;
  reports: ReportEntry[];
};

export type ReportedUserItem = {
  user: {
    username: string;
    displayName: string;
    avatar: string | null;
    department: string;
  };
  // Datos del baneo si el usuario ya fue baneado (null si su cuenta está activa).
  ban: Removal | null;
  inAlert: boolean;
  reports: ReportEntry[];
};

// Cuántos contenidos hay en alerta, por tipo, y el umbral que usa el backend
// (así el frontend no lo tiene duplicado). Responde GET /api/admin/reports/alerts.
export type AlertCounts = {
  threshold: number;
  memes: number;
  comments: number;
  users: number;
};
