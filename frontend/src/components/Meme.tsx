import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MemesData } from "../types/memesData";
import type { ReactionType } from "../types/reaction";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ReportOutlinedIcon from "@mui/icons-material/ReportOutlined";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import { useAuth } from "../context/auth";
import { UNDER_REVIEW_HINT } from "../utils/reports";
import MemeAdminMenu, { type MemeModerationHandlers } from "./MemeAdminMenu";
import MemeOwnerActions from "./MemeOwnerActions";
import ReportModal from "./ReportModal";

interface Prop {
  meme: MemesData;
  // Reacción del usuario con sesión a este meme (null si no ha reaccionado).
  reaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  // Solo se pasan desde el perfil del propio usuario: muestran los botones de
  // editar (⋮) y eliminar (basurero). Si faltan, el meme se ve como siempre.
  onEdit?: () => void;
  onDelete?: () => void;
  // true si este meme (propio) tiene reportes pendientes de revisión: editar y
  // eliminar quedan bloqueados hasta que un administrador los resuelva.
  underReview?: boolean;
  // Cómo la página se entera de lo que hace un admin (eliminar, limitar
  // comentarios). Los admins ven el engranaje de moderación en lugar del botón
  // de reportar.
  moderation?: MemeModerationHandlers;
}

const actionClass =
  "p-1.5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:bg-white/10";

const Meme = ({
  meme,
  reaction,
  onReact,
  onEdit,
  onDelete,
  underReview = false,
  moderation,
}: Prop) => {
  const { username, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);

  const isOwner = onEdit !== undefined && onDelete !== undefined;
  // El engranaje de admin no va si ya hay botones de dueño en la misma esquina.
  const showAdminGear = isAdmin && moderation !== undefined && !isOwner;
  const hasTopRightButtons = isOwner || showAdminGear;
  // Se reportan los memes ajenos. Los admins moderan con el engranaje.
  const canReport = !isAdmin && username !== meme.author;

  // Un invitado que toca "reportar" va al login (como con los likes).
  const handleReportClick = () => {
    if (username === null) {
      navigate("/login");
      return;
    }
    setReporting(true);
  };

  return (
    <div className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gray-200 shadow-sm ring-1 ring-black/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/20 dark:bg-gray-800 dark:ring-white/25">
      <img
        src={meme.image}
        alt={meme.content || "Meme"}
        // Altura máxima en la galería: las imágenes muy largas se recortan
        // (mostrando la parte de arriba, donde suele ir el texto del meme).
        // Al abrir el meme, el modal la muestra completa.
        className="w-full h-auto max-h-[800px] object-cover object-top block"
        decoding="async"
      />

      {/* Borde de hover: va por encima de la imagen para que se vea igual en
          cualquier meme (claro, oscuro o con bordes blancos). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-2 ring-inset ring-indigo-500 transition-opacity duration-300 group-hover:opacity-100"
      />

      {onEdit && onDelete && (
        <MemeOwnerActions
          onEdit={onEdit}
          onDelete={onDelete}
          locked={underReview}
        />
      )}

      {/* Aviso al dueño: visible siempre (no solo con hover) para que en el celular
          también se entienda por qué no puede editar ni eliminar. */}
      {isOwner && underReview && (
        <span
          title={UNDER_REVIEW_HINT}
          className="absolute left-2 top-2 z-10 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg"
        >
          En revisión
        </span>
      )}

      {/* Engranaje de moderación: siempre visible para los admins. */}
      {showAdminGear && moderation && (
        <div className="absolute top-2 right-2 z-10">
          <MemeAdminMenu meme={meme} moderation={moderation} />
        </div>
      )}

      {/* Descripción: baja desde arriba al pasar el mouse. Si hay botones arriba
          a la derecha (dueño o admin), se deja espacio para que no los tape. */}
      <div
        className={`absolute top-0 inset-x-0 bg-linear-to-b from-black/75 to-transparent pl-4 pt-3 pb-8 text-sm font-medium text-white -translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out pointer-events-none ${
          hasTopRightButtons ? "pr-24" : "pr-4"
        }`}
      >
        <p className="line-clamp-2 break-words">{meme.content}</p>
      </div>

      {/* Botones: suben desde abajo al pasar el mouse. */}
      <div className="absolute bottom-3 inset-x-0 mx-auto flex w-fit translate-y-[200%] items-center gap-1 rounded-full bg-gray-900/85 px-3 py-1.5 shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-transform duration-300 ease-in-out group-hover:translate-y-0">
        {/* Si el invitado no tiene sesión, onReact lo lleva al login. */}
        <button
          type="button"
          title="Me gusta"
          aria-label="Me gusta"
          aria-pressed={reaction === "like"}
          onClick={(e) => {
            e.stopPropagation();
            onReact("like");
          }}
          className={`${actionClass} gap-1 px-2.5 ${
            reaction === "like" ? "text-emerald-400" : "text-indigo-300"
          }`}
        >
          {reaction === "like" ? <ThumbUpAltIcon /> : <ThumbUpOffAltIcon />}
          <span className="text-xs font-semibold tabular-nums">{meme.likes}</span>
        </button>
        <button
          type="button"
          title="No me gusta"
          aria-label="No me gusta"
          aria-pressed={reaction === "dislike"}
          onClick={(e) => {
            e.stopPropagation();
            onReact("dislike");
          }}
          className={`${actionClass} gap-1 px-2.5 ${
            reaction === "dislike" ? "text-rose-400" : "text-indigo-300"
          }`}
        >
          {reaction === "dislike" ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}
          <span className="text-xs font-semibold tabular-nums">{meme.dislikes}</span>
        </button>
        {canReport && (
          <button
            type="button"
            title="Reportar"
            aria-label="Reportar"
            onClick={(e) => {
              e.stopPropagation();
              handleReportClick();
            }}
            className={`${actionClass} text-rose-400`}
          >
            <ReportOutlinedIcon />
          </button>
        )}
        {/* Este no frena el clic: abre el meme, donde están los comentarios. */}
        <button
          type="button"
          title="Comentarios"
          aria-label="Comentarios"
          className={`${actionClass} text-indigo-300`}
        >
          <ChatBubbleOutlinedIcon />
        </button>
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

export default Meme;
