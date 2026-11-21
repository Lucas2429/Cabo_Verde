import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import authService, { getStoredSession } from "../services/auth";
import type { Role, Session } from "../types/auth";
import type { Department } from "../types/departments";
import { AuthContext, type AuthContextValue } from "./auth";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Se restaura la sesión guardada de inmediato (sin parpadeo) y luego se
  // confirma con el backend en segundo plano.
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  // Foto de perfil del usuario con sesión. No se guarda en el navegador: se
  // pide al backend cada vez que se inicia o restaura la sesión.
  const [avatar, setAvatar] = useState<string | null>(null);
  // Rol del usuario con sesión. Tampoco se guarda en el navegador (si no, se
  // podría editar a mano): se pide al backend junto con la foto. Queda en null
  // hasta que responde.
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!session) {
      setAvatar(null);
      setRole(null);
      return;
    }

    let cancelled = false;
    authService.fetchMe(session).then((me) => {
      if (cancelled) return;
      setAvatar(me.avatar);
      setRole(me.role);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) return;

    let cancelled = false;
    authService.validate(stored).then((valid) => {
      if (!cancelled && !valid) setSession(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setSession(await authService.login(username, password));
  }, []);

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      department: Department
    ) => {
      setSession(await authService.register(username, email, password, department));
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      username: session?.username ?? null,
      avatar,
      role,
      isAdmin: role === "admin",
      setAvatar,
      login,
      register,
      logout,
    }),
    [session, avatar, role, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
