import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
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

  useEffect(() => {
    memeService
      .getAll()
      .then((data) => setMemes(data))
      .catch(() => setLoadError(true));
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

  return (
    <div className="bg-[#5a6c8a] min-h-screen py-[60px] relative">
      <div>
        <header className="mb-8 px-6">
          <div className="max-w-7xl mx-auto mb-3 flex items-center justify-end gap-3 text-sm text-white">
            {username ? (
              <>
                <span>
                  Hola, <strong>{username}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-[#dadada] hover:bg-white text-gray-800 font-semibold py-1.5 px-4 rounded-full transition-colors cursor-pointer shadow-md"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Navegando como invitado</span>
                <Link
                  to="/login"
                  className="bg-[#dadada] hover:bg-white text-gray-800 font-semibold py-1.5 px-4 rounded-full transition-colors shadow-md"
                >
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
          <div className="bg-[#dadada] text-center py-4 px-6 rounded-full max-w-7xl mx-auto shadow-md">
            <h1 className="text-xl md:text-2xl font-bold tracking-wide text-gray-800 uppercase">
              HIJOS DE LA (PUNTO).FOO
            </h1>
          </div>
        </header>

        {loadError && (
          <p className="text-center text-white mb-6">
            No se pudieron cargar los memes. ¿Está corriendo el backend?
          </p>
        )}
        {!loadError && memes.length === 0 && (
          <p className="text-center text-white/80 mb-6">
            Todavía no hay memes por aquí.
          </p>
        )}

        <main className="columns-1 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6 max-w-[95%] mx-auto px-6">
          {memes.map((meme) => (
            <div
              key={meme.id}
              className="break-inside-avoid"
              onClick={() => setSelectedMeme(meme)}
            >
              <Meme meme={meme} />
            </div>
          ))}
        </main>

        <MemeModal meme={selectedMeme} onClose={() => setSelectedMeme(null)} />

        {canUpload && modalPostear && (
          <UploadMemeModal
            onClose={() => setModalPostear(false)}
            onCreated={(meme) => setMemes((prev) => [meme, ...prev])}
            onSessionExpired={handleSessionExpired}
          />
        )}

        {/* Los invitados no ven el botón de subir; el backend además rechaza
            con 401 cualquier subida sin sesión. */}
        {canUpload && (
          <div
            className="fixed bottom-8 right-8 z-40"
            onClick={() => setModalPostear(true)}
          >
            <Fab color="primary" aria-label="add">
              <AddIcon />
            </Fab>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
