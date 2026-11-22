import mongoose from "mongoose";

// Acciones que quedan registradas en la bitácora.
export const MODERATION_ACTIONS = [
  "remove_meme",
  "remove_comment",
  "lock_comments",
  "unlock_comments",
  "dismiss_reports",
  "ban_user",
  "unban_user",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_TARGET_TYPES = ["meme", "comment", "user"] as const;

export interface ModerationLogData {
  // Admin que hizo la acción.
  admin: mongoose.Types.ObjectId;
  action: ModerationAction;
  targetType: (typeof MODERATION_TARGET_TYPES)[number];
  // Meme sobre el que se actuó (o que contiene al comentario). Es null cuando la
  // acción es sobre un usuario (baneo, desbaneo, reportes de un usuario).
  meme: mongoose.Types.ObjectId | null;
  comment: mongoose.Types.ObjectId | null;
  // Autor del contenido sobre el que se actuó, o el propio usuario baneado.
  targetUser: mongoose.Types.ObjectId;
  // Motivo escrito por el admin (en las eliminaciones y los baneos).
  reason: string | null;
  createdAt: Date;
}

const moderationLogSchema = new mongoose.Schema<ModerationLogData>(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: [...MODERATION_ACTIONS], required: true },
    targetType: { type: String, enum: [...MODERATION_TARGET_TYPES], required: true },
    meme: { type: mongoose.Schema.Types.ObjectId, ref: "MemesData", default: null },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: null },
  },
  {
    // La bitácora solo se agrega: no se edita, así que no hace falta updatedAt.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

moderationLogSchema.index({ createdAt: -1 });

const ModerationLogModel = mongoose.model<ModerationLogData>(
  "ModerationLog",
  moderationLogSchema
);

export default ModerationLogModel;
