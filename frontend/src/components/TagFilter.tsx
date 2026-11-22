import { useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import memeService from "../services/meme";
import type { TagCount } from "../types/tag";
import { MAX_TAG_LENGTH } from "../utils/tags";

interface Props {
  // Hashtags seleccionados (sin "#"). Vacío significa "sin filtro".
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

// Botón "# Hashtags" que abre un panel con los hashtags que ya existen (los más
// usados primero) y un buscador. Los elegidos quedan como chips al lado del
// botón y se quitan tocándolos. Con varios, el meme debe tener TODOS.
function TagFilter({ selected, onToggle, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Al abrir el panel (y al escribir en el buscador) se piden los hashtags al
  // backend. Al escribir se espera 250 ms para no pedir en cada tecla, y las
  // respuestas viejas se descartan (cancelled).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const tags = await memeService.getTags(query);
          if (!cancelled) {
            setOptions(tags);
            setFailed(false);
          }
        } catch {
          if (!cancelled) setFailed(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      query === "" ? 0 : 250
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  // El panel se cierra al tocar fuera de él o con Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-wrap items-center justify-center gap-2"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="chip !border-indigo-300 !text-indigo-700 dark:!border-indigo-400/60 dark:!text-indigo-300"
      >
        # Hashtags{selected.length > 0 && ` (${selected.length})`}
      </button>

      {selected.map((tag) => (
        <button
          key={tag}
          type="button"
          aria-pressed={true}
          title={`Quitar #${tag}`}
          onClick={() => onToggle(tag)}
          className="chip"
        >
          #{tag}
          <CloseIcon fontSize="inherit" />
        </button>
      ))}

      {selected.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
        >
          Limpiar hashtags
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Elegir hashtags"
          className="surface absolute left-1/2 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 p-3 shadow-xl"
        >
          <input
            type="text"
            value={query}
            maxLength={MAX_TAG_LENGTH + 1}
            placeholder="Buscar hashtag..."
            aria-label="Buscar hashtag"
            autoFocus
            onChange={(event) => setQuery(event.target.value.replace(/^#+/, ""))}
            className="field"
          />

          <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto">
            {options.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                aria-pressed={selected.includes(tag)}
                onClick={() => onToggle(tag)}
                className="chip"
              >
                #{tag}
                <span className="text-xs opacity-70">{count}</span>
              </button>
            ))}
          </div>

          {failed && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              No se pudieron cargar los hashtags.
            </p>
          )}
          {!failed && loading && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Cargando...
            </p>
          )}
          {!failed && !loading && options.length === 0 && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {query ? "Sin resultados." : "Todavía no hay hashtags."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default TagFilter;