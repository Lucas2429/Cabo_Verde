import mongoose from "mongoose";

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
  },
});

const CommentModel = mongoose.model<CommentData>("Comment", commentSchema);

export default CommentModel;
