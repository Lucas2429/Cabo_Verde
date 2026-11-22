import { useEffect, useId, useRef, useState } from "react";
import { DEPARTMENTS, type Department } from "../types/departments";

type Props = {
  id?: string;
  value: Department | "";
  onChange: (department: Department) => void;
};

// Selector desplegable con el mismo estilo de los campos del resto de la
// página: botón redondeado gris claro (como el input de los comentarios) y
// lista en tarjeta blanca con acento índigo.
// Funciona con mouse y teclado (flechas, Enter/Espacio, Escape, Home/End).
function DepartmentSelect({ id, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // Cierra la lista al hacer click fuera del selector.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Mantiene visible la opción resaltada al navegar con el teclado.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    const selected = value ? DEPARTMENTS.indexOf(value) : 0;
    setActive(selected >= 0 ? selected : 0);
    setOpen(true);
  };

  const select = (department: Department) => {
    onChange(department);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(i + 1, DEPARTMENTS.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(DEPARTMENTS.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        select(DEPARTMENTS[active]);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-3 text-left text-sm text-gray-900 transition-colors hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <span className={`truncate ${value ? "" : "text-gray-400 dark:text-gray-500"}`}>
          {value || "Seleccionar"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-60 w-full space-y-0.5 overflow-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {DEPARTMENTS.map((department, index) => {
            const selected = department === value;
            const highlighted = index === active;
            return (
              <li
                key={department}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(department)}
                className={`cursor-pointer rounded-xl px-4 py-2 text-sm transition-colors ${
                  selected
                    ? "bg-indigo-600 font-semibold text-white"
                    : highlighted
                      ? "bg-indigo-50 text-indigo-700 dark:bg-gray-800 dark:text-indigo-300"
                      : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {department}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default DepartmentSelect;
