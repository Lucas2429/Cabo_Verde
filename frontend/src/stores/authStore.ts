import { create } from "zustand";
import authService, { clearSession, getStoredSession } from "../services/auth";
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
  // true cuando el backend avisó (403, code "banned") que la cuenta fue baneada
  // mientras el usuario usaba el sitio. La sesión ya se cerró; este estado
  // muestra un aviso (BannedNotice) hasta que el usuario lo cierra. Lo activa el
  // interceptor de services/interceptors.ts.
  banned: boolean;

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
  handleBanned: () => void;
  dismissBanned: () => void;
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
  banned: false,

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

  // La cuenta fue baneada con la sesión abierta. No se llama a la API de logout
  // (fallaría igual con 403): la cookie ya la borró el backend en esa respuesta,
  // así que solo falta limpiar lo que se guarda en el navegador.
  handleBanned: () => {
    clearSession();
    set({
      session: null,
      avatar: null,
      role: null,
      sessionChecked: true,
      banned: true,
    });
    useMemeStore.getState().setMyReactions({});
  },

  dismissBanned: () => set({ banned: false }),

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
