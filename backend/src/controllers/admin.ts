import express from "express";
import mongoose from "mongoose";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ModerationLogModel, {
  type ModerationAction,
  type ModerationLogData,
} from "../models/moderationLog";
import { withReactionCounts } from "../models/reaction";
import ReportModel, {
  REPORT_ALERT_THRESHOLD,
  type ReportData,
  type ReportStatus,
  type ReportTargetType,
} from "../models/report";
import User from "../models/user";
import { withAdmin } from "../utils/middleware";

// Todo lo de este router es SOLO para admins: `withAdmin` valida la sesión y
// además lee el rol de la base de datos en cada petición. Se monta en /api/admin.
const router = express.Router();
router.use(withAdmin);

const MAX_REASON_LENGTH = 200;
const MIN_REASON_LENGTH = 3;
// Cuántos contenidos (o usuarios) como máximo devuelve cada lista.
const MAX_ITEMS = 100;

const NO_AUTHOR = "[usuario eliminado]";

type StatusFilter = { status: ReportStatus | { $in: ReportStatus[] } };
type ReportDoc = mongoose.HydratedDocument<ReportData>;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Motivo escrito por el admin al eliminar algo o banear a alguien. Queda
// guardado como evidencia.
const parseReason = (body: unknown): { reason: string } | { error: string } => {
  const raw = (body as { reason?: unknown } | undefined)?.reason;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    return {
      error: `reason must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters long`,
    };
  }
  return { reason };
};

// ?status=pending (por defecto) o resolved (aceptados y descartados).
const parseStatusFilter = (value: unknown): StatusFilter | null => {
  if (value === undefined || value === "pending") return { status: "pending" };
  if (value === "resolved") return { status: { $in: ["accepted", "dismissed"] } };
  return null;
};

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(key(item));
    if (list) list.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
};

// Nombres de usuario a partir de sus ids (para mostrar quién reportó, quién
// eliminó o baneó, etc.).
const usernamesById = async (
  ids: (mongoose.Types.ObjectId | null | undefined)[]
): Promise<Map<string, string>> => {
  const unique = [
    ...new Set(ids.filter((id): id is mongoose.Types.ObjectId => Boolean(id)).map(String)),
  ];
  const users = await User.find({ _id: { $in: unique } }, "username");
  return new Map(users.map((user) => [user._id.toString(), user.username]));
};

// Un admin no puede moderar a otro admin ni su contenido (ni el propio): si lo
// necesita, lo borra como cualquier usuario. Devuelve true si el usuario es admin.
const isAdminContent = async (authorId: mongoose.Types.ObjectId): Promise<boolean> => {
  const author = await User.findById(authorId, "role");
  return author?.role === "admin";
};

const logAction = (data: {
  admin: string | undefined;
  action: ModerationAction;
  targetType: ModerationLogData["targetType"];
  meme?: mongoose.Types.ObjectId | null;
  comment?: mongoose.Types.ObjectId | null;
  targetUser: mongoose.Types.ObjectId;
  reason?: string | null;
}) =>
  ModerationLogModel.create({
    meme: null,
    comment: null,
    reason: null,
    ...data,
  });

// Ids de los contenidos (o usuarios) más reportados, de más a menos reportes (en
// empate, primero el que recibió un reporte más reciente). El orden y el tope de
// MAX_ITEMS se aplican en la base de datos, ANTES de traer los reportes: así lo
// que tiene más reportes nunca queda fuera por ser antiguo. El _id es solo un
// desempate para que el orden sea estable. `field` es el campo que identifica lo
// reportado ("$meme", "$comment" o "$targetUser").
const rankReported = async (
  targetType: ReportTargetType,
  field: string,
  statusFilter: StatusFilter
): Promise<string[]> => {
  const ranking = await ReportModel.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: { targetType, ...statusFilter } },
    { $group: { _id: field, count: { $sum: 1 }, latest: { $max: "$createdAt" } } },
    { $sort: { count: -1, latest: -1, _id: 1 } },
    { $limit: MAX_ITEMS },
  ]);
  return ranking.map((row) => row._id.toString());
};

const serializeReports = (reports: ReportDoc[], usernames: Map<string, string>) =>
  reports.map((report) => ({
    id: report.id as string,
    reason: report.reason,
    details: report.details,
    status: report.status,
    reporter: usernames.get(report.reporter.toString()) ?? NO_AUTHOR,
    createdAt: report.createdAt,
  }));

// Un contenido (o usuario) está "en alerta" si sigue activo y llegó al umbral de
// reportes PENDIENTES. Es la única definición: el frontend solo muestra el
// resultado (`inAlert`) y el umbral que entrega /reports/alerts.
const isInAlert = (reports: ReportDoc[], stillActive: boolean): boolean =>
  stillActive &&
  reports.filter((report) => report.status === "pending").length >=
    REPORT_ALERT_THRESHOLD;

// ---------------------------------------------------------------------------
// Listas de reportes
// ---------------------------------------------------------------------------

// Posts reportados, agrupados: una fila por post con todos sus reportes. Van de
// los que tienen MÁS reportes a los que tienen menos. Con ?status=pending se
// cuentan solo los reportes pendientes; con resolved, los ya resueltos.
router.get("/reports/memes", async (request, response) => {
  const statusFilter = parseStatusFilter(request.query.status);
  if (!statusFilter) {
    response.status(400).json({ error: "status must be pending or resolved" });
    return;
  }

  const memeIds = await rankReported("meme", "$meme", statusFilter);

  const reports = await ReportModel.find({
    targetType: "meme",
    meme: { $in: memeIds },
    ...statusFilter,
  }).sort({ createdAt: -1 });
  const groups = groupBy(reports, (report) => String(report.meme));

  // Los memes eliminados también se ven acá: es donde los admins revisan lo que
  // se resolvió.
  const memes = await MemeModel.find({ _id: { $in: memeIds } }).setOptions({
    includeRemoved: true,
  });
  const withCounts = await withReactionCounts(memes);
  const serialized = new Map(
    memes.map((meme, index) => [meme._id.toString(), withCounts[index]])
  );
  const rawMemes = new Map(memes.map((meme) => [meme._id.toString(), meme]));
  const usernames = await usernamesById([
    ...reports.map((report) => report.reporter),
    ...memes.map((meme) => meme.removedBy),
  ]);

  const items = memeIds.flatMap((memeId) => {
    const meme = serialized.get(memeId);
    const raw = rawMemes.get(memeId);
    if (!meme || !raw) return [];
    const memeReports = groups.get(memeId) ?? [];
    return [
      {
        meme,
        removal: raw.removedAt
          ? {
              at: raw.removedAt,
              by: raw.removedBy ? usernames.get(raw.removedBy.toString()) ?? NO_AUTHOR : NO_AUTHOR,
              reason: raw.removalReason,
            }
          : null,
        inAlert: isInAlert(memeReports, !raw.removedAt),
        reports: serializeReports(memeReports, usernames),
      },
    ];
  });

  response.json({ items });
});

// Comentarios reportados, agrupados igual que los posts y en el mismo orden (de
// más a menos reportes). Aquí SÍ se entrega el texto original del comentario
// (aunque ya esté eliminado), porque es la evidencia que revisa el admin.
router.get("/reports/comments", async (request, response) => {
  const statusFilter = parseStatusFilter(request.query.status);
  if (!statusFilter) {
    response.status(400).json({ error: "status must be pending or resolved" });
    return;
  }

  const commentIds = await rankReported("comment", "$comment", statusFilter);

  const reports = await ReportModel.find({
    targetType: "comment",
    comment: { $in: commentIds },
    ...statusFilter,
  }).sort({ createdAt: -1 });
  const groups = groupBy(reports, (report) => String(report.comment));

  const comments = await CommentModel.find({ _id: { $in: commentIds } });
  const memes = await MemeModel.find({
    _id: { $in: comments.map((comment) => comment.meme) },
  }).setOptions({ includeRemoved: true });
  const rawComments = new Map(comments.map((comment) => [comment._id.toString(), comment]));
  const memesById = new Map(memes.map((meme) => [meme._id.toString(), meme]));
  const usernames = await usernamesById([
    ...reports.map((report) => report.reporter),
    ...comments.map((comment) => comment.removedBy),
  ]);

  const items = commentIds.flatMap((commentId) => {
    const comment = rawComments.get(commentId);
    if (!comment) return [];
    const meme = memesById.get(comment.meme.toString());
    const commentReports = groups.get(commentId) ?? [];
    return [
      {
        comment: {
          id: comment.id as string,
          content: comment.content,
          author: comment.author,
          createdAt: comment.createdAt,
        },
        // Post donde está el comentario (para dar contexto).
        meme: meme
          ? {
              id: meme.id as string,
              image: meme.image,
              content: meme.content,
              removed: Boolean(meme.removedAt),
            }
          : null,
        removal: comment.removedAt
          ? {
              at: comment.removedAt,
              by: comment.removedBy
                ? usernames.get(comment.removedBy.toString()) ?? NO_AUTHOR
                : NO_AUTHOR,
              reason: comment.removalReason,
            }
          : null,
        inAlert: isInAlert(commentReports, !comment.removedAt && !comment.deletedAt),
        reports: serializeReports(commentReports, usernames),
      },
    ];
  });

  response.json({ items });
});

// Usuarios reportados, agrupados igual que los posts y comentarios y en el mismo
// orden (de más a menos reportes). Un usuario baneado aparece con los datos del
// baneo (`ban`): sus reportes ya están resueltos, así que se ve en "resolved".
router.get("/reports/users", async (request, response) => {
  const statusFilter = parseStatusFilter(request.query.status);
  if (!statusFilter) {
    response.status(400).json({ error: "status must be pending or resolved" });
    return;
  }

  const userIds = await rankReported("user", "$targetUser", statusFilter);

  const reports = await ReportModel.find({
    targetType: "user",
    targetUser: { $in: userIds },
    ...statusFilter,
  }).sort({ createdAt: -1 });
  const groups = groupBy(reports, (report) => String(report.targetUser));

  const users = await User.find(
    { _id: { $in: userIds } },
    "username displayName avatar department bannedAt bannedBy banReason"
  );
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const usernames = await usernamesById([
    ...reports.map((report) => report.reporter),
    ...users.map((user) => user.bannedBy),
  ]);

  const items = userIds.flatMap((userId) => {
    const user = usersById.get(userId);
    if (!user) return [];
    const userReports = groups.get(userId) ?? [];
    return [
      {
        user: {
          username: user.username,
          displayName: user.displayName || user.username,
          avatar: user.avatar ?? null,
          department: user.department,
        },
        ban: user.bannedAt
          ? {
              at: user.bannedAt,
              by: user.bannedBy
                ? usernames.get(user.bannedBy.toString()) ?? NO_AUTHOR
                : NO_AUTHOR,
              reason: user.banReason ?? null,
            }
          : null,
        inAlert: isInAlert(userReports, !user.bannedAt),
        reports: serializeReports(userReports, usernames),
      },
    ];
  });

  response.json({ items });
});

// Cuántos contenidos están "en alerta": los que tienen REPORT_ALERT_THRESHOLD o
// más reportes PENDIENTES, contados por tipo (posts, comentarios y usuarios). El
// header de los admins muestra una marca en el botón de reportes cuando alguno es
// mayor que 0. Solo cuentan los pendientes: lo ya resuelto no necesita revisión.
// También entrega el umbral, para que el frontend no lo tenga duplicado.
const countInAlert = async (
  targetType: ReportTargetType,
  field: string
): Promise<number> => {
  const [row] = await ReportModel.aggregate<{ total: number }>([
    { $match: { targetType, status: "pending" } },
    { $group: { _id: field, count: { $sum: 1 } } },
    { $match: { count: { $gte: REPORT_ALERT_THRESHOLD } } },
    { $count: "total" },
  ]);
  return row?.total ?? 0;
};

router.get("/reports/alerts", async (_request, response) => {
  const [memes, comments, users] = await Promise.all([
    countInAlert("meme", "$meme"),
    countInAlert("comment", "$comment"),
    countInAlert("user", "$targetUser"),
  ]);

  response.json({ threshold: REPORT_ALERT_THRESHOLD, memes, comments, users });
});

// ---------------------------------------------------------------------------
// Acciones sobre posts
// ---------------------------------------------------------------------------

// Elimina un post por moderación ("borrado con huella"): el post NO se borra de
// la base de datos, solo se marca como eliminado con quién, cuándo y por qué, y
// desaparece de la app. Sus reportes pendientes pasan a "accepted" y los de sus
// comentarios a "dismissed" (el post ya no existe, no hay nada más que revisar).
// Espera JSON con: reason (3 a 200 caracteres).
router.post("/memes/:id/remove", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id" });
    return;
  }
  const parsed = parseReason(request.body);
  if ("error" in parsed) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  const meme = await MemeModel.findById(request.params.id).setOptions({
    includeRemoved: true,
  });
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }
  if (meme.removedAt) {
    response.status(409).json({ error: "meme already removed" });
    return;
  }
  if (await isAdminContent(meme.user)) {
    response.status(403).json({ error: "you cannot moderate content of an admin" });
    return;
  }

  const now = new Date();
  meme.removedAt = now;
  meme.removedBy = new mongoose.Types.ObjectId(request.userId);
  meme.removalReason = parsed.reason;
  await meme.save();

  const resolved = { resolvedBy: request.userId, resolvedAt: now };
  await Promise.all([
    ReportModel.updateMany(
      { meme: meme._id, targetType: "meme", status: "pending" },
      { status: "accepted", ...resolved }
    ),
    ReportModel.updateMany(
      { meme: meme._id, targetType: "comment", status: "pending" },
      { status: "dismissed", ...resolved }
    ),
    logAction({
      admin: request.userId,
      action: "remove_meme",
      targetType: "meme",
      meme: meme._id,
      targetUser: meme.user,
      reason: parsed.reason,
    }),
  ]);

  response.json({ id: meme.id });
});

// Limita (o vuelve a permitir) los comentarios de un post, como en Instagram: el
// post y sus comentarios se siguen viendo, pero nadie puede comentar ni
// responder. Espera JSON con: locked (booleano).
router.put("/memes/:id/comments-lock", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id" });
    return;
  }
  const locked = (request.body as { locked?: unknown } | undefined)?.locked;
  if (typeof locked !== "boolean") {
    response.status(400).json({ error: "locked must be a boolean" });
    return;
  }

  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }
  if (await isAdminContent(meme.user)) {
    response.status(403).json({ error: "you cannot moderate content of an admin" });
    return;
  }

  // Si ya estaba así no se hace nada (ni se ensucia la bitácora).
  if (meme.commentsLocked !== locked) {
    meme.commentsLocked = locked;
    await meme.save();
    await logAction({
      admin: request.userId,
      action: locked ? "lock_comments" : "unlock_comments",
      targetType: "meme",
      meme: meme._id,
      targetUser: meme.user,
    });
  }

  response.json({ commentsLocked: meme.commentsLocked });
});

// Descarta los reportes pendientes de un post: un admin lo revisó y decidió no
// actuar.
router.post("/memes/:id/dismiss-reports", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id" });
    return;
  }
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  const result = await ReportModel.updateMany(
    { meme: meme._id, targetType: "meme", status: "pending" },
    { status: "dismissed", resolvedBy: request.userId, resolvedAt: new Date() }
  );
  if (result.modifiedCount > 0) {
    await logAction({
      admin: request.userId,
      action: "dismiss_reports",
      targetType: "meme",
      meme: meme._id,
      targetUser: meme.user,
    });
  }

  response.json({ dismissed: result.modifiedCount });
});

// ---------------------------------------------------------------------------
// Acciones sobre comentarios
// ---------------------------------------------------------------------------

// Elimina un comentario por moderación. Igual que en Reddit, el comentario
// NUNCA desaparece del hilo: queda como "Comentario eliminado" (con sus
// respuestas debajo). El texto original se conserva en la base de datos como
// evidencia. Sus reportes pendientes pasan a "accepted".
// Espera JSON con: reason (3 a 200 caracteres).
router.post("/comments/:id/remove", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid comment id" });
    return;
  }
  const parsed = parseReason(request.body);
  if ("error" in parsed) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  const comment = await CommentModel.findById(request.params.id);
  // Si el post fue eliminado, sus comentarios tampoco existen para nadie.
  const memeExists = comment
    ? await MemeModel.exists({ _id: comment.meme })
    : null;
  if (!comment || !memeExists) {
    response.status(404).json({ error: "comment not found" });
    return;
  }
  if (comment.removedAt || comment.deletedAt) {
    response.status(409).json({ error: "comment already deleted" });
    return;
  }
  if (await isAdminContent(comment.user)) {
    response.status(403).json({ error: "you cannot moderate content of an admin" });
    return;
  }

  const now = new Date();
  comment.removedAt = now;
  comment.removedBy = new mongoose.Types.ObjectId(request.userId);
  comment.removalReason = parsed.reason;
  await comment.save();

  await Promise.all([
    ReportModel.updateMany(
      { comment: comment._id, status: "pending" },
      { status: "accepted", resolvedBy: request.userId, resolvedAt: now }
    ),
    logAction({
      admin: request.userId,
      action: "remove_comment",
      targetType: "comment",
      meme: comment.meme,
      comment: comment._id,
      targetUser: comment.user,
      reason: parsed.reason,
    }),
  ]);

  response.json({ id: comment.id });
});

// Descarta los reportes pendientes de un comentario (el admin decidió no actuar).
router.post("/comments/:id/dismiss-reports", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid comment id" });
    return;
  }
  const comment = await CommentModel.findById(request.params.id);
  if (!comment) {
    response.status(404).json({ error: "comment not found" });
    return;
  }

  const result = await ReportModel.updateMany(
    { comment: comment._id, status: "pending" },
    { status: "dismissed", resolvedBy: request.userId, resolvedAt: new Date() }
  );
  if (result.modifiedCount > 0) {
    await logAction({
      admin: request.userId,
      action: "dismiss_reports",
      targetType: "comment",
      meme: comment.meme,
      comment: comment._id,
      targetUser: comment.user,
    });
  }

  response.json({ dismissed: result.modifiedCount });
});

// ---------------------------------------------------------------------------
// Acciones sobre usuarios
// ---------------------------------------------------------------------------

// Banea a un usuario: la cuenta deja de poder iniciar sesión y cualquier sesión
// que tuviera abierta se corta al instante (lo hace `withUser`, que consulta el
// baneo en cada petición). Al intentar entrar ve un aviso de que fue baneado.
// Sus memes y comentarios no se tocan (para eso están las acciones sobre cada
// contenido). Los reportes pendientes contra él pasan a "accepted".
// Espera JSON con: reason (3 a 200 caracteres), solo visible para los admins.
// Responde 403 si el usuario es admin (nadie puede banear a un admin), 409 si ya
// estaba baneado.
router.post("/users/:username/ban", async (request, response) => {
  const parsed = parseReason(request.body);
  if ("error" in parsed) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  const user = await User.findOne({ username: request.params.username }, "role bannedAt");
  if (!user) {
    response.status(404).json({ error: "user not found" });
    return;
  }
  if (user.role === "admin") {
    response.status(403).json({ error: "you cannot moderate an admin" });
    return;
  }
  if (user.bannedAt) {
    response.status(409).json({ error: "user already banned" });
    return;
  }

  const now = new Date();
  // updateOne (y no save) para no revalidar el documento entero: aquí solo
  // cambian los campos del baneo.
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        bannedAt: now,
        bannedBy: new mongoose.Types.ObjectId(request.userId),
        banReason: parsed.reason,
      },
    }
  );

  await Promise.all([
    ReportModel.updateMany(
      { targetType: "user", targetUser: user._id, status: "pending" },
      { status: "accepted", resolvedBy: request.userId, resolvedAt: now }
    ),
    logAction({
      admin: request.userId,
      action: "ban_user",
      targetType: "user",
      targetUser: user._id,
      reason: parsed.reason,
    }),
  ]);

  response.json({ banned: true });
});

// Levanta el baneo de un usuario: puede volver a iniciar sesión. Sus reportes
// aceptados quedan como están (son el historial). Responde 409 si no estaba
// baneado.
router.post("/users/:username/unban", async (request, response) => {
  const user = await User.findOne({ username: request.params.username }, "bannedAt");
  if (!user) {
    response.status(404).json({ error: "user not found" });
    return;
  }
  if (!user.bannedAt) {
    response.status(409).json({ error: "user is not banned" });
    return;
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { bannedAt: null, bannedBy: null, banReason: null } }
  );
  await logAction({
    admin: request.userId,
    action: "unban_user",
    targetType: "user",
    targetUser: user._id,
  });

  response.json({ banned: false });
});

// Descarta los reportes pendientes de un usuario (el admin decidió no actuar).
router.post("/users/:username/dismiss-reports", async (request, response) => {
  const user = await User.findOne({ username: request.params.username }, "_id");
  if (!user) {
    response.status(404).json({ error: "user not found" });
    return;
  }

  const result = await ReportModel.updateMany(
    { targetType: "user", targetUser: user._id, status: "pending" },
    { status: "dismissed", resolvedBy: request.userId, resolvedAt: new Date() }
  );
  if (result.modifiedCount > 0) {
    await logAction({
      admin: request.userId,
      action: "dismiss_reports",
      targetType: "user",
      targetUser: user._id,
    });
  }

  response.json({ dismissed: result.modifiedCount });
});

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

// Últimas acciones de moderación (quién hizo qué, sobre qué y con qué motivo),
// de la más nueva a la más antigua. Máximo 100.
router.get("/log", async (_request, response) => {
  const entries = await ModerationLogModel.find({})
    .sort({ createdAt: -1 })
    .limit(MAX_ITEMS);
  const usernames = await usernamesById(
    entries.flatMap((entry) => [entry.admin, entry.targetUser])
  );

  response.json(
    entries.map((entry) => ({
      id: entry.id as string,
      action: entry.action,
      targetType: entry.targetType,
      // Null en las acciones sobre usuarios (no hay meme de por medio).
      memeId: entry.meme?.toString() ?? null,
      commentId: entry.comment?.toString() ?? null,
      admin: usernames.get(entry.admin.toString()) ?? NO_AUTHOR,
      targetUser: usernames.get(entry.targetUser.toString()) ?? NO_AUTHOR,
      reason: entry.reason,
      createdAt: entry.createdAt,
    }))
  );
});

export default router;
