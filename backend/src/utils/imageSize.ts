// Lee el ancho y el alto de una imagen directamente de los bytes del archivo
// (de su cabecera), sin descomprimirla y sin depender de ninguna librería. Se usa
// al subir un meme para guardar su tamaño: así el frontend puede reservar el
// espacio de la tarjeta antes de que la imagen termine de descargarse.
//
// Solo se leen los formatos que acepta la subida (JPG, PNG, GIF y WebP). Si el
// archivo está truncado o tiene una estructura inesperada, devuelve null: en ese
// caso el meme se guarda igual, sin tamaño, y la galería lo muestra como antes.

export type ImageFormat = "jpg" | "png" | "gif" | "webp";

export interface ImageSize {
  width: number;
  height: number;
}

// PNG: el primer bloque es IHDR, con el ancho y el alto en 4 bytes cada uno.
const readPng = (buf: Buffer): ImageSize | null => {
  if (buf.length < 24 || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

// GIF: ancho y alto de la pantalla lógica, en 2 bytes cada uno (little endian).
const readGif = (buf: Buffer): ImageSize | null => {
  if (buf.length < 10) return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
};

// WebP: después de la cabecera RIFF viene un bloque que puede ser de tres tipos
// (con pérdida, sin pérdida o extendido) y cada uno guarda el tamaño distinto.
const readWebp = (buf: Buffer): ImageSize | null => {
  if (buf.length < 30) return null;

  switch (buf.toString("ascii", 12, 16)) {
    case "VP8 ":
      // Con pérdida: 14 bits para cada medida.
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
      };
    case "VP8L": {
      // Sin pérdida: ancho y alto (menos 1) empaquetados en 4 bytes.
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    case "VP8X":
      // Extendido: ancho y alto (menos 1) en 3 bytes cada uno.
      return {
        width: 1 + buf.readUIntLE(24, 3),
        height: 1 + buf.readUIntLE(27, 3),
      };
    default:
      return null;
  }
};

// Orientación EXIF (1 a 8) que guardan las cámaras y los celulares dentro del
// JPG. Los navegadores la aplican al mostrar la imagen: con los valores 5 a 8
// la foto se muestra girada 90°, es decir, con el ancho y el alto INTERCAMBIADOS
// respecto de lo que dice la cabecera. Devuelve null si el bloque no es EXIF y 1
// ("sin girar") si no trae la etiqueta o está dañado.
const readExifOrientation = (app1: Buffer): number | null => {
  if (app1.length < 6 || app1.toString("ascii", 0, 4) !== "Exif") return null;

  try {
    const tiff = 6; // el encabezado TIFF empieza después de "Exif\0\0"
    const byteOrder = app1.toString("ascii", tiff, tiff + 2);
    if (byteOrder !== "II" && byteOrder !== "MM") return 1;
    const little = byteOrder === "II";

    const u16 = (offset: number) =>
      little ? app1.readUInt16LE(offset) : app1.readUInt16BE(offset);
    const u32 = (offset: number) =>
      little ? app1.readUInt32LE(offset) : app1.readUInt32BE(offset);

    // Primera tabla de etiquetas (IFD0): cantidad y luego entradas de 12 bytes.
    const ifd = tiff + u32(tiff + 4);
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
    return 1;
  } catch {
    // Un EXIF dañado no debe impedir leer el tamaño: se asume sin girar.
    return 1;
  }
};

// Marcadores SOF de JPEG: los que traen el tamaño (C4, C8 y CC se parecen, pero
// no son de tamaño).
const isSof = (marker: number): boolean =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

// JPG: el archivo es una cadena de bloques (marcador + largo). Se recorre hasta
// encontrar el bloque SOF (que trae el tamaño); en el camino se lee la
// orientación EXIF, que casi siempre viene antes.
const readJpeg = (buf: Buffer): ImageSize | null => {
  let offset = 2; // se salta el marcador de inicio (FF D8)
  let orientation = 1;

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return null;

    let marker = buf[offset + 1];
    // Antes del marcador puede haber bytes FF de relleno.
    while (marker === 0xff) {
      offset++;
      if (offset + 1 >= buf.length) return null;
      marker = buf[offset + 1];
    }

    // Marcadores sin contenido (RST, inicio de imagen, TEM): se saltan.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    // Fin de la imagen o inicio de los datos: ya no vendrá el tamaño.
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;

    if (marker === 0xe1) {
      // Si hay varios bloques APP1 (EXIF y XMP, por ejemplo), solo cuenta el EXIF.
      const found = readExifOrientation(buf.subarray(offset + 4, offset + 2 + length));
      if (found !== null) orientation = found;
    }

    if (isSof(marker)) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      // Con orientación 5 a 8 el navegador la muestra girada: se intercambian.
      return orientation >= 5 ? { width: height, height: width } : { width, height };
    }

    offset += 2 + length;
  }
  return null;
};

// Devuelve el tamaño tal como lo muestra el navegador (con la orientación EXIF
// ya aplicada), o null si no se pudo leer. El formato lo detecta antes
// `detectExtension` (utils/upload.ts), a partir de los primeros bytes.
export const getImageSize = (buffer: Buffer, format: ImageFormat): ImageSize | null => {
  try {
    const size =
      format === "jpg"
        ? readJpeg(buffer)
        : format === "png"
          ? readPng(buffer)
          : format === "gif"
            ? readGif(buffer)
            : readWebp(buffer);

    return size && size.width > 0 && size.height > 0 ? size : null;
  } catch {
    // Un archivo truncado hace que readUInt* se salga del buffer (RangeError).
    return null;
  }
};
