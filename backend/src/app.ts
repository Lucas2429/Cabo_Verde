import express from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import config from "./utils/config";
import logger from "./utils/logger";
import middleware from "./utils/middleware";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "./utils/upload";
import memesRouter from "./controllers/memes";
import usersRouter from "./controllers/users";
import loginRouter from "./controllers/login";
// LAB 8 - P3: router de utilidades para pruebas (reinicio de la BD).
import testingRouter from "./controllers/testing";

const app = express();

mongoose.set("strictQuery", false);

if (config.MONGODB_URI) {
  mongoose
    // LAB 8 - P3: config.MONGODB_DBNAME ya depende del entorno
    // (MONGODB_DBNAME_TEST si NODE_ENV=test, MONGODB_DBNAME en otro caso).
    .connect(config.MONGODB_URI, { dbName: config.MONGODB_DBNAME })
    .then(() => logger.info(`connected to MongoDB (db: ${config.MONGODB_DBNAME})`))
    .catch((error) => {
      logger.error("error connecting to MongoDB:", error.message);
    });
}

app.use(express.static("dist"));

// Imágenes subidas por los usuarios. Los nombres son UUID aleatorios y nunca
// cambian, así que se pueden cachear sin problema.
app.use(
  UPLOADS_URL_PREFIX,
  express.static(UPLOADS_DIR, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(middleware.requestLogger);

app.use("/api/memes", memesRouter);
app.use("/api/users", usersRouter);
app.use("/api/login", loginRouter);

// LAB 8 - P3: el endpoint de reinicio SOLO existe en el entorno de pruebas.
// Se usa NODE_ENV === "test" (y no "development") porque en ese entorno el
// backend está conectado a la base de datos de prueba; así es imposible borrar
// por accidente los datos reales. En cualquier otro entorno la ruta no se
// registra y responde 404 ("unknown endpoint").
if (config.NODE_ENV === "test") {
  app.use("/api/testing", testingRouter);
}

// Cuando el backend sirve el frontend compilado (carpeta dist), las rutas del
// frontend como /login no existen en el servidor: se responde con index.html
// para que React Router las resuelva. No afecta a /api ni a /uploads.
const indexHtml = path.resolve("dist", "index.html");
app.get(/^\/(?!api\/|uploads\/).*/, (_request, response, next) => {
  if (fs.existsSync(indexHtml)) {
    response.sendFile(indexHtml);
  } else {
    next();
  }
});

app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

export default app;
