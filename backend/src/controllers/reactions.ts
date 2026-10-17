import express from "express";
import mongoose from "mongoose";
import MemeModel from "../models/memes";
import ReactionModel, {
  REACTION_TYPES,
  getReactionCounts,
  type ReactionType,
} from "../models/reaction";
import { withUser } from "../utils/middleware";

// Se monta en /api/memes/:id/reaction (ver controllers/memes.ts). mergeParams
// hace que aquí también esté disponible el :id del meme.
const router = express.Router({ mergeParams: true });

const isReactionType = (value: unknown): value is ReactionType =>
  typeof value === "string" && (REACTION_TYPES as readonly string[]).includes(value);

// Estado del meme después de reaccionar: la reacción del usuario (null si no
// tiene) y los totales actualizados.
const buildState = async (memeId: string, type: ReactionType | null) => {
  const objectId = new mongoose.Types.ObjectId(memeId);
  const counts = (await getReactionCounts([objectId])).get(objectId.toString());
  return { type, likes: counts?.likes ?? 0, dislikes: counts?.dislikes ?? 0 };
};

// Solo usuarios con sesión. Pone (o cambia) la reacción del usuario a este
// meme. Espera JSON con el campo:
//   - type: "like" o "dislike"
// Como cada usuario tiene una sola reacción por meme, pasar de like a dislike
// reemplaza la anterior en vez de sumar una nueva.
router.put("/", withUser, async (request, response) => {
  const type = request.body?.type;

  if (!isReactionType(type)) {
    response.status(400).json({
      error: `type must be one of: ${REACTION_TYPES.join(", ")}`,
    });
    return;
  }

  const memeExists = await MemeModel.exists({ _id: request.params.id });
  if (!memeExists) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  // El usuario sale de la sesión, nunca de lo que mande el cliente.
  await ReactionModel.findOneAndUpdate(
    { meme: request.params.id, user: request.userId },
    { type },
    { upsert: true, runValidators: true }
  );

  response.json(await buildState(request.params.id, type));
});

// Solo usuarios con sesión. Quita la reacción del usuario a este meme. Si no
// había ninguna, no pasa nada (la operación es idempotente).
router.delete("/", withUser, async (request, response) => {
  const memeExists = await MemeModel.exists({ _id: request.params.id });
  if (!memeExists) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  await ReactionModel.deleteOne({
    meme: request.params.id,
    user: request.userId,
  });

  response.json(await buildState(request.params.id, null));
});

export default router;
