import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "../stores/authStore";

// Ya no guarda el estado (eso lo hace el store de Zustand): solo arranca la
// restauración de la sesión una vez, al abrir o recargar el sitio.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <>{children}</>;
};
