import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useAuthStore } from "../stores/authStore";

function Loading() {
  return (
    <div className="app-bg">
      <p className="m-auto text-gray-500 dark:text-gray-400">Cargando...</p>
    </div>
  );
}

// Ruta protegida: solo entra quien tiene sesión; un invitado va al login. Se
// guarda la página que pidió (`state.from`) para volver a ella tras el login.
//
// Mientras se valida con el backend una sesión guardada (al abrir o recargar
// con F5) no se decide nada: si se redirigiera de inmediato, un usuario con
// sesión terminaría en /login por error.
export function ProtectedRoute() {
  const { username } = useAuth();
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const location = useLocation();

  if (!sessionChecked) return <Loading />;
  if (username === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

// Ruta solo para administradores. Va dentro de <ProtectedRoute>, así que aquí
// ya hay sesión. El rol lo confirma el backend: mientras responde (`null`) no
// se redirige, para que un admin que recarga la página no termine en la galería.
// Esto es comodidad: la seguridad real la aplica el backend con 403.
export function AdminRoute() {
  const { role } = useAuth();

  if (role === null) return <Loading />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
