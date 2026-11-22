//import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { MemesData } from "../types/memesData";
import type { ReactionType } from "../types/reaction";
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from "../context/auth";
import Comments from "./Comments";
import MemeAdminMenu, { type MemeModerationHandlers } from "./MemeAdminMenu";
import ReportModal from "./ReportModal";
import { useMemeStore } from "../stores/memeStore";
import { DEPARTMENT_SHORT_NAMES, type Department } from "../types/departments";

interface MemeModalProps {
  meme: MemesData | null;
  // Reacción del usuario con sesión a este meme (null si no ha reaccionado).
  reaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  onClose: () => void;
  // Se llama si el backend responde 401 al comentar (la sesión expiró).
  onSessionExpired: () => void;
  // Cómo la página se entera de lo que hace un admin (eliminar, limitar
  // comentarios). Los admins ven el engranaje de moderación en lugar del botón
  // de reportar.
  moderation?: MemeModerationHandlers;
}

const MemeModal = ({
  meme,
  reaction,
  onReact,
  onClose,
  onSessionExpired,
  moderation,
}: MemeModalProps) => {
  const { username, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);

  const showOnlyTag = useMemeStore((state) => state.showOnlyTag);
  const showOnlyDepartment = useMemeStore((state) => state.showOnlyDepartment);

  if (!meme) return null;

  // Se reportan los memes ajenos. Los admins moderan con el engranaje.
  const canReport = !isAdmin && username !== meme.author;

  // Los memes viejos pueden no traer estos campos.
  const memeDepartments = meme.departments ?? [];
  const memeTags = meme.tags ?? [];

  // Tocar una etiqueta cierra el modal y muestra la galería filtrada por ella.
  // Desde el perfil o el podio, navigate("/") lleva a la galería.
  const handleTagClick = (tag: string) => {
    showOnlyTag(tag);
    onClose();
    navigate("/");
  };
  const handleDepartmentClick = (department: (typeof memeDepartments)[number]) => {
    showOnlyDepartment(department as Department);
    onClose();
    navigate("/");
  };

  // Un invitado que toca "reportar" va al login (como con los likes).
  const handleReportClick = () => {
    if (username === null) {
      navigate("/login");
      return;
    }
    setReporting(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white bg-black/50 hover:bg-black/80 p-2 rounded-full transition-colors cursor-pointer"
      >
        <CloseIcon />
      </button>
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-7xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 bg-black flex flex-col justify-between relative overflow-hidden h-1/2 md:h-full">
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {/* La descripción va arriba de la imagen, pegada a ella, como el texto
                de un meme. `w-0 min-w-full` hace que el texto tome el ancho de la
                imagen (y no la ensanche) y se ajuste en varias líneas. */}
            <figure className="m-0 flex max-h-full min-h-0 max-w-full flex-col items-center overflow-hidden rounded-xl bg-white shadow-lg">
              {meme.content && (
                <figcaption className="w-0 min-w-full whitespace-pre-wrap break-words px-4 py-3 text-left text-base font-medium text-gray-900">
                  {meme.content}
                </figcaption>
              )}
              <img
                src={meme.image}
                alt={meme.content || ""}
                className="min-h-0 max-w-full object-contain"
              />
            </figure>
          </div>
          <div className="bg-gray-950/80 backdrop-blur-md p-4 flex items-center justify-around text-white border-t border-gray-800">
            {/* Si el invitado no tiene sesión, onReact lo lleva al login. */}
            <button
              type="button"
              aria-pressed={reaction === "like"}
              onClick={() => onReact("like")}
              className={`flex items-center gap-2 hover:text-green-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer ${reaction === "like" ? "text-green-400" : ""
                }`}
            >
              {reaction === "like" ? <ThumbUpAltIcon /> : <ThumbUpOffAltIcon />}
              <span className="text-sm font-medium">Me gusta</span>
              <span className="text-sm font-semibold tabular-nums">{meme.likes}</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-700"></div>
            <button
              type="button"
              aria-pressed={reaction === "dislike"}
              onClick={() => onReact("dislike")}
              className={`flex items-center gap-2 hover:text-red-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer ${reaction === "dislike" ? "text-red-400" : ""
                }`}
            >
              {reaction === "dislike" ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}
              <span className="text-sm font-medium">No me gusta</span>
              <span className="text-sm font-semibold tabular-nums">{meme.dislikes}</span>
            </button>
            {canReport && (
              <>
                <div className="h-6 w-[1px] bg-gray-700"></div>
                <button
                  type="button"
                  title="Reportar publicación"
                  onClick={handleReportClick}
                  className="flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer"
                >
                  <ReportOutlinedIcon />
                  <span className="text-sm font-medium">Reportar</span>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="w-full md:w-96 flex flex-col bg-gray-50 dark:bg-gray-900 h-1/2 md:h-full border-l border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <Link
                to={`/u/${encodeURIComponent(meme.author)}`}
                title="Ver perfil"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline"
              >
                {meme.author}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(meme.createdAt).toLocaleDateString()}
                </span>
                {/* Engranaje de moderación: solo para admins. */}
                {isAdmin && moderation && (
                  <MemeAdminMenu meme={meme} moderation={moderation} variant="plain" />
                )}
              </div>
            </div>

            {/* carreras y hashtags del meme (solo si tiene alguno). */}
            {(memeDepartments.length > 0 || memeTags.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                {memeDepartments.map((department) => (
                  <button
                    key={department}
                    type="button"
                    title={`Ver memes de ${department}`}
                    onClick={() => handleDepartmentClick(department)}
                    className="cursor-pointer rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                  >
                    {DEPARTMENT_SHORT_NAMES[department as Department] ?? department}
                  </button>
                ))}
                {memeTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    title={`Ver memes con #${tag}`}
                    onClick={() => handleTagClick(tag)}
                    className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista y formulario de comentarios. El key reinicia el estado al
              abrir otro meme. */}
          <Comments
            key={meme.id}
            memeId={meme.id}
            locked={meme.commentsLocked}
            onSessionExpired={onSessionExpired}
          />

        </div>

      </div>

      {reporting && (
        <ReportModal
          target="meme"
          memeId={meme.id}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
};

export default MemeModal;
