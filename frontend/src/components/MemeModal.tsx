import type { MemesData } from "../types/memesData";
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import CloseIcon from '@mui/icons-material/Close';
import Comments from "./Comments";

interface MemeModalProps {
  meme: MemesData | null;
  onClose: () => void;
  // Se llama si el backend responde 401 al comentar (la sesión expiró).
  onSessionExpired: () => void;
}

const MemeModal = ({ meme, onClose, onSessionExpired }: MemeModalProps) => {
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
            <button className="flex items-center gap-2 hover:text-green-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer">
              <ThumbUpOffAltIcon />
              <span className="text-sm font-medium">Me gusta</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-700"></div>
            <button className="flex items-center gap-2 hover:text-red-400 transition-colors py-1.5 px-4 rounded-full hover:bg-white/10 cursor-pointer">
              <ThumbDownOffAltIcon />
              <span className="text-sm font-medium">No me gusta</span>
            </button>
          </div>
        </div>
        <div className="w-full md:w-96 flex flex-col bg-gray-50 dark:bg-gray-900 h-1/2 md:h-full border-l border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {meme.author || "Pedro"}
              </span>
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
