import { useEffect } from "react";
import { Link } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LogoutIcon from "@mui/icons-material/Logout";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { useAuth } from "../context/auth";
import { useAdminStore, totalAlerts } from "../stores/adminStore";
import UserAvatar from "./UserAvatar";

// Cada cuánto (ms) un admin vuelve a preguntar si hay publicaciones en alerta.
const ALERT_REFRESH_MS = 60_000;

interface Props {
  // Permite a la página hacer algo extra al cerrar sesión (por ejemplo cerrar
  // un modal). Si no se pasa, solo se cierra la sesión.
  onLogout?: () => void | Promise<void>;
}

// Barra superior compartida por todas las páginas. Queda fija arriba con un
// efecto de vidrio para que el contenido pase por detrás al hacer scroll.
function Header({ onLogout }: Props) {
  const { username, avatar, isAdmin, logout } = useAuth();
  const alerts = useAdminStore((state) => state.alerts);
  const alertCount = totalAlerts(alerts);
  const refreshAlerts = useAdminStore((state) => state.refreshAlerts);
  const handleLogout = onLogout ?? logout;
  const profilePath = username ? `/u/${encodeURIComponent(username)}` : "/login";

  // Solo los admins: se pregunta al backend cuántos posts, comentarios y usuarios
  // tienen el mínimo de reportes pendientes para quedar en alerta, al abrir la
  // página y luego cada minuto, para que la alerta aparezca sin recargar.
  useEffect(() => {
    if (!isAdmin) return;
    void refreshAlerts();
    const timer = window.setInterval(() => void refreshAlerts(), ALERT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isAdmin, refreshAlerts]);

  // Texto del botón (tooltip y lector de pantalla). El umbral viene del backend.
  const alertParts = alerts
    ? [
        alerts.memes > 0 &&
          `${alerts.memes} ${alerts.memes === 1 ? "publicación" : "publicaciones"}`,
        alerts.comments > 0 &&
          `${alerts.comments} ${alerts.comments === 1 ? "comentario" : "comentarios"}`,
        alerts.users > 0 &&
          `${alerts.users} ${alerts.users === 1 ? "usuario" : "usuarios"}`,
      ].filter(Boolean)
    : [];
  const reportsLabel =
    alerts && alertCount > 0
      ? `Reportes: ${alertParts.join(", ")} con ${alerts.threshold} o más reportes pendientes`
      : "Reportes";

  return (
    <header className="sticky top-3 z-30 mx-auto grid max-w-[2000px] grid-cols-[1fr_auto] items-center gap-4 rounded-full border border-gray-300 bg-white/80 px-4 py-2.5 shadow-lg shadow-indigo-500/5 backdrop-blur-md dark:border-gray-500 dark:bg-gray-900/80 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:py-3">
      <div className="hidden md:block" />

      <h1 className="text-center font-display text-3xl leading-none tracking-wide sm:text-4xl md:text-5xl">
        <Link to="/" title="Ir al inicio" className="gradient-text">
          HIJOS DE LA (PUNTO).FOO
        </Link>
      </h1>

      <div className="flex items-center gap-2 justify-self-end sm:gap-3">
        {/* Solo los admins: lleva a la vista de reportes. Esconderlo es comodidad;
            el backend vuelve a exigir el rol en cada ruta de /api/admin. La marca
            roja es una alerta: hay posts, comentarios o usuarios con muchos
            reportes pendientes que deben revisarse. */}
        {isAdmin && (
          <Link
            to="/admin/reportes"
            title={reportsLabel}
            aria-label={reportsLabel}
            className="relative flex h-10 items-center gap-1.5 rounded-full bg-rose-100 px-3 text-2xl text-rose-600 transition-transform hover:scale-105 dark:bg-rose-500/15 dark:text-rose-300 sm:h-11"
          >
            <ReportProblemOutlinedIcon fontSize="inherit" />
            <span className="hidden text-sm font-semibold lg:inline">Reportes</span>
            {alertCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900"
              >
                {alertCount}
              </span>
            )}
          </Link>
        )}
        <Link
          to="/podio"
          title="Podio de la semana"
          aria-label="Podio de la semana"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-500 transition-transform hover:scale-110 dark:bg-amber-400/15 dark:text-amber-300 sm:h-11 sm:w-11 sm:text-3xl"
        >
          <EmojiEventsIcon fontSize="inherit" />
        </Link>

        {username ? (
          <>
            <div className="hidden flex-col items-end text-sm leading-tight sm:flex">
              <Link
                to={profilePath}
                title="Ver mi perfil"
                className="font-semibold text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
              >
                {username}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
              >
                Cerrar sesión
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="icon-btn sm:hidden"
            >
              <LogoutIcon fontSize="small" />
            </button>
            <Link
              to={profilePath}
              title="Ver mi perfil"
              aria-label="Ver mi perfil"
              className="shrink-0 transition-opacity hover:opacity-80"
            >
              <UserAvatar
                src={avatar}
                name={username}
                className="h-10 w-10 text-base ring-2 ring-indigo-500/60 sm:h-11 sm:w-11"
              />
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/login"
              data-testid="login-link"
              title="Iniciar sesión"
              aria-label="Iniciar sesión"
              className="hidden sm:inline text-sm font-medium hover:underline"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/login"
              className="text-5xl md:text-6xl leading-none hover:opacity-80 transition-opacity"
            >
              <AccountCircleIcon fontSize="inherit" />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
