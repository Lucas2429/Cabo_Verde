import { useEffect, useId, useRef, useState } from "react";
import { DEPARTMENTS, type Department } from "../types/departments";

type Props = {
  id?: string;
  value: Department | "";
  onChange: (department: Department) => void;
};

// Selector desplegable con el mismo estilo del resto de la página: botón
// redondeado azul (#5a6c8a) con texto blanco y lista en tarjeta blanca.
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
        className="w-full flex items-center justify-between gap-2 bg-[#5a6c8a] hover:bg-[#485770] text-white font-semibold py-2.5 pl-5 pr-4 rounded-full transition-colors cursor-pointer shadow-md text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className={`truncate ${value ? "" : "text-white/70"}`}>
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
          className="absolute z-20 mt-2 w-full max-h-60 overflow-auto bg-[#b4b4b4] border-2 border-gray-800 rounded-2xl shadow-xl p-1.5 space-y-0.5"
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
                className={`px-4 py-2 rounded-full text-sm cursor-pointer transition-colors ${
                  selected
                    ? "bg-[#5a6c8a] text-white font-semibold"
                    : highlighted
                      ? "bg-[#868686] text-white"
                      : "text-gray-900"
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
