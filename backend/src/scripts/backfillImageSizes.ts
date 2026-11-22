// Calcula el tamaño (ancho y alto) de las imágenes de los memes que todavía no lo
// tienen: los subidos antes de que se guardara ese dato. Con el tamaño, la
// galería reserva el espacio de cada tarjeta antes de que la imagen cargue; los
// memes sin él se siguen viendo bien, solo que sin esa reserva.
//
//   npm run backfill-image-sizes
//
// Es seguro repetirlo: solo toca los memes que siguen sin tamaño. Usa la base de
// datos del .env (con NODE_ENV=test, la de pruebas). Lee los archivos de
// backend/uploads y NO modifica `updatedAt` de los memes.
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import MemeModel from "../models/memes";
import config from "../utils/config";
import { getImageSize } from "../utils/imageSize";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX, detectExtension } from "../utils/upload";

const main = async (): Promise<number> => {
  if (!config.MONGODB_URI) {
    console.error("Falta MONGODB_URI en el .env");
    return 1;
  }

  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DBNAME });
  try {
    // `width: null` también coincide con los memes que no tienen el campo. Se
    // incluyen los eliminados por moderación: siguen en la base de datos y se ven
    // en la vista de reportes de los admins.
    const memes = await MemeModel.find({
      $or: [{ width: null }, { height: null }],
    }).setOptions({ includeRemoved: true });

    let updated = 0;
    const skipped: string[] = [];

    for (const meme of memes) {
      // Solo se pueden leer las imágenes guardadas en backend/uploads.
      if (!meme.image.startsWith(`${UPLOADS_URL_PREFIX}/`)) {
        skipped.push(`${meme.id}: la imagen no es un archivo propio (${meme.image})`);
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = await fs.readFile(path.join(UPLOADS_DIR, path.basename(meme.image)));
      } catch {
        skipped.push(`${meme.id}: no se encontró el archivo ${meme.image}`);
        continue;
      }

      const format = detectExtension(buffer);
      const size = format ? getImageSize(buffer, format) : null;
      if (!size) {
        skipped.push(`${meme.id}: no se pudo leer el tamaño de ${meme.image}`);
        continue;
      }

      // timestamps: false para que el meme no figure como "modificado".
      await MemeModel.updateOne(
        { _id: meme._id },
        { $set: { width: size.width, height: size.height } },
        { timestamps: false }
      );
      updated++;
    }

    console.log(
      `Memes sin tamaño: ${memes.length}. Actualizados: ${updated}. Omitidos: ${skipped.length}. (BD: ${config.MONGODB_DBNAME})`
    );
    skipped.forEach((reason) => console.log(`  - ${reason}`));
    return 0;
  } finally {
    await mongoose.disconnect();
  }
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
