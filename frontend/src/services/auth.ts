import axios from "axios";
import type { Session } from "../types/auth";

const baseUrl = "/api";
const STORAGE_KEY = "cabo-verde-session";

// La sesión real vive en una cookie httpOnly que maneja el navegador. Acá solo
// se guarda el nombre y el token CSRF para recordar la sesión al recargar.
export const getStoredSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

const storeSession = (session: Session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const login = async (username: string, password: string): Promise<Session> => {
  const { data } = await axios.post<Session>(`${baseUrl}/login`, {
    username,
    password,
  });
  const session = { username: data.username, csrf: data.csrf };
  storeSession(session);
  return session;
};

const register = async (
  username: string,
  email: string,
  password: string
): Promise<Session> => {
  await axios.post(`${baseUrl}/users`, { username, email, password });
  return login(username, password);
};

const logout = async (): Promise<void> => {
  try {
    await axios.post(`${baseUrl}/login/logout`);
  } finally {
    clearSession();
  }
};

// Comprueba con el backend que la sesión guardada siga vigente (el token dura
// 1 hora). Si no, la borra.
const validate = async (session: Session): Promise<boolean> => {
  try {
    await axios.get(`${baseUrl}/login/me`, {
      headers: { "X-CSRF-Token": session.csrf },
    });
    return true;
  } catch (error) {
    // Solo se descarta la sesión si el backend la rechazó; si fue un error de
    // red, se conserva.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearSession();
      return false;
    }
    return true;
  }
};

export default { login, register, logout, validate };
