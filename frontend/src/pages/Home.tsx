import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Meme from "../components/Meme";
import MemeModal from "../components/MemeModal";
import UploadMemeModal from "../components/UploadMemeModal";
import type { MemesData } from "../types/memesData";
import memeService from "../services/meme";
import { useAuth } from "../context/auth";

function Home() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  const [memes, setMemes] = useState<MemesData[]>([]);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [modalPostear, setModalPostear] = useState<boolean>(false);
  const [selectedMeme, setSelectedMeme] = useState<MemesData | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    memeService
      .getAll()
      .then((data) => setMemes(data))
      .catch(() => setLoadError(true));
  }, []);

  // El botón de "subir al inicio" aparece solo cuando ya se bajó un poco.
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Solo los usuarios con sesión pueden subir memes; los invitados solo ven.
  const canUpload = username !== null;

  const handleLogout = async () => {
    setModalPostear(false);
    await logout();
  };

  const handleSessionExpired = async () => {
    setModalPostear(false);
    await logout();
    navigate("/login");
  };

  // Un invitado que toca "+" va al login en vez de ver el formulario.
  const handleAddClick = () => {
    if (canUpload) {
      setModalPostear(true);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#52648a] flex flex-col">
      <div className="flex-1 px-3 sm:px-6 md:px-12 pt-6 md:pt-10 pb-8">
        <header className="max-w-[2000px] mx-auto bg-[#b4b4b4] rounded-full shadow-md px-5 sm:px-8 py-3 md:py-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="hidden md:block" />

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-black text-center leading-none">
            HIJOS DE LA (PUNTO).FOO
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
                  <span className="font-semibold">{username}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs underline hover:no-underline cursor-pointer"
                  >
                    Cerrar sesión
                  </button>
                </div>
                <span
                  title={username}
                  className="text-5xl md:text-6xl leading-none"
                >
                  <AccountCircleIcon fontSize="inherit" />
                </span>
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

        <main className="max-w-[2000px] mx-auto mt-6 md:mt-8 bg-white rounded-[30px] md:rounded-[50px] border-[6px] border-[#b4b4b4] p-4 sm:p-6 md:p-10 min-h-64">
          {loadError && (
            <p className="text-center text-gray-500">
              No se pudieron cargar los memes. ¿Está corriendo el backend?
            </p>
          )}
          {!loadError && memes.length === 0 && (
            <p className="text-center text-gray-500">
              Todavía no hay memes por aquí.
            </p>
          )}

          {/* Columnas de ~18rem: el número de columnas se adapta solo al ancho
              de la pantalla (1 en celular, 4 en un notebook, 6+ en ultrawide). */}
          <div className="columns-2xs gap-5">
            {memes.map((meme) => (
              <div
                key={meme.id}
                className="mb-5 break-inside-avoid"
                onClick={() => setSelectedMeme(meme)}
              >
                <Meme meme={meme} />
              </div>
            ))}
          </div>
        </main>

        <MemeModal meme={selectedMeme} onClose={() => setSelectedMeme(null)} />

        {canUpload && modalPostear && (
          <UploadMemeModal
            onClose={() => setModalPostear(false)}
            onCreated={(meme) => setMemes((prev) => [meme, ...prev])}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </div>

      <footer className="px-4 pb-3 text-xs sm:text-sm font-bold text-white">
        v0.0.1 · © 2026 Cabo Verde · Todos los derechos reservados
      </footer>

      <div className="fixed bottom-6 right-4 sm:right-8 z-40 flex flex-col items-center gap-4">
        {showScrollTop && (
          <button
            type="button"
            title="Subir al inicio"
            aria-label="Subir al inicio"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-12 h-12 rounded-full bg-linear-to-tr from-pink-500 to-orange-300 text-black text-3xl shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          >
            <ArrowUpwardIcon fontSize="inherit" />
          </button>
        )}

        {/* Los invitados también ven el botón, pero los lleva al login; el
            backend además rechaza con 401 cualquier subida sin sesión. */}
        <button
          type="button"
          title={canUpload ? "Subir meme" : "Inicia sesión para subir memes"}
          aria-label="Subir meme"
          onClick={handleAddClick}
          className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#ff4d4d] hover:bg-[#f03a3a] text-black text-5xl md:text-6xl shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        >
          <AddIcon fontSize="inherit" />
        </button>
      </div>
    </div>
  );
}

export default Home;
