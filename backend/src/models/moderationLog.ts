import mongoose from "mongoose";

// Acciones que quedan registradas en la bitácora.
export const MODERATION_ACTIONS = [
  "remove_meme",
  "remove_comment",
  "lock_comments",
  "unlock_comments",
  "dismiss_reports",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface ModerationLogData {
  // Admin que hizo la acción.
  admin: mongoose.Types.ObjectId;
  action: ModerationAction;
  targetType: "meme" | "comment";
  meme: mongoose.Types.ObjectId;
  comment: mongoose.Types.ObjectId | null;
  // Autor del contenido sobre el que se actuó.
  targetUser: mongoose.Types.ObjectId;
  // Motivo escrito por el admin (en las eliminaciones).
  reason: string | null;
  createdAt: Date;
}

const moderationLogSchema = new mongoose.Schema<ModerationLogData>(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: [...MODERATION_ACTIONS], required: true },
    targetType: { type: String, enum: ["meme", "comment"], required: true },
    meme: { type: mongoose.Schema.Types.ObjectId, ref: "MemesData", required: true },
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
