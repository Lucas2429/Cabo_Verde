import express from "express";
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

// Solo usuarios con sesión. Espera JSON con el campo:
//   - content: texto del comentario (1 a 300 caracteres)
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

  const comment = new CommentModel({
    content,
    // El autor sale de la sesión, nunca de lo que mande el cliente.
    author: user.username,
    meme: request.params.id,
    user: user._id,
  });
  const savedComment = await comment.save();
  response.status(201).json(savedComment);
});

export default router;
