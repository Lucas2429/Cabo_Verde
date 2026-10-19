import express from "express";
import mongoose from "mongoose";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import User from "../models/user";
import { withUser } from "../utils/middleware";

const MAX_CONTENT_LENGTH = 300;

// Se monta en /api/memes/:id/comments (ver controllers/memes.ts). mergeParams
// hace que aquí también esté disponible el :id del meme.
const router = express.Router({ mergeParams: true });

// Público: cualquiera (incluidos invitados) puede leer los comentarios.
// Del más nuevo al más viejo, igual que la galería.
router.get("/", async (request, response) => {
  const memeExists = await MemeModel.exists({ _id: request.params.id });
  if (!memeExists) {
    response.status(404).json({ error: "meme not found" });
    return;
  }

  const comments = await CommentModel.find({ meme: request.params.id }).sort({
    createdAt: -1,
  });
  response.json(comments);
});

// Solo usuarios con sesión. Espera JSON con los campos:
//   - content: texto del comentario (1 a 300 caracteres)
//   - parent:  (opcional) id del comentario al que se responde. Debe ser un
//              comentario de este mismo meme. Si falta o es null, el comentario
//              es de primer nivel.
router.post("/", withUser, async (request, response) => {
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

  const memeExists = await MemeModel.exists({ _id: request.params.id });
  if (!memeExists) {
    response.status(404).json({ error: "meme not found" });
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
  response.status(201).json(savedComment);
});


/*
 Editar un comentario propio.
 PATCH /api/memes/:id/comments/:commentId
 */
router.patch("/:commentId", withUser, async (request, response) => {
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

  // Actualizar y guardar
  comment.content = content;

  const updatedComment = await comment.save();

  // Devolver el comentario actualizado
  response.status(200).json(updatedComment);
});


export default router;
