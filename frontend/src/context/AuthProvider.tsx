import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import authService, { getStoredSession } from "../services/auth";
import type { Session } from "../types/auth";
import type { Department } from "../types/departments";
import { AuthContext, type AuthContextValue } from "./auth";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Se restaura la sesión guardada de inmediato (sin parpadeo) y luego se
  // confirma con el backend en segundo plano.
  const [session, setSession] = useState<Session | null>(() => getStoredSession());

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
    () => ({ username: session?.username ?? null, login, register, logout }),
    [session, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
