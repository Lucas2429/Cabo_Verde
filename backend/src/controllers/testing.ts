import express from "express";
import CommentModel from "../models/comment";
import MemeModel from "../models/memes";
import ReactionModel from "../models/reaction";
import User from "../models/user";

// LAB 8 - P3: router con utilidades SOLO para pruebas.
// Se monta en app.ts únicamente cuando NODE_ENV === "test".
const router = express.Router();

// POST /api/testing/reset
// Deja la base de datos de pruebas vacía (memes, comentarios, reacciones y
// usuarios) para que cada test E2E parta desde un estado conocido.
router.post("/reset", async (request, response) => {
  await ReactionModel.deleteMany({});
  await CommentModel.deleteMany({});
  await MemeModel.deleteMany({});
  await User.deleteMany({});

  response.status(204).end();
});

export default router;
