import express from "express";
import MemeModel from "../models/memes";
import User from "../models/user";
import { withUser } from "../utils/middleware";
import { removeImage, saveImage, uploadImage } from "../utils/upload";

const MAX_CONTENT_LENGTH = 300;

const router = express.Router();

// Público: cualquiera (incluidos invitados) puede ver los memes.
router.get("/", async (_request, response) => {
  const memes = await MemeModel.find({}).sort({ createdAt: -1 });
  response.json(memes);
});

router.get("/:id", async (request, response) => {
  const meme = await MemeModel.findById(request.params.id);
  if (!meme) {
    response.status(404).end();
    return;
  }
  response.json(meme);
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
    response.status(201).json(savedMeme);
  } catch (error) {
    // Si falla el guardado, no dejar la imagen huérfana en disco.
    await removeImage(image);
    throw error;
  }
});

export default router;
