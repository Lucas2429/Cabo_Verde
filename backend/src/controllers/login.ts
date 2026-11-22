import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import express from "express";
import User from "../models/user";
import config from "../utils/config";
import { BANNED_ERROR, withUser } from "../utils/middleware";

const router = express.Router();

router.post("/", async (request, response) => {
  const { username, password } = request.body;

  const user = await User.findOne({ username });
  const passwordCorrect = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordCorrect) {
    response.status(401).json({ error: "invalid username or password" });
    return;
  }

  // Una cuenta baneada no puede iniciar sesión. Se avisa solo después de
  // validar la contraseña: así nadie puede averiguar quiénes están baneados
  // probando nombres de usuario.
  if (user.bannedAt) {
    response.status(403).json(BANNED_ERROR);
    return;
  }

  const userForToken = {
    username: user.username,
    csrf: crypto.randomUUID(),
    id: user._id,
  };

  const token = jwt.sign(userForToken, config.JWT_SECRET, {
    expiresIn: 60 * 60,
  });

  response.setHeader("X-CSRF-Token", userForToken.csrf);
  response.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000,
  });
  // El token CSRF también va en el body para que el frontend pueda guardarlo
  // y restaurar la sesión si se recarga la página.
  response.status(200).json({ username: user.username, csrf: userForToken.csrf });
});

router.get("/me", withUser, async (request, response) => {
  const user = await User.findById(request.userId);
  if (!user) {
    response.status(404).json({ error: "user not found" });
    return;
  }
  // El rol sale solo aquí (y solo para el propio usuario): el frontend lo usa
  // para mostrar u ocultar las opciones de administración. Ocultarlas es solo
  // comodidad; cada ruta de /api/admin vuelve a comprobar el rol en el backend.
  response.json({ ...user.toJSON(), role: user.role });
});

router.post("/logout", (request, response) => {
  response.clearCookie("token");
  response.status(200).json({ message: "Logged out successfully" });
});

export default router;
