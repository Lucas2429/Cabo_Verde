import { Link } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { useAuth } from "../context/auth";

interface Props {
  // Permite a la página hacer algo extra al cerrar sesión (por ejemplo cerrar
  // un modal). Si no se pasa, solo se cierra la sesión.
  onLogout?: () => void | Promise<void>;
}

// Barra superior compartida por todas las páginas.
function Header({ onLogout }: Props) {
  const { username, avatar, logout } = useAuth();
  const handleLogout = onLogout ?? logout;
  const profilePath = username ? `/u/${encodeURIComponent(username)}` : "/login";

  return (
    <header className="max-w-[2000px] mx-auto bg-[#b4b4b4] rounded-full shadow-md px-5 sm:px-8 py-3 md:py-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="hidden md:block" />

      <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-black text-center leading-none">
        <Link to="/" title="Ir al inicio">
          HIJOS DE LA (PUNTO).FOO
        </Link>
      </h1>

      <div className="justify-self-end flex items-center gap-3 text-black">
        <span
          title="Ranking (próximamente)"
          className="hidden sm:block text-5xl leading-none text-amber-400 drop-shadow"
        >
          <EmojiEventsIcon fontSize="inherit" />
        </span>

        {username ? (
          <>
            <div className="flex flex-col items-end leading-tight text-sm">
              <Link
                to={profilePath}
                title="Ver mi perfil"
                className="font-semibold hover:underline"
              >
                {username}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs underline hover:no-underline cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
            <Link
              to={profilePath}
              title="Ver mi perfil"
              aria-label="Ver mi perfil"
              className="text-5xl md:text-6xl leading-none hover:opacity-80 transition-opacity"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="w-12 h-12 md:w-15 md:h-15 rounded-full border-2 border-black object-cover bg-[#5a6c8a]"
                />
              ) : (
                <AccountCircleIcon fontSize="inherit" />
              )}
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="hidden sm:inline text-sm font-medium hover:underline"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/login"
              title="Iniciar sesión"
              aria-label="Iniciar sesión"
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
