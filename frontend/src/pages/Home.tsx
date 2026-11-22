import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import Header from "../components/Header";
import CategoryBar from "../components/CategoryBar";
import TagFilter from "../components/TagFilter";
import Meme from "../components/Meme";
import MemeModal from "../components/MemeModal";
import type { MemeModerationHandlers } from "../components/MemeAdminMenu";
import UploadMemeModal from "../components/UploadMemeModal";
import { useReactions } from "../hooks/useReactions";
import { useAuth } from "../context/auth";
import { useMemeStore } from "../stores/memeStore";

// Alturas de las tarjetas "fantasma" que se ven mientras cargan los memes.
const SKELETON_HEIGHTS = [
  "h-64",
  "h-96",
  "h-48",
  "h-80",
  "h-72",
  "h-56",
  "h-96",
  "h-64",
];

function Home() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  // La lista de memes, las carreras elegidas y el orden viven en el store de
  // Zustand (stores/memeStore.ts), no en esta página: así se conservan al ir a
  // otra vista y volver con el botón "atrás".
  const { memes, loading, loadError, selectedDepartments, selectedTags, order } = useMemeStore(
    useShallow((state) => ({
      memes: state.memes,
      loading: state.loading,
      loadError: state.loadError,
      selectedDepartments: state.selectedDepartments,
      selectedTags: state.selectedTags,
      order: state.order,
    }))
  );
  const fetchMemes = useMemeStore((state) => state.fetchMemes);
  const toggleDepartment = useMemeStore((state) => state.toggleDepartment);
  const toggleTag = useMemeStore((state) => state.toggleTag);
  const clearTags = useMemeStore((state) => state.clearTags);
  const clearFilters = useMemeStore((state) => state.clearFilters);
  const hasFilters = selectedDepartments.length > 0 || selectedTags.length > 0;
  const toggleOrder = useMemeStore((state) => state.toggleOrder);
  const updateCounts = useMemeStore((state) => state.updateCounts);
  const patchMeme = useMemeStore((state) => state.patchMeme);
  const removeMeme = useMemeStore((state) => state.removeMeme);

  // Estado propio de esta página (solo lo usa ella): sigue en useState.
  const [modalPostear, setModalPostear] = useState<boolean>(false);
  // Se guarda solo el id (y no una copia del meme) para que el modal siempre
  // muestre los likes y dislikes actualizados de la lista.
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  // La barra fija de arriba (header + filtros) gana fondo al bajar.
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  const selectedMeme = memes.find((meme) => meme.id === selectedMemeId) ?? null;

  // Se pide la lista al abrir la página y cada vez que cambia el filtro o el
  // orden. El store descarta las respuestas viejas si llegan fuera de orden.
  useEffect(() => {
    void fetchMemes();
  }, [fetchMemes, selectedDepartments, selectedTags, order]);

  // El botón de "subir al inicio" aparece solo cuando ya se bajó un poco.
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Solo los usuarios con sesión pueden subir memes; los invitados solo ven.
  const canUpload = username !== null;

  // Con pocos memes las columnas no se estiran: se limita el ancho a lo que
  // ocupan (columnas de 18rem + espacio de 1.25rem) y la galería queda
  // centrada en vez de pegada a la izquierda con un hueco a la derecha.
  const galleryStyle =
    memes.length > 0
      ? {
        maxWidth: `calc(${memes.length} * 18rem + ${memes.length - 1} * 1.25rem)`,
      }
      : undefined;

  const handleLogout = async () => {
    setModalPostear(false);
    await logout();
  };

  const handleSessionExpired = async () => {
    setModalPostear(false);
    setSelectedMemeId(null);
    await logout();
    navigate("/login");
  };

  // Like / dislike (lógica compartida con el perfil y el podio). Aquí solo se
  // indica cómo actualizar los totales dentro de la lista de memes.
  const { myReactions, handleReact } = useReactions({
    onCountsChange: updateCounts,
    onSessionExpired: handleSessionExpired,
  });

  // Lo que hace un admin desde el engranaje (eliminar un meme o limitar sus
  // comentarios) se refleja en la lista sin volver a pedirla.
  const moderation: MemeModerationHandlers = {
    onRemoved: removeMeme,
    onUpdated: patchMeme,
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
    <div className="app-bg">
      <div className="flex-1 px-3 pb-8 pt-3 sm:px-6 md:px-12 md:pt-7">
        {/* Header y filtros quedan fijos arriba al hacer scroll; al bajar ganan
            un fondo de vidrio para que los memes no se mezclen con ellos. */}
        <div
          className={`sticky top-0 z-30 -mx-3 border-b px-3 pb-3 pt-3 transition-colors duration-300 sm:-mx-6 sm:px-6 md:-mx-12 md:px-12 ${isScrolled
            ? "border-gray-300 bg-gray-50/85 backdrop-blur-md dark:border-gray-700 dark:bg-gray-950/85"
            : "border-transparent"
            }`}
        >
          <Header onLogout={handleLogout} />

          <div className="mt-3 space-y-2">
            <CategoryBar
              selected={selectedDepartments}
              onToggle={toggleDepartment}
              order={order}
              onToggleOrder={toggleOrder}
            />
            <TagFilter
              selected={selectedTags}
              onToggle={toggleTag}
              onClear={clearTags}
            />
          </div>
        </div>

        <main className="mx-auto mt-4 min-h-64 max-w-[2000px] md:mt-6">
          {loadError && (
            <p className="surface mx-auto max-w-xl p-6 text-center text-gray-500 dark:text-gray-400">
              No se pudieron cargar los memes. ¿Está corriendo el backend?
            </p>
          )}
          {!loadError && !loading && memes.length === 0 && (
            <div className="surface mx-auto max-w-xl p-6 text-center text-gray-500 dark:text-gray-400">
              <p>
                {hasFilters
                  ? "No hay memes que cumplan todos los filtros elegidos."
                  : "Todavía no hay memes por aquí."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-secondary mt-4"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {/* Columnas de ~18rem: el número de columnas se adapta solo al ancho
              de la pantalla (1 en celular, 4 en un notebook, 6+ en ultrawide). */}
          {/* Esqueleto mientras llegan los primeros memes. */}
          {loading && !loadError && (
            <div className="columns-2xs gap-5" role="status" aria-busy="true">
              <span className="sr-only">Cargando memes...</span>
              {SKELETON_HEIGHTS.map((height, index) => (
                <div
                  key={index}
                  className={`mb-5 animate-pulse break-inside-avoid rounded-2xl bg-gray-200 dark:bg-gray-800 ${height}`}
                />
              ))}
            </div>
          )}

          <div className="mx-auto columns-2xs gap-5" style={galleryStyle}>
            {memes.map((meme) => (
              <div
                key={meme.id}
                className="mb-5 break-inside-avoid"
                onClick={() => setSelectedMemeId(meme.id)}
              >
                <Meme
                  meme={meme}
                  reaction={myReactions[meme.id] ?? null}
                  onReact={(type) => handleReact(meme.id, type)}
                  moderation={moderation}
                />
              </div>
            ))}
          </div>
        </main>

        <MemeModal
          meme={selectedMeme}
          reaction={selectedMeme ? myReactions[selectedMeme.id] ?? null : null}
          onReact={(type) => {
            if (selectedMeme) handleReact(selectedMeme.id, type);
          }}
          onClose={() => setSelectedMemeId(null)}
          onSessionExpired={handleSessionExpired}
          moderation={moderation}
        />

        {canUpload && modalPostear && (
          <UploadMemeModal
            onClose={() => setModalPostear(false)}
            onCreated={() => void fetchMemes()}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </div>

      <footer className="px-4 pb-5 pt-2 text-center text-xs text-gray-500 dark:text-gray-500 sm:text-sm">
        v0.0.1 · © 2026 Cabo Verde · Todos los derechos reservados
      </footer>

      <div className="fixed bottom-6 right-4 sm:right-8 z-40 flex flex-col items-center gap-4">
        {showScrollTop && (
          <button
            type="button"
            title="Subir al inicio"
            aria-label="Subir al inicio"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white/90 text-3xl text-indigo-600 shadow-lg backdrop-blur-md transition-transform hover:scale-105 dark:border-gray-700 dark:bg-gray-900/90 dark:text-indigo-300"
          >
            <ArrowUpwardIcon fontSize="inherit" />
          </button>
        )}

        {/* Los invitados también ven el botón, pero los lleva al login; el
            backend además rechaza con 401 cualquier subida sin sesión. */}
        <button
          data-testid="addIcon"
          type="button"
          title={canUpload ? "Subir meme" : "Inicia sesión para subir memes"}
          aria-label="Subir meme"
          onClick={handleAddClick}
          className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-5xl text-white shadow-xl shadow-indigo-600/40 transition-transform hover:scale-105 md:h-20 md:w-20 md:text-6xl"
        >
          <AddIcon fontSize="inherit" />
        </button>
      </div>
    </div>
  );
}

export default Home;
