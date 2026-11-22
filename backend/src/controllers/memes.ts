import express from "express";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReactionModel, {
  NO_REACTIONS,
  withReactionCounts,
  type ReactionType,
} from "../models/reaction";
import User, { DEPARTMENTS } from "../models/user";
import ReportModel, {
  PENDING_REPORTS_ERROR,
  memeHasPendingReports,
} from "../models/report";
import { withUser } from "../utils/middleware";
import { buildPodium } from "../utils/podium";
import { removeImage, saveImageWithSize, uploadImage } from "../utils/upload";
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

// Valida y limpia las carreras y los hashtags que llegan en el cuerpo de una
// petición (la usan POST y PATCH). Un campo que no viene queda como undefined,
// para que el PATCH sepa que no hay que tocarlo.
const parseMemeTags = (
  body: unknown
): { departments?: string[]; tags?: string[] } | { error: string } => {
  const data = (body ?? {}) as { departments?: unknown; tags?: unknown };
  const result: { departments?: string[]; tags?: string[] } = {};

  if (data.departments !== undefined) {
    const list = toList(data.departments);
    if (!list.every(isDepartment)) {
      return { error: `departments must be among: ${DEPARTMENTS.join(", ")}` };
    }
    result.departments = [...new Set(list)];
  }

  if (data.tags !== undefined) {
    const list = toList(data.tags).map(normalizeTag);
    if (list.some((tag) => tag === null)) {
      return { error: `each tag must be 1-${MAX_TAG_LENGTH} letters, numbers or _`, };
    }
    const tags = [...new Set(list as string[])];
    if (tags.length > MAX_TAGS) {
      return { error: `at most ${MAX_TAGS} tags allowed` };
    }
    result.tags = tags;
  }

  return result;
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
//   - department: carrera del autor O etiqueta de carrera del meme. Se puede
//                 repetir (?department=DCC&department=Física) y basta con
//                 coincidir con alguna. No se separan con coma porque algunos
//                 nombres la llevan.
//   - tag:        hashtag del meme, repetible (?tag=parcial&tag=mechon). El
//                 meme debe tener TODOS los hashtags pedidos. Con "#" o sin él,
//                 y sin importar mayúsculas.
//   - order:      "newest" (por defecto, del más nuevo al más antiguo) u "oldest".
// Entre department y tag se exigen ambos. Sin filtros, se devuelven todos.
router.get("/", async (request, response) => {
  const departments = toList(request.query.department);
  if (!departments.every(isDepartment)) {
    response.status(400).json({
      error: `department must be one of: ${DEPARTMENTS.join(", ")}`,
    });
    return;
  }

  // Se normalizan igual que al subir: "#Parcial" y "parcial" son lo mismo.
  const tagList = toList(request.query.tag).map(normalizeTag);
  if (tagList.some((tag) => tag === null)) {
    response.status(400).json({
      error: `tag must be 1-${MAX_TAG_LENGTH} letters, numbers or _`,
    });
    return;
  }
  const tagFilters = [...new Set(tagList as string[])];

  const order = request.query.order ?? "newest";
  if (order !== "newest" && order !== "oldest") {
    response.status(400).json({ error: "order must be newest or oldest" });
    return;
  }
  const direction = order === "oldest" ? 1 : -1;

  // Dos claves distintas en un mismo filtro de MongoDB se combinan con Y.
  const filter = {
    // Etiquetado en el meme O autor de esa carrera (basta con alguna).
    ...(departments.length > 0
      ? {
        $or: [
          { departments: { $in: departments } },
          {
            user: {
              $in: await User.distinct("_id", {
                department: { $in: departments },
              }),
            },
          },
        ],
      }
      : {}),
    // Tiene TODOS los hashtags elegidos ($all = todos; $in = alguno).
    ...(tagFilters.length > 0 ? { tags: { $all: tagFilters } } : {}),
  };

  // _id como desempate: si dos memes tienen la misma fecha, el orden es estable.
  const memes = await MemeModel.find(filter).sort({
    createdAt: direction,
    _id: direction,
  });
  response.json(await withReactionCounts(memes));
});

const MAX_TAG_SUGGESTIONS = 30;

// Público: hashtags que ya existen, los más usados primero.
// Responde [{ tag: "parcial", count: 12 }, ...] (máx. 30).
//   - q: opcional, solo los que empiezan con ese texto (para el buscador).
router.get("/tags", async (request, response) => {
  const rawQuery = typeof request.query.q === "string" ? request.query.q : "";
  const q = rawQuery.trim().replace(/^#+/, "").toLowerCase();

  // El texto de búsqueda solo puede tener los mismos caracteres que un hashtag,
  // así que no hace falta escapar nada para usarlo en la expresión regular.
  if (q !== "" && (q.length > MAX_TAG_LENGTH || !TAG_PATTERN.test(q))) {
    response.json([]);
    return;
  }

  // aggregate() NO aplica el filtro automático del modelo, así que los memes
  // eliminados por moderación se descartan a mano (removedAt: null).
  const tags = await MemeModel.aggregate<{ _id: string; count: number }>([
    { $match: { removedAt: null } },
    { $unwind: "$tags" },
    { $match: q ? { tags: { $regex: `^${q}` } } : {} },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: MAX_TAG_SUGGESTIONS },
  ]);

  response.json(tags.map(({ _id, count }) => ({ tag: _id, count })));
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

// Solo usuarios con sesión: el contenido PROPIO que tiene reportes pendientes,
// como { memes: [ids], comments: [ids] }. Mientras un admin no los resuelva, el
// autor no puede editar ni eliminar ese contenido (lo exigen PATCH y DELETE de
// memes y comentarios); el frontend usa esta lista para deshabilitar los botones
// y explicar por qué. Solo se le entrega al propio autor.
// Va antes de "/:id" para que "under-review" no se confunda con un id.
router.get("/under-review/mine", withUser, async (request, response) => {
  const reports = await ReportModel.find(
    { targetUser: request.userId, status: "pending" },
    "targetType meme comment"
  );

  const memes = new Set<string>();
  const comments = new Set<string>();
  for (const report of reports) {
    // Los reportes de usuario (targetType "user") no tienen meme ni comentario y
    // no bloquean nada: solo cuentan los de memes y comentarios.
    if (report.targetType === "meme" && report.meme) {
      memes.add(report.meme.toString());
    } else if (report.targetType === "comment" && report.comment) {
      comments.add(report.comment.toString());
    }
  }
  response.json({ memes: [...memes], comments: [...comments] });
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

    // Carreras y hashtags (opcionales): se validan con la función compartida.
  const parsedTags = parseMemeTags(request.body);
  if ("error" in parsedTags) {
    response.status(400).json({ error: parsedTags.error });
    return;
  }
  const memeDepartments = parsedTags.departments ?? [];
  const tags = parsedTags.tags ?? [];

  if (!request.file) {
    response.status(400).json({ error: "image is required" });
    return;
  }

  const user = await User.findById(request.userId);
  if (!user) {
    response.status(401).json({ error: "user not found" });
    return;
  }

  // Se guarda el archivo y se lee su tamaño (puede ser null si no se pudo leer).
  const { url: image, width, height } = await saveImageWithSize(request.file.buffer);

  try {
    const meme = new MemeModel({
      content,
      image,
      width,
      height,
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
// Espera JSON con los campos:
//   - content:     nueva descripción (1 a 300 caracteres)
//   - departments: (opcional) carreras del meme; si viene, reemplaza las actuales
//   - tags:        (opcional) hashtags del meme; si viene, reemplaza los actuales
// Responde 404 si el meme no existe y 403 si es de otro usuario y 409 si el meme
// tiene reportes pendientes de revisión.
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
  if (await memeHasPendingReports(meme._id)) {
    response.status(409).json(PENDING_REPORTS_ERROR);
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

  // Carreras y hashtags son opcionales: si vienen (aunque sea vacíos, []),
  // reemplazan a los actuales; si no vienen, quedan como estaban.
  const parsedTags = parseMemeTags(request.body);
  if ("error" in parsedTags) {
    response.status(400).json({ error: parsedTags.error });
    return;
  }

  meme.content = content;
  if (parsedTags.departments) meme.departments = parsedTags.departments;
  if (parsedTags.tags) meme.tags = parsedTags.tags;
  const savedMeme = await meme.save();

  // Se devuelve con los totales de likes y dislikes, igual que el resto de los
  // endpoints que entregan memes.
  const [memeWithCounts] = await withReactionCounts([savedMeme]);
  response.json(memeWithCounts);
});

// Solo el AUTOR del meme puede eliminarlo. Junto con el meme se borran sus
// comentarios, sus reacciones, sus reportes y el archivo de la imagen, para no
// dejar datos huérfanos. Responde 404 si no existe, 403 si es de otro usuario y
// 409 si el meme tiene reportes pendientes de revisión (hasta que un admin los
// resuelva no se puede borrar: sería una forma de esquivar la moderación).
// (La eliminación por moderación es otra cosa: ver controllers/admin.ts, que
// conserva todo como evidencia.)
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
  if (await memeHasPendingReports(meme._id)) {
    response.status(409).json(PENDING_REPORTS_ERROR);
    return;
  }

  await meme.deleteOne();
  await Promise.all([
    CommentModel.deleteMany({ meme: meme._id }),
    ReactionModel.deleteMany({ meme: meme._id }),
    // Los reportes "accepted" se conservan: son de comentarios de OTROS usuarios
    // que un admin eliminó, y siguen contando en el total de reportes de cada
    // uno. Los pendientes y descartados ya no tienen nada que revisar.
    ReportModel.deleteMany({ meme: meme._id, status: { $ne: "accepted" } }),
    removeImage(meme.image),
  ]);

  response.status(204).end();
});

export default router;
