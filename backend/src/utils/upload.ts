import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import multer from "multer";

// Máximo por imagen. Se aplica en el servidor (multer corta la subida al
// pasarse), así que nadie puede saltarse el límite desde el navegador.
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

// Las imágenes se guardan en disco (backend/uploads) y en MongoDB solo se
// guarda la URL. Así los documentos quedan pequeños y la BD no crece con
// binarios. Esta ruta es la misma si se corre con tsx (src/utils) o compilado
// (out/utils).
export const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
export const UPLOADS_URL_PREFIX = "/uploads";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export class InvalidImageError extends Error {
  constructor(message = "image must be a JPG, PNG, WEBP or GIF file") {
    super(message);
    this.name = "InvalidImageError";
  }
}

// Middleware de multer: espera un único archivo en el campo "image".
// Se guarda en memoria (máx. 2 MB) para validar el contenido antes de escribir
// nada a disco.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new InvalidImageError());
    }
  },
}).single("image");

// El mimetype lo declara el cliente y se puede falsificar, así que además se
// revisan los primeros bytes del archivo ("magic numbers").
const detectExtension = (buffer: Buffer): "jpg" | "png" | "gif" | "webp" | null => {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "png";
  }
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header === "GIF87a" || header === "GIF89a") {
    return "gif";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
};

// Valida el archivo y lo guarda con un nombre aleatorio (la extensión se
// deduce del contenido, nunca del nombre que envió el usuario).
// Devuelve la URL pública, p. ej. "/uploads/3f1c...e2.jpg".
export const saveImage = async (buffer: Buffer): Promise<string> => {
  const extension = detectExtension(buffer);
  if (!extension) {
    throw new InvalidImageError("file is not a valid image");
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return `${UPLOADS_URL_PREFIX}/${filename}`;
};

// Borra una imagen subida (por ejemplo si falló el guardado en la BD).
export const removeImage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl.startsWith(`${UPLOADS_URL_PREFIX}/`)) return;
  // basename evita salirse de la carpeta de uploads.
  const filename = path.basename(imageUrl);
  await fs.unlink(path.join(UPLOADS_DIR, filename)).catch(() => undefined);
};
