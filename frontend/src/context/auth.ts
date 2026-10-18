import { createContext, useContext } from "react";
import type { Department } from "../types/departments";

export interface AuthContextValue {
  // Nombre del usuario con sesión, o null si es invitado.
  username: string | null;
  // Foto de perfil del usuario con sesión (URL), o null si es invitado o no
  // tiene foto.
  avatar: string | null;
  // Actualiza la foto que ve el resto de la app (p. ej. el banner) cuando el
  // usuario la cambia desde su perfil.
  setAvatar: (avatar: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    department: Department
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
