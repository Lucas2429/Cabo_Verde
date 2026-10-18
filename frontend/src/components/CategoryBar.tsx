import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import {
  DEPARTMENTS,
  DEPARTMENT_SHORT_NAMES,
  type Department,
} from "../types/departments";
import type { MemeOrder } from "../types/memesData";

interface Props {
  // Carreras seleccionadas. Vacío significa "todas".
  selected: Department[];
  onToggle: (department: Department) => void;
  order: MemeOrder;
  onToggleOrder: () => void;
}

// Barra de categorías por carrera + botón "Filtrar" (cambia el orden entre más
// nuevos primero y más antiguos primero). Cada categoría se activa o desactiva
// al tocarla y se pueden combinar varias.
function CategoryBar({ selected, onToggle, order, onToggleOrder }: Props) {
  const newestFirst = order === "newest";
  const orderLabel = newestFirst
    ? "Orden: más nuevos primero. Tocar para ver los más antiguos primero."
    : "Orden: más antiguos primero. Tocar para ver los más nuevos primero.";

  return (
    <div
      role="group"
      aria-label="Filtrar por carrera"
      className="max-w-[2000px] mx-auto flex flex-wrap items-center justify-center xl:justify-between gap-2 sm:gap-3"
    >
      {DEPARTMENTS.map((department) => {
        const active = selected.includes(department);
        return (
          <button
            key={department}
            type="button"
            // El nombre completo aparece al dejar el mouse encima.
            title={department}
            aria-pressed={active}
            onClick={() => onToggle(department)}
            className={`font-bold text-sm rounded-full px-4 py-1.5 shadow-md transition-colors cursor-pointer ${
              active
                ? "bg-[#5a6c8a] text-white"
                : "bg-[#b4b4b4] hover:bg-[#868686] text-black"
            }`}
          >
            {DEPARTMENT_SHORT_NAMES[department]}
          </button>
        );
      })}

      <button
        type="button"
        title={orderLabel}
        aria-label={orderLabel}
        onClick={onToggleOrder}
        className="flex items-center gap-1 bg-[#b4b4b4] hover:bg-[#868686] text-black font-bold italic text-lg rounded-full px-5 py-2 shadow-md transition-colors cursor-pointer"
      >
        Filtrar
        {newestFirst ? (
          <ArrowDownwardIcon fontSize="small" />
        ) : (
          <ArrowUpwardIcon fontSize="small" />
        )}
      </button>
    </div>
  );
}

export default CategoryBar;
