import express from "express";
import mongoose from "mongoose";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReportModel, {
  MAX_REPORT_DETAILS_LENGTH,
  MAX_REPORTS_PER_HOUR,
  REPORT_REASONS,
  type ReportReason,
} from "../models/report";
import { withUser } from "../utils/middleware";

// Reportar contenido ajeno. Hay dos routers porque cada uno se monta bajo su
// propio recurso:
//   - memeReportRouter:    POST /api/memes/:id/report
//   - commentReportRouter: POST /api/memes/:id/comments/:commentId/report
// Los dos reciben JSON con:
//   - reason:  uno de REPORT_REASONS
//   - details: texto de hasta 200 caracteres. Obligatorio si reason es "other".

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
  targetType: "meme" | "comment";
  meme: mongoose.Types.ObjectId;
  comment: mongoose.Types.ObjectId | null;
  // Autor del contenido reportado.
  targetUser: mongoose.Types.ObjectId;
  reason: ReportReason;
  details: string;
}

// Reglas comunes a los dos tipos de reporte. Devuelve { status, error } si el
// reporte no se puede crear, o null si se creó.
const saveReport = async (
  data: NewReport
): Promise<{ status: number; error: string } | null> => {
  if (data.targetUser.toString() === data.reporter) {
    return { status: 403, error: "you cannot report your own content" };
  }

  // Freno a los abusos: no más de MAX_REPORTS_PER_HOUR reportes por hora.
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);
  const recentReports = await ReportModel.countDocuments({
    reporter: data.reporter,
    createdAt: { $gte: lastHour },
  });
  if (recentReports >= MAX_REPORTS_PER_HOUR) {
    return { status: 429, error: "too many reports, try again later" };
  }

  const alreadyReported = await ReportModel.exists({
    reporter: data.reporter,
    meme: data.meme,
    comment: data.comment,
  });
  if (alreadyReported) {
    return { status: 409, error: "you already reported this content" };
  }

  try {
    await new ReportModel(data).save();
  } catch (error) {
    // Dos reportes iguales al mismo tiempo: el índice único deja pasar solo uno.
    if ((error as { code?: number }).code === 11000) {
      return { status: 409, error: "you already reported this content" };
    }
    throw error;
  }
  return null;
};

export const memeReportRouter = express.Router({ mergeParams: true });

memeReportRouter.post("/", withUser, async (request, response) => {
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
    response.status(failure.status).json({ error: failure.error });
    return;
  }
  response.status(201).json({ message: "report received" });
});

export const commentReportRouter = express.Router({ mergeParams: true });

commentReportRouter.post("/", withUser, async (request, response) => {
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
    response.status(failure.status).json({ error: failure.error });
    return;
  }
  response.status(201).json({ message: "report received" });
});
