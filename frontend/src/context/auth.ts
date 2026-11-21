import { useShallow } from "zustand/react/shallow";
import type { Role } from "../types/auth";
import type { Department } from "../types/departments";
import { useAuthStore } from "../stores/authStore";

export interface AuthContextValue {
  // Nombre del usuario con sesión, o null si es invitado.
  username: string | null;
  // Foto de perfil del usuario con sesión (URL), o null si es invitado o no
  // tiene foto.
  avatar: string | null;
  // Rol del usuario con sesión. Es null si es invitado o mientras el backend
  // todavía no lo ha confirmado (al abrir o recargar el sitio).
  role: Role | null;
  // Atajo: true solo si el backend confirmó que es admin. Sirve para mostrar u
  // ocultar opciones; la seguridad real la aplica el backend en cada ruta.
  isAdmin: boolean;
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

// Antes era un contexto de React; ahora la sesión vive en el store de Zustand
// (stores/authStore.ts). Este hook conserva la misma forma para que los
// componentes que ya lo usan no tengan que cambiar.
export const useAuth = (): AuthContextValue =>
  useAuthStore(
    useShallow((state) => ({
      username: state.session?.username ?? null,
      avatar: state.avatar,
      role: state.role,
      isAdmin: state.role === "admin",
      setAvatar: state.setAvatar,
      login: state.login,
      register: state.register,
      logout: state.logout,
    }))
  );
