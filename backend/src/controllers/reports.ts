import express from "express";
import mongoose from "mongoose";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReportModel, {
  MAX_REPORT_DETAILS_LENGTH,
  MAX_REPORTS_PER_HOUR,
  REPORT_REASONS,
  type ReportReason,
  type ReportTargetType,
} from "../models/report";
import User from "../models/user";
import { withUser } from "../utils/middleware";

// Reportar contenido o usuarios ajenos. Hay tres routers porque cada uno se
// monta bajo su propio recurso:
//   - memeReportRouter:    POST /api/memes/:id/report
//   - commentReportRouter: POST /api/memes/:id/comments/:commentId/report
//   - userReportRouter:    POST /api/users/:username/report
// Todos reciben JSON con:
//   - reason:  uno de REPORT_REASONS
//   - details: texto de hasta 200 caracteres. Obligatorio si reason es "other".
//
// Los errores llevan un `code` estable (own_content, admin_target, user_banned,
// already_reported, too_many_reports) para que el frontend muestre su propio
// mensaje sin depender del texto en inglés.

const isReportReason = (value: unknown): value is ReportReason =>
  typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);

// Valida el cuerpo. Devuelve el motivo y el detalle limpios, o un mensaje de error.
const parseBody = (
  body: unknown
): { reason: ReportReason; details: string } | { error: string } => {
  const { reason, details } = (body ?? {}) as { reason?: unknown; details?: unknown };

  if (!isReportReason(reason)) {
    return { error: `reason must be one of: ${REPORT_REASONS.join(", ")}` };
  }
  if (details !== undefined && typeof details !== "string") {
    return { error: "details must be a string" };
  }

  const cleanDetails = (details ?? "").trim();
  if (cleanDetails.length > MAX_REPORT_DETAILS_LENGTH) {
    return {
      error: `details must be at most ${MAX_REPORT_DETAILS_LENGTH} characters long`,
    };
  }
  if (reason === "other" && cleanDetails === "") {
    return { error: "details is required when reason is other" };
  }
  return { reason, details: cleanDetails };
};

interface NewReport {
  reporter: string | undefined;
  targetType: ReportTargetType;
  // null en los reportes de usuario.
  meme: mongoose.Types.ObjectId | null;
  comment: mongoose.Types.ObjectId | null;
  // Autor del contenido reportado (o el propio usuario reportado).
  targetUser: mongoose.Types.ObjectId;
  reason: ReportReason;
  details: string;
}

interface Failure {
  status: number;
  error: string;
  code: string;
}

const ALREADY_REPORTED: Failure = {
  status: 409,
  error: "you already reported this",
  code: "already_reported",
};

// Reglas comunes a los tres tipos de reporte. Devuelve el fallo si el reporte no
// se puede crear, o null si se creó.
const saveReport = async (data: NewReport): Promise<Failure | null> => {
  if (data.targetUser.toString() === data.reporter) {
    return {
      status: 403,
      error: "you cannot report yourself or your own content",
      code: "own_content",
    };
  }

  // Freno a los abusos: no más de MAX_REPORTS_PER_HOUR reportes por hora (entre
  // todos los tipos).
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);
  const recentReports = await ReportModel.countDocuments({
    reporter: data.reporter,
    createdAt: { $gte: lastHour },
  });
  if (recentReports >= MAX_REPORTS_PER_HOUR) {
    return {
      status: 429,
      error: "too many reports, try again later",
      code: "too_many_reports",
    };
  }

  // Los mismos campos que el índice único de models/report.ts.
  const alreadyReported = await ReportModel.exists({
    reporter: data.reporter,
    targetType: data.targetType,
    meme: data.meme,
    comment: data.comment,
    targetUser: data.targetUser,
  });
  if (alreadyReported) return ALREADY_REPORTED;

  try {
    await new ReportModel(data).save();
  } catch (error) {
    // Dos reportes iguales al mismo tiempo: el índice único deja pasar solo uno.
    if ((error as { code?: number }).code === 11000) return ALREADY_REPORTED;
    throw error;
  }
  return null;
};

export const memeReportRouter = express.Router({ mergeParams: true });

// Los parámetros de la URL vienen de los routers padre (mergeParams) y Express
// no los incluye en los tipos de las rutas hijas, así que se declaran aquí.
type MemeParams = { id: string };
type CommentParams = { id: string; commentId: string };
type UserParams = { username: string };

memeReportRouter.post<MemeParams>("/", withUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id" });
    return;
  }

  const body = parseBody(request.body);
  if ("error" in body) {
    response.status(400).json({ error: body.error });
    return;
  }

  // Un meme eliminado por moderación ya no existe para el público (404).
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  const failure = await saveReport({
    reporter: request.userId,
    targetType: "meme",
    meme: meme._id,
    comment: null,
    targetUser: meme.user,
    ...body,
  });
  if (failure) {
    response.status(failure.status).json({ error: failure.error, code: failure.code });
    return;
  }
  response.status(201).json({ message: "report received" });
});

export const commentReportRouter = express.Router({ mergeParams: true });

commentReportRouter.post<CommentParams>("/", withUser, async (request, response) => {
  const { id: memeId, commentId } = request.params;
  if (!mongoose.isValidObjectId(memeId) || !mongoose.isValidObjectId(commentId)) {
    response.status(400).json({ error: "invalid id" });
    return;
  }

  const body = parseBody(request.body);
  if ("error" in body) {
    response.status(400).json({ error: body.error });
    return;
  }

  const meme = await MemeModel.findById(memeId);
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  // Un comentario ya eliminado (por su autor o por un admin) no se puede
  // reportar: ya no tiene contenido que revisar.
  const comment = await CommentModel.findOne({
    _id: commentId,
    meme: meme._id,
    deletedAt: null,
    removedAt: null,
  });
  if (!comment) {
    response.status(404).json({ error: "comment not found" });
    return;
  }

  const failure = await saveReport({
    reporter: request.userId,
    targetType: "comment",
    meme: meme._id,
    comment: comment._id,
    targetUser: comment.user,
    ...body,
  });
  if (failure) {
    response.status(failure.status).json({ error: failure.error, code: failure.code });
    return;
  }
  response.status(201).json({ message: "report received" });
});

export const userReportRouter = express.Router({ mergeParams: true });

// Reporta a un usuario (su perfil o su conducta en general; si el problema es un
// meme o un comentario concreto, se reporta ese contenido). Los admins no se
// pueden reportar: ningún admin puede moderar a otro, así que el reporte no
// tendría quién lo resuelva. Un usuario ya baneado tampoco: ya no hay nada que
// decidir.
userReportRouter.post<UserParams>("/", withUser, async (request, response) => {
  const body = parseBody(request.body);
  if ("error" in body) {
    response.status(400).json({ error: body.error });
    return;
  }

  const target = await User.findOne(
    { username: request.params.username },
    "role bannedAt"
  );
  if (!target) {
    response.status(404).json({ error: "user not found" });
    return;
  }
  if (target.role === "admin") {
    response.status(403).json({
      error: "admins cannot be reported",
      code: "admin_target",
    });
    return;
  }
  if (target.bannedAt) {
    response.status(409).json({
      error: "this user is already banned",
      code: "user_banned",
    });
    return;
  }

  const failure = await saveReport({
    reporter: request.userId,
    targetType: "user",
    meme: null,
    comment: null,
    targetUser: target._id,
    ...body,
  });
  if (failure) {
    response.status(failure.status).json({ error: failure.error, code: failure.code });
    return;
  }
  response.status(201).json({ message: "report received" });
});
