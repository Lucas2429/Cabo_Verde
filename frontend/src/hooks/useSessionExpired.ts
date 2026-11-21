import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";

// Qué hacer cuando el backend responde 401 (la sesión expiró): cerrar la sesión
// y llevar al login. Lo usan los componentes pequeños que se repiten muchas
// veces en pantalla (tarjetas de memes, comentarios, modales de reporte y de
// moderación), para no pasar `onSessionExpired` por cada uno. Las páginas que ya
// tienen su propio handleSessionExpired (con limpieza extra) siguen usando ese.
export function useSessionExpired() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return async () => {
    await logout();
    navigate("/login");
  };
}
