import mongoose from "mongoose";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Departamentos de la Facultad que se pueden elegir al crear una cuenta.
export const DEPARTMENTS = [
  "Astronomía",
  "DCC",
  "Física",
  "Geofísica",
  "Geología",
  "Civil",
  "Minas",
  "Eléctrica",
  "Industrial",
  "Matemática",
  "Mecánica",
  "Química, Biotecnología y Materiales",
] as const;

// Valor por defecto para los usuarios que ya existían antes de agregar el
// departamento (Mongoose lo aplica al leer documentos que no tienen el campo).
// No se ofrece como opción al registrarse.
export const DEFAULT_DEPARTMENT = "Sin especificar";

export type Department = (typeof DEPARTMENTS)[number] | typeof DEFAULT_DEPARTMENT;

export interface UserData {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  department: Department;
}

const userSchema = new mongoose.Schema<UserData>({
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [emailRegex, "invalid email"],
  },
  passwordHash: { type: String, required: true },
  department: {
    type: String,
    enum: [...DEPARTMENTS, DEFAULT_DEPARTMENT],
    default: DEFAULT_DEPARTMENT,
  },
});

userSchema.set("toJSON", {
  transform: (
    _,
    returnedObject: {
      id?: string;
      _id?: mongoose.Types.ObjectId;
      __v?: number;
      passwordHash?: string;
    }
  ) => {
    returnedObject.id = returnedObject._id?.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.passwordHash;
  },
});

const User = mongoose.model<UserData>("User", userSchema);

export default User;
