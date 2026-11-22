import mongoose from "mongoose";

// Motivos entre los que el usuario elige al reportar. Es una lista cerrada que
// valida el backend; los textos que se muestran están en el frontend
// (frontend/src/types/report.ts) y deben mantener estas mismas claves.
export const REPORT_REASONS = [
  "hate",
  "fraud",
  "fake_news",
  "harassment",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// "Otro" obliga a explicar cuál; en los demás motivos el texto es opcional.
export const MAX_REPORT_DETAILS_LENGTH = 200;

// Cuántos reportes puede enviar un usuario por hora (freno a los abusos).
export const MAX_REPORTS_PER_HOUR = 20;

export const REPORT_TARGET_TYPES = ["meme", "comment"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

// pending:   nadie lo ha revisado todavía.
// accepted:  un admin eliminó el contenido (el reporte "tenía razón").
// dismissed: un admin lo revisó y decidió no actuar.
export const REPORT_STATUSES = ["pending", "accepted", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportData {
  targetType: ReportTargetType;
  // Meme reportado, o el meme que contiene al comentario reportado. Se guarda
  // siempre para poder agrupar y limpiar los reportes de un meme.
  meme: mongoose.Types.ObjectId;
  // Comentario reportado (null si lo reportado es el meme).
  comment: mongoose.Types.ObjectId | null;
  reporter: mongoose.Types.ObjectId;
  // Autor del contenido reportado, copiado al crear el reporte. Así el contador
  // de reportes por usuario es una consulta directa y no cambia aunque el
  // contenido se elimine.
  targetUser: mongoose.Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolvedBy: mongoose.Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new mongoose.Schema<ReportData>(
  {
    targetType: { type: String, enum: [...REPORT_TARGET_TYPES], required: true },
    meme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemesData",
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: [...REPORT_REASONS], required: true },
    details: { type: String, trim: true, maxlength: MAX_REPORT_DETAILS_LENGTH, default: "" },
    status: { type: String, enum: [...REPORT_STATUSES], default: "pending" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Cada usuario puede reportar un mismo contenido UNA sola vez (aunque el reporte
// ya se haya descartado). Para los reportes de memes `comment` es null, así que
// el índice también cubre "un reporte por meme".
reportSchema.index({ reporter: 1, meme: 1, comment: 1 }, { unique: true });
// Para listar los reportes de un tipo según su estado (vista de administración).
reportSchema.index({ targetType: 1, status: 1, createdAt: -1 });
// Para el contador de reportes por usuario.
reportSchema.index({ targetUser: 1, status: 1 });
// Para limpiar los reportes de un meme o de un comentario.
reportSchema.index({ meme: 1 });
reportSchema.index({ comment: 1 });
// Para el límite de reportes por hora.
reportSchema.index({ reporter: 1, createdAt: -1 });

const ReportModel = mongoose.model<ReportData>("Report", reportSchema);

export default ReportModel;
