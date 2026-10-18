import bcrypt from "bcrypt";
import express from "express";
import MemeModel from "../models/memes";
import { withReactionCounts } from "../models/reaction";
import User, {
  DEFAULT_DEPARTMENT,
  DEPARTMENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
} from "../models/user";
import { withUser } from "../utils/middleware";

// Cuántos memes recientes se muestran en el perfil.
const LATEST_MEMES_LIMIT = 3;

const router = express.Router();

// Devuelven un mensaje de error, o null si el valor es válido.
const checkDisplayName = (value: unknown): string | null =>
  typeof value !== "string" ||
  value.trim().length < 1 ||
  value.trim().length > MAX_DISPLAY_NAME_LENGTH
    ? `displayName must be between 1 and ${MAX_DISPLAY_NAME_LENGTH} characters long`
    : null;

const checkDescription = (value: unknown): string | null =>
  typeof value !== "string" || value.trim().length > MAX_DESCRIPTION_LENGTH
    ? `description must be at most ${MAX_DESCRIPTION_LENGTH} characters long`
    : null;

router.post("/", async (request, response) => {
  const { username, email, password, department, displayName, description } =
    request.body;

  if (!username || username.length < 3) {
    response.status(400).json({
      error: "username must be at least 3 characters long",
    });
    return;
  }

  if (!password || password.length < 3) {
    response.status(400).json({
      error: "password must be at least 3 characters long",
    });
    return;
  }

  if (
    department !== undefined &&
    !(DEPARTMENTS as readonly string[]).includes(department)
  ) {
    response.status(400).json({
      error: `department must be one of: ${DEPARTMENTS.join(", ")}`,
    });
    return;
  }

  // displayName y description son opcionales al registrarse: si no vienen, el
  // nombre a mostrar es el username y la descripción queda vacía.
  const displayNameError =
    displayName !== undefined ? checkDisplayName(displayName) : null;
  if (displayNameError) {
    response.status(400).json({ error: displayNameError });
    return;
  }
  const descriptionError =
    description !== undefined ? checkDescription(description) : null;
  if (descriptionError) {
    response.status(400).json({ error: descriptionError });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({
    username,
    email,
    passwordHash,
    department: department ?? DEFAULT_DEPARTMENT,
    displayName:
      displayName !== undefined
        ? displayName.trim()
        : String(username).slice(0, MAX_DISPLAY_NAME_LENGTH),
    description: description !== undefined ? description.trim() : "",
  });
  const savedUser = await user.save();

  response.status(201).json(savedUser);
});

router.get("/", async (request, response) => {
  const users = await User.find({});
  response.json(users);
});

// Edita el perfil del usuario con sesión (el id sale del token, nunca del
// cliente, así que nadie puede editar el perfil de otro). Va ANTES de las rutas
// con parámetro para que "me" no se confunda con un username.
router.patch("/me", withUser, async (request, response) => {
  const { displayName, description } = request.body ?? {};

  if (displayName === undefined && description === undefined) {
    response.status(400).json({ error: "nothing to update" });
    return;
  }

  const displayNameError =
    displayName !== undefined ? checkDisplayName(displayName) : null;
  if (displayNameError) {
    response.status(400).json({ error: displayNameError });
    return;
  }
  const descriptionError =
    description !== undefined ? checkDescription(description) : null;
  if (descriptionError) {
    response.status(400).json({ error: descriptionError });
    return;
  }

  const user = await User.findById(request.userId);
  if (!user) {
    response.status(401).json({ error: "user not found" });
    return;
  }

  if (displayName !== undefined) user.displayName = displayName.trim();
  if (description !== undefined) user.description = description.trim();
  await user.save();

  response.json({
    displayName: user.displayName || user.username,
    description: user.description,
  });
});

// Perfil público (también para invitados): datos del usuario, cantidad de
// memes publicados y los últimos memes (con sus likes y dislikes). No incluye
// correo ni nada privado.
router.get("/:username", async (request, response) => {
  const user = await User.findOne({ username: request.params.username });
  if (!user) {
    response.status(404).json({ error: "user not found" });
    return;
  }

  const [memesCount, latestMemes] = await Promise.all([
    MemeModel.countDocuments({ user: user._id }),
    MemeModel.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(LATEST_MEMES_LIMIT),
  ]);

  response.json({
    username: user.username,
    displayName: user.displayName || user.username,
    description: user.description ?? "",
    department: user.department,
    memesCount,
    latestMemes: await withReactionCounts(latestMemes),
  });
});

export default router;
