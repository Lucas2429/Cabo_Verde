import type { MemesData } from "../types/memesData";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ReportOutlinedIcon from "@mui/icons-material/ReportOutlined";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";

interface Prop {
  meme: MemesData;
}

const actionClass =
  "p-1.5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:bg-white/10";

const Meme = ({ meme }: Prop) => (
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

    {/* Descripción: baja desde arriba al pasar el mouse. */}
    <div className="absolute top-0 inset-x-0 bg-linear-to-b from-black/75 to-transparent px-4 pt-3 pb-8 text-sm font-medium text-white -translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out pointer-events-none">
      <p className="line-clamp-2 break-words">{meme.content}</p>
    </div>

    {/* Botones: suben desde abajo al pasar el mouse. */}
    <div className="absolute bottom-3 inset-x-0 mx-auto w-fit flex items-center gap-1 rounded-full bg-gray-700/85 backdrop-blur-xs px-3 py-1.5 shadow-lg translate-y-[200%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
      <button
        type="button"
        title="Me gusta"
        aria-label="Me gusta"
        onClick={(e) => e.stopPropagation()}
        className={`${actionClass} text-cyan-300`}
      >
        <ThumbUpOffAltIcon />
      </button>
      <button
        type="button"
        title="No me gusta"
        aria-label="No me gusta"
        onClick={(e) => e.stopPropagation()}
        className={`${actionClass} text-cyan-300`}
      >
        <ThumbDownOffAltIcon />
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

export default Meme;
