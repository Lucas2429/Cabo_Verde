import mongoose from "mongoose";

export interface MemeData {
  content: string;
  author: string;
  // URL pública de la imagen. Para memes subidos es "/uploads/<archivo>".
  image: string;
  // Tamaño de la imagen en píxeles, tal como la muestra el navegador (con la
  // orientación EXIF ya aplicada). El frontend lo usa para reservar el espacio de
  // la tarjeta antes de que la imagen cargue y que la galería no "salte". Es null
  // en los memes anteriores a este campo (se calcula con `npm run
  // backfill-image-sizes`) y cuando no se pudo leer del archivo.
  width: number | null;
  height: number | null;
  user: mongoose.Types.ObjectId;
  // true si un admin limitó los comentarios: el meme y sus comentarios se
  // siguen viendo, pero nadie puede comentar ni responder más.
  commentsLocked: boolean;
  // Eliminación por moderación ("borrado con huella"): el meme no se borra de
  // la base de datos, solo se marca. Mientras `removedAt` tenga fecha, el meme
  // desaparece de TODAS las consultas normales (ver el filtro automático más
  // abajo). El motivo y quién lo hizo quedan guardados como evidencia.
  removedAt: Date | null;
  removedBy: mongoose.Types.ObjectId | null;
  removalReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const memeSchema = new mongoose.Schema<MemeData>(
  {
    content: { type: String, required: true, minlength: 1, maxlength: 300 },
    author: { type: String, required: true },
    image: { type: String, required: true },
    width: { type: Number, default: null, min: 1 },
    height: { type: Number, default: null, min: 1 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    commentsLocked: { type: Boolean, default: false },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removalReason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

// Para listar los memes de un perfil (los más recientes primero) sin recorrer
// toda la colección.
memeSchema.index({ user: 1, createdAt: -1 });
// Para el podio semanal: memes creados desde el lunes, sin recorrer toda la
// colección.
memeSchema.index({ createdAt: -1 });

// Filtro automático: los memes eliminados por moderación NO aparecen en ninguna
// consulta (find, findById, exists, countDocuments...). Así el podio, la
// galería, los perfiles, los comentarios y las reacciones los ignoran sin que
// cada endpoint tenga que acordarse. Los memes anteriores a este campo no lo
// tienen, y en MongoDB `removedAt: null` también coincide con los que faltan.
//
// Las rutas de administración que necesitan ver los eliminados lo piden
// explícitamente con `.setOptions({ includeRemoved: true })`.
memeSchema.pre(["find", "findOne", "countDocuments"], function () {
  if (this.getOptions().includeRemoved) return;
  this.where({ removedAt: null });
});

memeSchema.set("toJSON", {
  transform: (
    _,
    returnedObject: {
      id?: string;
      _id?: mongoose.Types.ObjectId;
      __v?: number;
      user?: unknown;
      removedAt?: unknown;
      removedBy?: unknown;
      removalReason?: unknown;
    }
  ) => {
    returnedObject.id = returnedObject._id?.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // El id interno del usuario no necesita salir al cliente.
    delete returnedObject.user;
    // Los datos de la eliminación son solo para los admins: salen por sus
    // propias rutas (controllers/admin.ts), nunca en una respuesta pública.
    delete returnedObject.removedAt;
    delete returnedObject.removedBy;
    delete returnedObject.removalReason;
  },
});

// Se mantiene el nombre del modelo para no cambiar la colección en MongoDB.
const MemeModel = mongoose.model<MemeData>("MemesData", memeSchema);

export default MemeModel;
