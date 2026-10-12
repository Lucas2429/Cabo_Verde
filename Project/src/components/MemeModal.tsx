import { useState } from "react";
import type { MemesData } from "../types/post";
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

interface MemeModalProps {
  meme: MemesData | null;
  onClose: () => void;
}

// Comentarios de prueba visuales
const MOCK_COMMENTS = [
  { id: 1, author: "Juan", text: "Jajaja excelente meme 10/10", time: "Hace 5m" },
  { id: 2, author: "María", text: "Muy real, me pasó ayer.", time: "Hace 12m" },
  { id: 3, author: "Carlos", text: "No entendí pero le doy like.", time: "Hace 1h" },
];

const MemeModal = ({ meme, onClose }: MemeModalProps) => {
  const [commentText, setCommentText] = useState("");

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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Comentarios
            </h4>

            {MOCK_COMMENTS.map((comment) => (
              <div key={comment.id} className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {comment.author[0]}
                </div>
                <div className="flex-1 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                      {comment.author}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {comment.time}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-xs">
                    {comment.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <form 
              onSubmit={(e) => e.preventDefault()} 
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Escribe un comentario..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-2.5 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <SendIcon fontSize="small" />
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MemeModal;