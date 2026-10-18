import { useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import Meme from "./Meme";
import type { PodiumPosition } from "../types/podium";
import type { ReactionType } from "../types/reaction";

interface Props {
  group: PodiumPosition;
  // Reacción del usuario con sesión a cada meme { idDelMeme: tipo }.
  myReactions: Record<string, ReactionType>;
  onReact: (memeId: string, type: ReactionType) => void;
  // Abre el meme completo (con comentarios) encima de esta ventana.
  onSelectMeme: (memeId: string) => void;
  onClose: () => void;
  // Escape cierra la ventana, salvo que haya un meme abierto encima (que es lo
  // que debería cerrarse primero).
  closeOnEscape: boolean;
}

const ORDINALS = ["Primer", "Segundo", "Tercer"];

// Ventana con todos los memes que empataron en un mismo puesto del podio. La
// lista tiene su propio scroll, así que funciona con cualquier cantidad de memes.
const PodiumGroupModal = ({
  group,
  myReactions,
  onReact,
  onSelectMeme,
  onClose,
  closeOnEscape,
}: Props) => {
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, onClose]);

  const ordinal = ORDINALS[group.position - 1] ?? `${group.position}.º`;
  const likesText = `${group.likes} ${group.likes === 1 ? "like" : "likes"}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="podium-group-title"
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="min-w-0">
            <h3
              id="podium-group-title"
              className="font-display text-3xl tracking-wide text-gray-900 dark:text-gray-100 leading-none"
            >
              {ordinal} lugar
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {group.memes.length} memes empatados con {likesText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="shrink-0 p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Lista con scroll propio. Mismo formato de columnas que la galería. */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-950">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
            {group.memes.map((meme) => (
              <div
                key={meme.id}
                className="mb-5 break-inside-avoid"
                onClick={() => onSelectMeme(meme.id)}
              >
                <Meme
                  meme={meme}
                  reaction={myReactions[meme.id] ?? null}
                  onReact={(type) => onReact(meme.id, type)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodiumGroupModal;
