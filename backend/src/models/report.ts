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

// A partir de cuántos reportes PENDIENTES un contenido (publicación, comentario
// o usuario) se considera "en alerta": el botón de reportes del header de los
// admins muestra una marca para que lo revisen. Es la ÚNICA definición del
// umbral: el frontend lo recibe de `GET /api/admin/reports/alerts` y la marca
// `inAlert` de cada elemento de las listas ya viene calculada por el backend.
export const REPORT_ALERT_THRESHOLD = 5;

// Qué se reporta: un meme, un comentario o un usuario (su perfil o su conducta).
export const REPORT_TARGET_TYPES = ["meme", "comment", "user"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

// pending:   nadie lo ha revisado todavía.
// accepted:  un admin actuó (eliminó el contenido o baneó al usuario).
// dismissed: un admin lo revisó y decidió no actuar.
export const REPORT_STATUSES = ["pending", "accepted", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportData {
  targetType: ReportTargetType;
  // Meme reportado, o el meme que contiene al comentario reportado. Se guarda
  // siempre para poder agrupar y limpiar los reportes de un meme. Es null en los
  // reportes de usuario.
  meme: mongoose.Types.ObjectId | null;
  // Comentario reportado (null si lo reportado es un meme o un usuario).
  comment: mongoose.Types.ObjectId | null;
  reporter: mongoose.Types.ObjectId;
  // Autor del contenido reportado (o el propio usuario reportado, si el reporte
  // es de tipo "user"), copiado al crear el reporte.
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
      // Solo los reportes de meme y de comentario tienen meme.
      required: function (this: { targetType?: string }) {
        return this.targetType !== "user";
      },
      default: null,
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

// Cada usuario puede reportar un mismo contenido (o a un mismo usuario) UNA sola
// vez, aunque el reporte ya se haya descartado. El tipo y el autor forman parte
// del índice porque en los reportes de usuario `meme` y `comment` son siempre
// null: sin ellos, un usuario solo podría reportar a otro usuario en toda su
// vida. (Reemplaza al índice anterior, `reporter + meme + comment`; ese se
// elimina solo al arrancar el backend, ver `syncIndexes` en app.ts.)
reportSchema.index(
  { reporter: 1, targetType: 1, meme: 1, comment: 1, targetUser: 1 },
  { unique: true }
);
// Para listar los reportes de un tipo según su estado (vista de administración).
reportSchema.index({ targetType: 1, status: 1, createdAt: -1 });
// Para saber qué reportes tiene un usuario (sus contenidos y él mismo).
reportSchema.index({ targetUser: 1, status: 1 });
// Para limpiar los reportes de un meme o de un comentario.
reportSchema.index({ meme: 1 });
reportSchema.index({ comment: 1 });
// Para el límite de reportes por hora.
reportSchema.index({ reporter: 1, createdAt: -1 });

const ReportModel = mongoose.model<ReportData>("Report", reportSchema);

// Respuesta (409) cuando el AUTOR intenta editar o eliminar un contenido que
// todavía tiene reportes pendientes. Mientras un admin no los resuelva, el
// contenido no puede cambiar ni desaparecer: si no, se podría corregir o borrar
// justo lo reportado y dejar al admin revisando otra cosa. El `code` permite al
// frontend mostrar su propio mensaje sin depender del texto en inglés.
export const PENDING_REPORTS_ERROR = {
  error:
    "this content has pending reports and cannot be edited or deleted until an admin reviews them",
  code: "pending_reports",
} as const;

type Id = string | mongoose.Types.ObjectId;

// ¿Este meme tiene reportes pendientes? (Los reportes de sus comentarios no
// cuentan: son de otros usuarios y de otro contenido.)
export const memeHasPendingReports = async (memeId: Id): Promise<boolean> =>
  Boolean(
    await ReportModel.exists({ targetType: "meme", meme: memeId, status: "pending" })
  );

// ¿Este comentario tiene reportes pendientes?
export const commentHasPendingReports = async (commentId: Id): Promise<boolean> =>
  Boolean(await ReportModel.exists({ comment: commentId, status: "pending" }));

export default ReportModel;
