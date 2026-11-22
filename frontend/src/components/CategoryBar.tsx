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
      className="mx-auto flex max-w-[2000px] flex-nowrap items-center justify-start gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:py-0 [&::-webkit-scrollbar]:hidden"
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
            className="chip"
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
        className="chip !border-indigo-300 !text-indigo-700 dark:!border-indigo-400/60 dark:!text-indigo-300"
      >
        Orden
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
