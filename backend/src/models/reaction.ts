import mongoose from "mongoose";

export const REACTION_TYPES = ["like", "dislike"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export interface ReactionData {
  // Meme al que se reacciona.
  meme: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

const reactionSchema = new mongoose.Schema<ReactionData>(
  {
    meme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemesData",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: [...REACTION_TYPES], required: true },
  },
  {
    timestamps: true,
  }
);

// Un usuario solo puede tener UNA reacción por meme (like o dislike). Este
// índice lo garantiza a nivel de base de datos y además acelera el conteo por
// meme.
reactionSchema.index({ meme: 1, user: 1 }, { unique: true });
// Para obtener rápido todas las reacciones de un usuario.
reactionSchema.index({ user: 1 });

const ReactionModel = mongoose.model<ReactionData>("Reaction", reactionSchema);

export interface ReactionCounts {
  likes: number;
  dislikes: number;
}

// Totales de un meme que todavía no tiene reacciones.
export const NO_REACTIONS: ReactionCounts = { likes: 0, dislikes: 0 };

// Cuenta los likes y dislikes de varios memes en una sola consulta. La clave
// del Map es el id del meme (string); los memes sin reacciones no aparecen.
export const getReactionCounts = async (
  memeIds: mongoose.Types.ObjectId[]
): Promise<Map<string, ReactionCounts>> => {
  const rows = await ReactionModel.aggregate<{
    _id: { meme: mongoose.Types.ObjectId; type: ReactionType };
    count: number;
  }>([
    { $match: { meme: { $in: memeIds } } },
    { $group: { _id: { meme: "$meme", type: "$type" }, count: { $sum: 1 } } },
  ]);

  const counts = new Map<string, ReactionCounts>();
  for (const row of rows) {
    const key = row._id.meme.toString();
    const entry = counts.get(key) ?? { likes: 0, dislikes: 0 };
    if (row._id.type === "like") {
      entry.likes = row.count;
    } else {
      entry.dislikes = row.count;
    }
    counts.set(key, entry);
  }
  return counts;
};

// Serializa memes (documentos de Mongoose) agregando sus totales `likes` y
// `dislikes`. TODO endpoint que devuelva memes debe pasar por aquí, para que el
// frontend siempre reciba la misma forma (si no, los contadores salen vacíos).
export const withReactionCounts = async <
  T extends { _id: mongoose.Types.ObjectId; toJSON(): object }
>(
  memes: T[]
) => {
  const counts = await getReactionCounts(memes.map((meme) => meme._id));
  return memes.map((meme) => ({
    ...meme.toJSON(),
    ...(counts.get(meme._id.toString()) ?? NO_REACTIONS),
  }));
};

export default ReactionModel;
