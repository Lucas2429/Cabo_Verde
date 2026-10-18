import { useState } from "react";
import { Link } from "react-router-dom";
import type { MemesData } from "../types/memesData";
import type { ReactionType } from "../types/reaction";
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import CloseIcon from '@mui/icons-material/Close';
import Comments from "./Comments";

interface MemeModalProps {
  meme: MemesData | null;
  // Reacción del usuario con sesión a este meme (null si no ha reaccionado).
  reaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  onClose: () => void;
  // Se llama si el backend responde 401 al comentar (la sesión expiró).
  onSessionExpired: () => void;
}

const MemeModal = ({
  meme,
  reaction,
  onReact,
  onClose,
  onSessionExpired,
}: MemeModalProps) => {
  if (!meme) return null;

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
            <img
              src={meme.image} 
              alt={meme.content || ""}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>
          <div className="bg-gray-950/80 backdrop-blur-md p-4 flex items-center justify-around text-white border-t border-gray-800">
            {/* Si el invitado no tiene sesión, onReact lo lleva al login. */}
            <button
              type="button"
              aria-pressed={reaction === "like"}
              onClick={() => onReact("like")}
              className={`flex items-center gap-2 hover:text-green-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer ${
                reaction === "like" ? "text-green-400" : ""
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
              className={`flex items-center gap-2 hover:text-red-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer ${
                reaction === "dislike" ? "text-red-400" : ""
              }`}
            >
              {reaction === "dislike" ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}
              <span className="text-sm font-medium">No me gusta</span>
              <span className="text-sm font-semibold tabular-nums">{meme.dislikes}</span>
            </button>
          </div>
        </div>
        <div className="w-full md:w-96 flex flex-col bg-gray-50 dark:bg-gray-900 h-1/2 md:h-full border-l border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <Link
                to={`/u/${encodeURIComponent(meme.author)}`}
                title="Ver perfil"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline"
              >
                {meme.author}
              </Link>
              <span className="text-xs text-gray-400">
                {new Date(meme.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
              {meme.content}
            </p>
          </div>

          {/* Lista y formulario de comentarios. El key reinicia el estado al
              abrir otro meme. */}
          <Comments
            key={meme.id}
            memeId={meme.id}
            onSessionExpired={onSessionExpired}
          />

        </div>

      </div>
    </div>
  );
};

export default MemeModal;
