import express from "express";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReactionModel, {
  NO_REACTIONS,
  withReactionCounts,
  type ReactionType,
} from "../models/reaction";
import User from "../models/user";
import { withUser } from "../utils/middleware";
import { removeImage, saveImage, uploadImage } from "../utils/upload";
import commentsRouter from "./comments";
import reactionsRouter from "./reactions";

const MAX_CONTENT_LENGTH = 300;

const router = express.Router();

// Comentarios de un meme: /api/memes/:id/comments
router.use("/:id/comments", commentsRouter);

// Like / dislike de un meme: /api/memes/:id/reaction
router.use("/:id/reaction", reactionsRouter);

// Público: cualquiera (incluidos invitados) puede ver los memes, con sus
// totales de likes y dislikes.
router.get("/", async (_request, response) => {
  const memes = await MemeModel.find({}).sort({ createdAt: -1 });
  response.json(await withReactionCounts(memes));
});

// Solo usuarios con sesión: la reacción que el usuario puso en cada meme, como
// { "<idDelMeme>": "like" | "dislike" }. Los memes sin reacción no aparecen.
// Va antes de "/:id" para que "reactions" no se confunda con un id.
router.get("/reactions/mine", withUser, async (request, response) => {
  const reactions = await ReactionModel.find({ user: request.userId });

  const mine: Record<string, ReactionType> = {};
  for (const reaction of reactions) {
    mine[reaction.meme.toString()] = reaction.type;
  }
  response.json(mine);
});

router.get("/:id", async (request, response) => {
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).end();
    return;
  }
  const [memeWithCounts] = await withReactionCounts([meme]);
  response.json(memeWithCounts);
});

// Solo usuarios con sesión. Se exige sesión ANTES de procesar el archivo, así
// un invitado no puede ni siquiera subir bytes al servidor.
// Espera multipart/form-data con los campos:
//   - content: descripción (1 a 300 caracteres)
//   - image:   archivo JPG/PNG/WEBP/GIF de hasta 2 MB
router.post("/", withUser, uploadImage, async (request, response) => {
  const content =
    typeof request.body?.content === "string" ? request.body.content.trim() : "";

  if (!content) {
    response.status(400).json({ error: "content is required" });
    return;
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    response.status(400).json({
      error: `content must be at most ${MAX_CONTENT_LENGTH} characters long`,
    });
    return;
  }
  if (!request.file) {
    response.status(400).json({ error: "image is required" });
    return;
  }

  const user = await User.findById(request.userId);
  if (!user) {
    response.status(401).json({ error: "user not found" });
    return;
  }

  const image = await saveImage(request.file.buffer);

  try {
    const meme = new MemeModel({
      content,
      image,
      // El autor sale de la sesión, nunca de lo que mande el cliente.
      author: user.username,
      user: user._id,
    });
    const savedMeme = await meme.save();
    // Un meme recién creado todavía no tiene reacciones.
    response.status(201).json({ ...savedMeme.toJSON(), ...NO_REACTIONS });
  } catch (error) {
    // Si falla el guardado, no dejar la imagen huérfana en disco.
    await removeImage(image);
    throw error;
  }
});

// Solo el AUTOR del meme puede editarlo. El usuario sale de la sesión y se
// compara con el dueño guardado en la BD (nunca con algo que mande el cliente).
// Espera JSON con el campo:
//   - content: nueva descripción (1 a 300 caracteres)
// Responde 404 si el meme no existe y 403 si es de otro usuario.
router.patch("/:id", withUser, async (request, response) => {
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }
  if (meme.user.toString() !== request.userId) {
    response.status(403).json({ error: "you can only edit your own memes" });
    return;
  }

  const content =
    typeof request.body?.content === "string" ? request.body.content.trim() : "";

  if (!content) {
    response.status(400).json({ error: "content is required" });
    return;
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    response.status(400).json({
      error: `content must be at most ${MAX_CONTENT_LENGTH} characters long`,
    });
    return;
  }

  meme.content = content;
  const savedMeme = await meme.save();

  // Se devuelve con los totales de likes y dislikes, igual que el resto de los
  // endpoints que entregan memes.
  const [memeWithCounts] = await withReactionCounts([savedMeme]);
  response.json(memeWithCounts);
});

// Solo el AUTOR del meme puede eliminarlo. Junto con el meme se borran sus
// comentarios, sus reacciones y el archivo de la imagen, para no dejar datos
// huérfanos. Responde 404 si no existe y 403 si es de otro usuario.
router.delete("/:id", withUser, async (request, response) => {
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }
  if (meme.user.toString() !== request.userId) {
    response.status(403).json({ error: "you can only delete your own memes" });
    return;
  }

  await meme.deleteOne();
  await Promise.all([
    CommentModel.deleteMany({ meme: meme._id }),
    ReactionModel.deleteMany({ meme: meme._id }),
    removeImage(meme.image),
  ]);

  response.status(204).end();
});

export default router;
