import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "./config";
import logger from "./logger";
import User from "../models/user";
import { MAX_IMAGE_SIZE } from "./upload";

const requestLogger = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  logger.info("Method:", request.method);
  logger.info("Path:  ", request.path);
  // No imprimir contraseñas en los logs.
  const body =
    request.body && typeof request.body === "object" && "password" in request.body
      ? { ...request.body, password: "***" }
      : request.body;
  logger.info("Body:  ", body);
  logger.info("---");
  next();
};

const unknownEndpoint = (request: Request, response: Response) => {
  response.status(404).send({ error: "unknown endpoint" });
};

const errorHandler = (
  error: { name: string; message: string; code?: string },
  request: Request,
  response: Response,
  next: NextFunction
) => {
  logger.error(error.message);

  if (error.name === "CastError") {
    response.status(400).send({ error: "malformatted id" });
  } else if (error.name === "ValidationError") {
    response.status(400).json({ error: error.message });
  } else if (
    error.name === "MongoServerError" &&
    error.message.includes("E11000 duplicate key error")
  ) {
    const field = error.message.includes("email") ? "email" : "username";
    response.status(400).json({ error: `expected \`${field}\` to be unique` });
  } else if (error.name === "TokenExpiredError") {
    response.status(401).json({ error: "token expired" });
  } else if (error.name === "InvalidImageError") {
    response.status(400).json({ error: error.message });
  } else if (error.name === "MulterError") {
    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        error: `image must be at most ${MAX_IMAGE_SIZE / (1024 * 1024)} MB`,
      });
    } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
      response.status(400).json({ error: "unexpected file field, use `image`" });
    } else {
      response.status(400).json({ error: error.message });
    }
  } else {
    next(error);
  }
};

// Respuesta (403) cuando una cuenta baneada intenta iniciar sesión o usar una
// sesión abierta. El `code` permite al frontend mostrar su propio aviso.
export const BANNED_ERROR = {
  error: "this account has been banned",
  code: "banned",
} as const;

export const withUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let userId: string;
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: "missing token" });
      return;
    }
    const decodedToken = jwt.verify(token, config.JWT_SECRET);
    const csrfToken = req.headers["x-csrf-token"];
    if (
      typeof decodedToken !== "object" ||
      !decodedToken.id ||
      decodedToken.csrf !== csrfToken
    ) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    userId = decodedToken.id;
  } catch {
    res.status(401).json({ error: "invalid token" });
    return;
  }

  try {
    // Una cuenta baneada pierde el acceso AL INSTANTE, aunque su sesión (el
    // token, que dura 1 hora) siga vigente: por eso se consulta la base de datos
    // en cada petición y no solo al iniciar sesión. Se borra también la cookie.
    const account = await User.findById(userId, "bannedAt");
    if (account?.bannedAt) {
      res.clearCookie("token");
      res.status(403).json(BANNED_ERROR);
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  req.userId = userId;
  next();
};

// Solo admins. Se usa DESPUÉS de withUser (que valida la sesión y deja el id en
// req.userId); `withAdmin` ya trae ambos en orden. El rol se lee de la base de
// datos en cada petición y no del token, así que quitarle el rol a alguien
// (npm run set-role) surte efecto al instante, aunque su sesión siga vigente.
// Responde 403 si el usuario no es admin.
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId, "role");
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "admin access required" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const withAdmin = [withUser, requireAdmin];

export const withOptionalUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.cookies?.token) {
    next();
    return;
  }
  await withUser(req, res, next);
};

export default { requestLogger, unknownEndpoint, errorHandler };
