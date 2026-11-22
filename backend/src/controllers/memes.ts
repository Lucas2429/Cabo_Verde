import express from "express";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReactionModel, {
  NO_REACTIONS,
  withReactionCounts,
  type ReactionType,
} from "../models/reaction";
import User, { DEPARTMENTS } from "../models/user";
import ReportModel from "../models/report";
import { withUser } from "../utils/middleware";
import { buildPodium } from "../utils/podium";
import { removeImage, saveImage, uploadImage } from "../utils/upload";
import { getCurrentWeek } from "../utils/week";
import commentsRouter from "./comments";
import reactionsRouter from "./reactions";
import { memeReportRouter } from "./reports";
import { getReactionCounts } from "../models/reaction";

const MAX_CONTENT_LENGTH = 300;

const isDepartment = (value: unknown): value is (typeof DEPARTMENTS)[number] =>
  typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;
// Letras (con tildes y ñ), números y guion bajo. Sin espacios ni símbolos.
const TAG_PATTERN = /^[\p{L}\p{N}_]+$/u;

// multer entrega un string si el campo llega una vez, y un arreglo si llega varias.
const toList = (raw: unknown): unknown[] =>
  raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

// "#Parcial " -> "parcial". Devuelve null si no es un hashtag válido.
const normalizeTag = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const tag = value.trim().replace(/^#+/, "").toLowerCase();
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(tag)
    ? tag
    : null;
};

const router = express.Router();

// Comentarios de un meme: /api/memes/:id/comments
router.use("/:id/comments", commentsRouter);

// Like / dislike de un meme: /api/memes/:id/reaction
router.use("/:id/reaction", reactionsRouter);

// Reportar un meme: /api/memes/:id/report
router.use("/:id/report", memeReportRouter);

// Público: cualquiera (incluidos invitados) puede ver los memes, con sus
// totales de likes y dislikes. Parámetros opcionales (query string):
//   - department: carrera del AUTOR del meme. Se puede repetir para combinar
//                 varias (?department=DCC&department=Física); no se separan con
//                 coma porque algunos nombres la llevan ("Química, Biotecnología
//                 y Materiales"). Sin ninguno, se devuelven todos los memes.
//   - order:      "newest" (por defecto, del más nuevo al más antiguo) u "oldest".
router.get("/", async (request, response) => {
  const rawDepartments = request.query.department;
  const departments =
    rawDepartments === undefined
      ? []
      : Array.isArray(rawDepartments)
        ? rawDepartments
        : [rawDepartments];
  if (!departments.every(isDepartment)) {
    response.status(400).json({
      error: `department must be one of: ${DEPARTMENTS.join(", ")}`,
    });
    return;
  }

  const order = request.query.order ?? "newest";
  if (order !== "newest" && order !== "oldest") {
    response.status(400).json({ error: "order must be newest or oldest" });
    return;
  }
  const direction = order === "oldest" ? 1 : -1;

  // Un meme coincide si alguna de sus etiquetas está entre las carreras
  // elegidas O si el autor pertenece a una de ellas.
  const filter =
    departments.length > 0
      ? {
        $or: [
          { departments: { $in: departments } },   // etiquetado en el meme
          {
            user: {
              $in: await User.distinct("_id", {
                department: { $in: departments },  // carrera del autor
              }),
            },
          },
        ],
      }
      : {};

  // _id como desempate: si dos memes tienen la misma fecha, el orden es estable.
  const memes = await MemeModel.find(filter).sort({
    createdAt: direction,
    _id: direction,
  });
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

// Público: podio de la semana en curso (de lunes a domingo, hora de Chile). Son
// los memes publicados esta semana con más likes; los empates comparten puesto.
// Responde { weekStart, weekEnd, podium: [{ position, likes, memes: [...] }] }.
// Va antes de "/:id" para que "podium" no se confunda con un id.
router.get("/podium", async (_request, response) => {
  const { start, end } = getCurrentWeek();

  const weekMemes = await MemeModel.find({
    createdAt: { $gte: start, $lt: end },
  });
  const counts = await getReactionCounts(weekMemes.map((meme) => meme._id));

  const ranked = weekMemes.map((meme) => ({
    ...meme.toJSON(),
    ...(counts.get(meme.id) ?? NO_REACTIONS),
  }));

  response.json({ weekStart: start, weekEnd: end, podium: buildPodium(ranked) });
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
  const content = typeof request.body?.content === "string" ? request.body.content.trim() : "";

  if (!content) {
    response.status(400).json({ error: "content is required" });
    return;
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    response.status(400).json({ error: `content must be at most ${MAX_CONTENT_LENGTH} characters long`, });
    return;
  }

  // etiqueta especial de carrera (opcional)
  const departmentList = toList(request.body?.departments);
  if (!departmentList.every(isDepartment)) {
    response.status(400).json({ error: `departments must be among: ${DEPARTMENTS.join(", ")}`, });
    return;
  }

  const memeDepartments = [...new Set(departmentList)];

  // hashtags libres (opcionales)
  const tagList = toList(request.body?.tags).map(normalizeTag);
  if (tagList.some((tag) => tag === null)) {
    response.status(400).json({ error: `each tag must be 1-${MAX_TAG_LENGTH} letters, numbers or _`, });
    return;
  }

  const tags = [...new Set(tagList as string[])];
  if (tags.length > MAX_TAGS) {
    response.status(400).json({ error: `at most ${MAX_TAGS} tags allowed` });
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
      departments: memeDepartments,   
      tags,                          
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
// comentarios, sus reacciones, sus reportes (ya no hay nada que revisar) y el
// archivo de la imagen, para no dejar datos huérfanos. Responde 404 si no existe
// y 403 si es de otro usuario. (La eliminación por moderación es otra cosa: ver
// controllers/admin.ts, que conserva todo como evidencia.)
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
    ReportModel.deleteMany({ meme: meme._id }),
    removeImage(meme.image),
  ]);

  response.status(204).end();
});

export default router;
