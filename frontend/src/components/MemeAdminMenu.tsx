import { useEffect, useRef, useState } from "react";
import axios from "axios";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CommentsDisabledOutlinedIcon from "@mui/icons-material/CommentsDisabledOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlined";
import adminService from "../services/admin";
import { useSessionExpired } from "../hooks/useSessionExpired";
import type { MemesData } from "../types/memesData";
import ModerationReasonModal from "./ModerationReasonModal";

// Cómo se entera la página de lo que hizo el admin, para actualizar su lista de
// memes sin volver a pedirla.
export interface MemeModerationHandlers {
  // El meme fue eliminado: la página debe quitarlo de su lista.
  onRemoved: (memeId: string) => void;
  // Cambió algún dato del meme (por ahora, `commentsLocked`).
  onUpdated: (memeId: string, patch: Partial<MemesData>) => void;
}

interface Props {
  meme: MemesData;
  moderation: MemeModerationHandlers;
  // "card": botón oscuro redondo para ir encima de la imagen de una tarjeta.
  // "plain": botón discreto para la cabecera del modal del meme.
  variant?: "card" | "plain";
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "No se pudo conectar con el servidor.";
    if (error.response.status === 403) {
      return "No puedes moderar contenido de otro administrador.";
    }
    if (error.response.status === 404) return "Esta publicación ya no existe.";
  }
  return "No se pudo hacer el cambio. Intenta nuevamente.";
};

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left font-medium text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-indigo-300";

// Engranaje de moderación de un meme. Solo se muestra a los admins (y reemplaza
// al botón de reportar): abre un menú para limitar o permitir los comentarios y
// para eliminar la publicación. Frena los clics para no abrir el meme.
const MemeAdminMenu = ({ meme, moderation, variant = "card" }: Props) => {
  const handleSessionExpired = useSessionExpired();

  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // El menú se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleToggleLock = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const commentsLocked = await adminService.setCommentsLocked(
        meme.id,
        !meme.commentsLocked
      );
      moderation.onUpdated(meme.id, { commentsLocked });
      setMenuOpen(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const buttonClass =
    variant === "card"
      ? "flex h-9 w-9 items-center justify-center rounded-full bg-gray-900/85 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-transform hover:scale-110"
      : "icon-btn";

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Moderar publicación"
        aria-label="Moderar publicación"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((open) => !open);
          setError(null);
        }}
        className={`${buttonClass} cursor-pointer`}
      >
        <SettingsIcon fontSize="small" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={handleToggleLock}
            className={menuItemClass}
          >
            {meme.commentsLocked ? (
              <ChatBubbleOutlineIcon fontSize="small" />
            ) : (
              <CommentsDisabledOutlinedIcon fontSize="small" />
            )}
            {meme.commentsLocked ? "Permitir comentarios" : "Limitar comentarios"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setRemoving(true);
            }}
            className={`${menuItemClass} !text-red-600 hover:!bg-red-50 dark:!text-red-400 dark:hover:!bg-red-500/10`}
          >
            <DeleteOutlinedIcon fontSize="small" />
            Eliminar publicación
          </button>
          {error && (
            <p role="alert" className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      {removing && (
        <ModerationReasonModal
          title="¿Eliminar esta publicación?"
          description="Desaparecerá de la app para todos. Queda guardada con el motivo como registro de la moderación."
          preview={
            <img
              src={meme.image}
              alt={meme.content || "Meme"}
              className="mx-auto max-h-36 max-w-full rounded-lg object-contain"
            />
          }
          onConfirm={async (reason) => {
            await adminService.removeMeme(meme.id, reason);
            moderation.onRemoved(meme.id);
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
};

export default MemeAdminMenu;
