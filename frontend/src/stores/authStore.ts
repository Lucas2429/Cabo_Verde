import { create } from "zustand";
import authService, { getStoredSession } from "../services/auth";
import type { Role, Session } from "../types/auth";
import type { Department } from "../types/departments";
import { useMemeStore } from "./memeStore";

// Store de la sesión del usuario. Reemplaza al antiguo AuthContext: cualquier
// componente lo lee con un selector, sin Provider de por medio.
interface AuthState {
  // Sesión guardada en el navegador (nombre y token CSRF), o null si es invitado.
  // Se restaura de inmediato desde localStorage (sin parpadeo) y luego se
  // confirma con el backend.
  session: Session | null;
  // Foto de perfil. No se guarda en el navegador: se pide al backend cada vez
  // que se inicia o restaura la sesión.
  avatar: string | null;
  // Rol. Tampoco se guarda en el navegador (si no, se podría editar a mano).
  // Queda en null hasta que el backend responde.
  role: Role | null;
  // false mientras se valida con el backend una sesión guardada. Las rutas
  // protegidas esperan a que sea true: así, al recargar (F5), un usuario con
  // sesión no es enviado al login por error.
  sessionChecked: boolean;

  setAvatar: (avatar: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    department: Department
  ) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

// Pide al backend la foto y el rol de la sesión. Si mientras tanto el usuario
// cerró sesión o entró con otra cuenta, la respuesta se descarta.
async function loadProfile(session: Session) {
  const me = await authService.fetchMe(session);
  if (useAuthStore.getState().session !== session) return;
  useAuthStore.setState({ avatar: me.avatar, role: me.role });
}

let initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: getStoredSession(),
  avatar: null,
  role: null,
  sessionChecked: getStoredSession() === null,

  setAvatar: (avatar) => set({ avatar }),

  login: async (username, password) => {
    const session = await authService.login(username, password);
    set({ session, avatar: null, role: null });
    void loadProfile(session);
  },

  register: async (username, email, password, department) => {
    const session = await authService.register(
      username,
      email,
      password,
      department
    );
    set({ session, avatar: null, role: null });
    void loadProfile(session);
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ session: null, avatar: null, role: null });
      // Las reacciones eran de este usuario: no deben verse con otra cuenta.
      useMemeStore.getState().setMyReactions({});
    }
  },

  // Se llama una vez al abrir el sitio (ver AuthProvider).
  initialize: async () => {
    if (initialized) return;
    initialized = true;

    const stored = get().session;
    if (!stored) {
      set({ sessionChecked: true });
      return;
    }

    void loadProfile(stored);
    const valid = await authService.validate(stored);
    if (!valid && get().session === stored) {
      set({ session: null, avatar: null, role: null });
    }
    set({ sessionChecked: true });
  },
}));
