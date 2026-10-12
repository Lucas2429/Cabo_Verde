import type { MemesData } from "../types/memesData";
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';

interface Prop {
  meme: MemesData;
}

const Meme = ({ meme }: Prop) => (
  <div className="group bg-[#dadada] rounded-[28px] p-3 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 w-full flex flex-col">
    
    <h3 className="pt-2 px-2 pb-1 text-sm text-gray-800 font-medium break-words leading-snug">
      {meme.content}
    </h3>

    <div className="relative overflow-hidden rounded-[20px] bg-gray-300 w-full">
      <img
        src={meme.image}
        alt={meme.content || "Meme"}
        // Altura máxima en la galería: las imágenes muy largas se recortan
        // (mostrando la parte de arriba, donde suele ir el texto del meme).
        // Al abrir el meme, el modal la muestra completa.
        className="w-full h-auto max-h-[800px] object-cover object-top block"
        decoding="async"
      />

      <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-2 text-white flex items-center justify-around translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
        <button
          onClick={(e) => e.stopPropagation()}
          className="hover:text-green-400 transition-colors p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
        >
          <ThumbUpOffAltIcon />
        </button>
        <button
          onClick={(e) => e.stopPropagation()} 
          className="hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
        >
          <ThumbDownOffAltIcon />
        </button>
      </div>
    </div>

  </div>
);

export default Meme;