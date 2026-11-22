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

export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 150;

// Roles. Hay un solo nivel de moderación: "admin" (administrador/moderador).
// Nadie puede elegir su rol al registrarse: se asigna a mano con
// `npm run set-role -- <usuario> admin` (ver src/scripts/setRole.ts).
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export interface UserData {
  id: string;
  // Identificador único (se muestra como @username). No se puede repetir.
  username: string;
  // Nombre público del perfil. A diferencia del username, SÍ puede repetirse.
  // Los usuarios antiguos no lo tienen: se usa el username como respaldo.
  displayName?: string;
  // Descripción corta del perfil (puede estar vacía).
  description: string;
  // URL pública de la foto de perfil ("/uploads/<archivo>"). null (o ausente en
  // los usuarios antiguos) significa que no tiene foto.
  avatar?: string | null;
  email: string;
  passwordHash: string;
  department: Department;
  // Los usuarios anteriores a los roles no tienen el campo: se tratan como
  // "user" (Mongoose aplica el valor por defecto al leerlos).
  role: Role;
  // Baneo (lo aplica un admin, ver controllers/admin.ts). Una cuenta baneada no
  // puede iniciar sesión ni usar una sesión abierta: `withUser` lo comprueba en
  // cada petición. Mientras `bannedAt` sea null la cuenta está activa; los
  // usuarios anteriores a esta función no tienen el campo y cuentan como activos.
  // El motivo y quién lo aplicó son solo para los admins.
  bannedAt?: Date | null;
  bannedBy?: mongoose.Types.ObjectId | null;
  banReason?: string | null;
}

const userSchema = new mongoose.Schema<UserData>({
  // unique: true crea un índice único en MongoDB, así que el username nunca se
  // repite aunque dos registros lleguen al mismo tiempo.
  username: { type: String, required: true, unique: true },
  // Sin unique a propósito: varios usuarios pueden llamarse igual.
  displayName: { type: String, trim: true, maxlength: MAX_DISPLAY_NAME_LENGTH },
  description: {
    type: String,
    trim: true,
    maxlength: MAX_DESCRIPTION_LENGTH,
    default: "",
  },
  // Solo se guarda la URL; el archivo vive en backend/uploads (igual que los
  // memes).
  avatar: { type: String, default: null },
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
  role: { type: String, enum: [...ROLES], default: "user" },
  bannedAt: { type: Date, default: null },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  banReason: { type: String, default: null },
});

// Para filtrar los memes de la galería por carrera del autor.
userSchema.index({ department: 1 });

userSchema.set("toJSON", {
  transform: (
    _,
    returnedObject: {
      id?: string;
      _id?: mongoose.Types.ObjectId;
      __v?: number;
      passwordHash?: string;
      role?: Role;
      bannedAt?: unknown;
      bannedBy?: unknown;
      banReason?: unknown;
      username?: string;
      displayName?: string;
    }
  ) => {
    returnedObject.id = returnedObject._id?.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.passwordHash;
    // Los datos del baneo son solo para los admins (salen por admin.ts); en el
    // perfil público solo se indica `banned`, calculado aparte en users.ts.
    delete returnedObject.bannedAt;
    delete returnedObject.bannedBy;
    delete returnedObject.banReason;
    // El rol no sale en las respuestas públicas (así una lista de usuarios no
    // revela quiénes son admin). Solo `GET /api/login/me` lo agrega, para el
    // propio usuario.
    delete returnedObject.role;
    // Usuarios creados antes de existir displayName: se muestra el username.
    if (!returnedObject.displayName) {
      returnedObject.displayName = returnedObject.username;
    }
  },
});

const User = mongoose.model<UserData>("User", userSchema);

export default User;
