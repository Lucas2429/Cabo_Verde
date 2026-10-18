import type { MemesData } from "../types/memesData";
import type { ReactionType } from "../types/reaction";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ReportOutlinedIcon from "@mui/icons-material/ReportOutlined";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import MemeOwnerActions from "./MemeOwnerActions";

interface Prop {
  meme: MemesData;
  // Reacción del usuario con sesión a este meme (null si no ha reaccionado).
  reaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  // Solo se pasan desde el perfil del propio usuario: muestran los botones de
  // editar (⋮) y eliminar (basurero). Si faltan, el meme se ve como siempre.
  onEdit?: () => void;
  onDelete?: () => void;
}

const actionClass =
  "p-1.5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:bg-white/10";

const Meme = ({ meme, reaction, onReact, onEdit, onDelete }: Prop) => {
  const isOwner = onEdit !== undefined && onDelete !== undefined;

  return (
    <div className="group relative overflow-hidden rounded-[22px] bg-gray-300 shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer">
      <img
        src={meme.image}
        alt={meme.content || "Meme"}
        // Altura máxima en la galería: las imágenes muy largas se recortan
        // (mostrando la parte de arriba, donde suele ir el texto del meme).
        // Al abrir el meme, el modal la muestra completa.
        className="w-full h-auto max-h-[800px] object-cover object-top block"
        decoding="async"
      />

      {onEdit && onDelete && (
        <MemeOwnerActions onEdit={onEdit} onDelete={onDelete} />
      )}

      {/* Descripción: baja desde arriba al pasar el mouse. Si hay botones de
          dueño arriba a la derecha, se deja espacio para que no los tape. */}
      <div
        className={`absolute top-0 inset-x-0 bg-linear-to-b from-black/75 to-transparent pl-4 pt-3 pb-8 text-sm font-medium text-white -translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out pointer-events-none ${
          isOwner ? "pr-24" : "pr-4"
        }`}
      >
        <p className="line-clamp-2 break-words">{meme.content}</p>
      </div>

      {/* Botones: suben desde abajo al pasar el mouse. */}
      <div className="absolute bottom-3 inset-x-0 mx-auto w-fit flex items-center gap-1 rounded-full bg-gray-700/85 backdrop-blur-xs px-3 py-1.5 shadow-lg translate-y-[200%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
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
            reaction === "like" ? "text-green-400" : "text-cyan-300"
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
            reaction === "dislike" ? "text-red-400" : "text-cyan-300"
          }`}
        >
          {reaction === "dislike" ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}
          <span className="text-xs font-semibold tabular-nums">{meme.dislikes}</span>
        </button>
        <button
          type="button"
          title="Reportar"
          aria-label="Reportar"
          onClick={(e) => e.stopPropagation()}
          className={`${actionClass} text-red-500`}
        >
          <ReportOutlinedIcon />
        </button>
        {/* Este no frena el clic: abre el meme, donde están los comentarios. */}
        <button
          type="button"
          title="Comentarios"
          aria-label="Comentarios"
          className={`${actionClass} text-cyan-300`}
        >
          <ChatBubbleOutlinedIcon />
        </button>
      </div>
    </div>
  );
};

export default Meme;
