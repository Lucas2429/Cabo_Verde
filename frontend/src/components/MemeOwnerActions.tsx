import { useEffect, useRef, useState } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { UNDER_REVIEW_HINT } from "../utils/reports";

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  // true si el meme tiene reportes pendientes de revisión: no se puede editar
  // ni eliminar hasta que un administrador los resuelva.
  locked?: boolean;
}

const iconButtonClass =
  "p-1 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:bg-white/10";

// Aspecto de un botón bloqueado. Se usa aria-disabled y no `disabled`: así el
// clic sigue llegando al contenedor (que lo frena) y no abre el meme.
const lockedClass = "!cursor-not-allowed opacity-40 hover:!scale-100 hover:!bg-transparent";

// Botones de un meme PROPIO: los tres puntitos (menú con "Editar") y el
// basurero rojo (eliminar). Solo se usan en el perfil del propio usuario.
// Frenan el clic para que no se abra el meme al usarlos.
const MemeOwnerActions = ({ onEdit, onDelete, locked = false }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div
      ref={containerRef}
      className="absolute top-2 right-2 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 rounded-full bg-gray-900/85 px-1.5 py-1 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
        <button
          type="button"
          title="Más opciones"
          aria-label="Más opciones"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={`${iconButtonClass} text-white`}
        >
          <MoreVertIcon fontSize="small" />
        </button>
        <button
          type="button"
          title={locked ? UNDER_REVIEW_HINT : "Eliminar publicación"}
          aria-label="Eliminar publicación"
          aria-disabled={locked}
          onClick={() => {
            if (locked) return;
            setMenuOpen(false);
            onDelete();
          }}
          className={`${iconButtonClass} text-rose-400 ${locked ? lockedClass : ""}`}
        >
          <DeleteOutlinedIcon fontSize="small" />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-36 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10"
        >
          <button
            type="button"
            role="menuitem"
            title={locked ? UNDER_REVIEW_HINT : undefined}
            aria-disabled={locked}
            onClick={() => {
              if (locked) return;
              setMenuOpen(false);
              onEdit();
            }}
            className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left font-medium text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-indigo-300 ${
              locked
                ? "!cursor-not-allowed opacity-50 hover:!bg-transparent hover:!text-gray-800 dark:hover:!text-gray-200"
                : ""
            }`}
          >
            <EditOutlinedIcon fontSize="small" />
            Editar
          </button>
        </div>
      )}
    </div>
  );
};

export default MemeOwnerActions;
