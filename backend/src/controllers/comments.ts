import express from "express";
import mongoose from "mongoose";
import CommentModel, { withAuthorAvatars } from "../models/comment";
import MemeModel from "../models/memes";
import ReportModel, {
  PENDING_REPORTS_ERROR,
  commentHasPendingReports,
} from "../models/report";
import User from "../models/user";
import { withUser } from "../utils/middleware";
import { commentReportRouter } from "./reports";

const MAX_CONTENT_LENGTH = 300;

// Parámetros de la URL que llegan a estas rutas. El `:id` del meme viene del
// router padre (mergeParams) y Express no lo incluye en los tipos de las rutas
// hijas, así que se declara aquí. Son `type` y no `interface` para que encajen
// con los parámetros genéricos de Express.
type MemeParams = { id: string };
type CommentParams = { id: string; commentId: string };

// Se monta en /api/memes/:id/comments (ver controllers/memes.ts). mergeParams
// hace que aquí también esté disponible el :id del meme.
const router = express.Router({ mergeParams: true });

// Reportar un comentario: /api/memes/:id/comments/:commentId/report
router.use("/:commentId/report", commentReportRouter);

// Público: cualquiera (incluidos invitados) puede leer los comentarios.
// Del más nuevo al más viejo, igual que la galería.
router.get<MemeParams>("/", async (request, response) => {
  // Validar el ID del meme
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id", });
    return;
  }
  const memeExists = await MemeModel.exists({ _id: request.params.id });
  if (!memeExists) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  const comments = await CommentModel.find({ meme: request.params.id }).sort({
    createdAt: -1,
  });
  response.json(await withAuthorAvatars(comments));
});

// Solo usuarios con sesión. Espera JSON con los campos:
//   - content: texto del comentario (1 a 300 caracteres)
//   - parent:  (opcional) id del comentario al que se responde. Debe ser un
//              comentario de este mismo meme. Si falta o es null, el comentario
//              es de primer nivel.
router.post<MemeParams>("/", withUser, async (request, response) => {

  // Validar el ID del meme
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ error: "invalid meme id", });
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

  const meme = await MemeModel.findById(request.params.id, "commentsLocked");
  if (!meme) {
    response.status(404).json({ error: "meme not found" });
    return;
  }
  // Un admin puede limitar los comentarios de un meme (como en Instagram): se
  // siguen viendo, pero no se puede comentar ni responder.
  if (meme.commentsLocked) {
    response.status(403).json({ error: "comments are limited on this meme" });
    return;
  }

  const user = await User.findById(request.userId);
  if (!user) {
    response.status(401).json({ error: "user not found" });
    return;
  }

  // Si es una respuesta, el comentario padre tiene que existir Y ser de este
  // mismo meme (si no, se podría "responder" a un comentario de otro meme).
  const rawParent = request.body?.parent;
  let parentId: string | null = null;
  if (rawParent !== undefined && rawParent !== null) {
    if (typeof rawParent !== "string" || !mongoose.isValidObjectId(rawParent)) {
      response.status(400).json({ error: "parent must be a valid comment id" });
      return;
    }
    const parentExists = await CommentModel.exists({
      _id: rawParent,
      meme: request.params.id,
      deletedAt: null,
      removedAt: null,
    });
    if (!parentExists) {
      response.status(404).json({ error: "parent comment not found" });
      return;
    }
    parentId = rawParent;
  }

  const comment = new CommentModel({
    content,
    // El autor sale de la sesión, nunca de lo que mande el cliente.
    author: user.username,
    meme: request.params.id,
    parent: parentId,
    user: user._id,
  });
  const savedComment = await comment.save();
  const [commentWithAvatar] = await withAuthorAvatars([savedComment]);
  response.status(201).json(commentWithAvatar);
});


/*
 Editar un comentario propio.
 PATCH /api/memes/:id/comments/:commentId
 */
router.patch<CommentParams>("/:commentId", withUser, async (request, response) => {
  const { id: memeId, commentId } = request.params;

  // Validar identificadores
  if (!mongoose.isValidObjectId(memeId) || !mongoose.isValidObjectId(commentId)) {
    response.status(400).json({ error: "invalid id" });
    return;
  }

  // Validar el nuevo contenido
  const content = typeof request.body?.content === "string"
    ? request.body.content.trim()
    : "";

  if (!content) {
    response.status(400).json({ error: "content is required" });
    return;
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    response.status(400).json({ error: `content must be at most ${MAX_CONTENT_LENGTH} characters long`, });
    return;
  }

  // Buscar el comentario dentro del meme
  const comment = await CommentModel.findOne({
    _id: commentId,
    meme: memeId,
  });

  if (!comment) {
    response.status(404).json({ error: "comment not found" });
    return;
  }

  // Comprobar que pertenece al usuario autenticado
  if (comment.user.toString() !== request.userId) {
    response.status(403).json({ error: "you can only edit your own comments", });
    return;
  }

  if (comment.deletedAt || comment.removedAt) {
    response.status(409).json({ error: "cannot edit a deleted comment", });
    return;
  }

  // Con reportes pendientes no se puede editar: si no, se corregiría justo lo
  // reportado y el admin revisaría otro texto. Se desbloquea al resolverlos.
  if (await commentHasPendingReports(comment._id)) {
    response.status(409).json(PENDING_REPORTS_ERROR);
    return;
  }

  // Actualizar y guardar
  comment.content = content;

  const updatedComment = await comment.save();

  // Devolver el comentario actualizado
  response.status(200).json(updatedComment);
});


/*
 Eliminar un comentario propio:
 - Sin respuestas: eliminación física.
 - Con respuestas: eliminación lógica.

 DELETE /api/memes/:id/comments/:commentId
 */

router.delete<CommentParams>("/:commentId", withUser, async (request, response) => {
  const { id: memeId, commentId } = request.params;

  if (!mongoose.isValidObjectId(memeId) || !mongoose.isValidObjectId(commentId)) {
    response.status(400).json({ error: "invalid id" });
    return;
  }

  const comment = await CommentModel.findOne({
    _id: commentId,
    meme: memeId,
  });

  if (!comment) {
    response.status(404).json({ error: "comment not found" });
    return;
  }

  if (comment.user.toString() !== request.userId) {
    response.status(403).json({ error: "you can only delete your own comments", });
    return;
  }

  if (comment.deletedAt || comment.removedAt) {
    response.status(409).json({ error: "comment already deleted", });
    return;
  }

  // Con reportes pendientes no se puede eliminar (ni siquiera de forma lógica):
  // sería una forma de esquivar la moderación. Se desbloquea al resolverlos.
  if (await commentHasPendingReports(comment._id)) {
    response.status(409).json(PENDING_REPORTS_ERROR);
    return;
  }

  // TODO: Coordinar la creación de respuestas (POST) y la eliminación
  // física de comentarios (DELETE) para evitar referencias huérfanas
  // cuando ambas operaciones ocurran simultáneamente.
  
  // Buscar respuestas directas a este comentario.
  const hasReplies = await CommentModel.exists({
    parent: comment._id,
    meme: memeId,
  });

  if (hasReplies) {
    // Con respuestas: conservar el documento y las relaciones.
    comment.content = "[Comentario eliminado]";
    comment.deletedAt = new Date();

    const deletedComment = await comment.save();
    // Sus reportes ya resueltos (descartados) quedan sin objeto. No puede haber
    // pendientes: arriba se bloquea la eliminación mientras los haya.
    await ReportModel.deleteMany({ comment: comment._id });

    response.status(200).json({
      deletionType: "soft",
      comment: deletedComment,
    });
    return;
  }

  // Sin respuestas: eliminar físicamente el documento (y sus reportes).
  await ReportModel.deleteMany({ comment: comment._id });
  await comment.deleteOne();

  response.status(200).json({
    deletionType: "hard",
    commentId: commentId,
  });
});



export default router;
