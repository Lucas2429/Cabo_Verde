import mongoose from "mongoose";

export interface MemeData {
  content: string;
  author: string;
  // URL pública de la imagen. Para memes subidos es "/uploads/<archivo>".
  image: string;
  user: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const memeSchema = new mongoose.Schema<MemeData>(
  {
    content: { type: String, required: true, minlength: 1, maxlength: 300 },
    author: { type: String, required: true },
    image: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  }
);

// Para listar los memes de un perfil (los más recientes primero) sin recorrer
// toda la colección.
memeSchema.index({ user: 1, createdAt: -1 });

memeSchema.set("toJSON", {
  transform: (
    _,
    returnedObject: {
      id?: string;
      _id?: mongoose.Types.ObjectId;
      __v?: number;
      user?: unknown;
    }
  ) => {
    returnedObject.id = returnedObject._id?.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // El id interno del usuario no necesita salir al cliente.
    delete returnedObject.user;
  },
});

// Se mantiene el nombre del modelo para no cambiar la colección en MongoDB.
const MemeModel = mongoose.model<MemeData>("MemesData", memeSchema);

export default MemeModel;
