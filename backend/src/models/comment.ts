import mongoose from "mongoose";
import User from "./user";

export interface CommentData {
  content: string;
  author: string;
  // Meme al que pertenece el comentario.
  meme: mongoose.Types.ObjectId;
  // Comentario al que responde este comentario. null si es de primer nivel.
  // Los comentarios anteriores a las respuestas no tienen el campo: se tratan
  // como null.
  parent: mongoose.Types.ObjectId | null;
  user: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // Eliminación por moderación ("borrado con huella"). A diferencia de
  // `deletedAt` (el autor borra el suyo y el texto se reemplaza), aquí el texto
  // ORIGINAL se conserva en `content` como evidencia y solo se oculta al
  // público (ver toJSON). El comentario nunca se borra físicamente: queda como
  // "Comentario eliminado", igual que en Reddit.
  removedAt: Date | null;
  removedBy: mongoose.Types.ObjectId | null;
  removalReason: string | null;
}

const commentSchema = new mongoose.Schema<CommentData>(
  {
    content: { type: String, required: true, minlength: 1, maxlength: 300 },
    author: { type: String, required: true },
    // Se indexa porque siempre se consulta "los comentarios de este meme".
    meme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemesData",
      required: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null, },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removalReason: { type: String, default: null },

  },
  {
    timestamps: true,
  }
);

commentSchema.set("toJSON", {
  transform: (
    _,
    returnedObject: {
      id?: string;
      _id?: mongoose.Types.ObjectId;
      __v?: number;
      meme?: unknown;
      parent?: mongoose.Types.ObjectId | string | null;
      user?: unknown;
      content?: string;
      deletedAt?: Date | null;
      removedAt?: Date | null;
      removedBy?: unknown;
      removalReason?: unknown;
    }
  ) => {
    returnedObject.id = returnedObject._id?.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // Los ids internos del meme y del usuario no necesitan salir al cliente.
    delete returnedObject.meme;
    delete returnedObject.user;
    // A diferencia del meme, el cliente SÍ necesita el id del padre para armar
    // los hilos. Siempre se envía (null si es un comentario de primer nivel).
    returnedObject.parent = returnedObject.parent?.toString() ?? null;
    // Comentario eliminado por moderación: al público se le entrega igual que uno
    // eliminado por su autor (sin el texto y con `deletedAt`), así el frontend
    // lo muestra como "Comentario eliminado". El texto original y los datos de
    // la eliminación solo los ven los admins, por controllers/admin.ts.
    if (returnedObject.removedAt) {
      returnedObject.content = "[Comentario eliminado]";
      returnedObject.deletedAt = returnedObject.removedAt;
    }
    delete returnedObject.removedAt;
    delete returnedObject.removedBy;
    delete returnedObject.removalReason;
  },
});

const CommentModel = mongoose.model<CommentData>("Comment", commentSchema);

// Serializa comentarios (documentos de Mongoose) agregando `authorAvatar`, la
// foto de perfil actual de su autor (null si no tiene). Se busca en la tabla de
// usuarios en vez de guardarla en cada comentario, así si el autor cambia su
// foto, todos sus comentarios la muestran. TODO endpoint que devuelva
// comentarios debe pasar por aquí, para que el frontend reciba siempre la misma
// forma.
export const withAuthorAvatars = async <
  T extends { user: mongoose.Types.ObjectId; toJSON(): object }
>(
  comments: T[]
) => {
  const userIds = [...new Set(comments.map((comment) => comment.user.toString()))];
  const users = await User.find({ _id: { $in: userIds } }, "avatar");
  const avatars = new Map(users.map((user) => [user._id.toString(), user.avatar ?? null]));

  return comments.map((comment) => ({
    ...comment.toJSON(),
    authorAvatar: avatars.get(comment.user.toString()) ?? null,
  }));
};

export default CommentModel;
