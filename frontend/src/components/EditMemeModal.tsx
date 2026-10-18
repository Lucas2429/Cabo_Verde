import { useState } from "react";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import memeService from "../services/meme";
import type { MemesData } from "../types/memesData";

const MAX_CONTENT_LENGTH = 300;

interface EditMemeModalProps {
  meme: MemesData;
  onClose: () => void;
  onUpdated: (meme: MemesData) => void;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    if (error.response.status === 403) {
      return "Solo puedes editar tus propias publicaciones.";
    }
    if (error.response.status === 404) {
      return "Esta publicación ya no existe.";
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo guardar el cambio. Intenta nuevamente.";
};

// Edita la descripción de un meme propio. La imagen no se puede cambiar: para
// eso se elimina la publicación y se sube otra.
const EditMemeModal = ({
  meme,
  onClose,
  onUpdated,
  onSessionExpired,
}: EditMemeModalProps) => {
  const [content, setContent] = useState(meme.content);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = content.trim();
    if (trimmed === "") {
      setError("Escribe una descripción.");
      return;
    }
    // Sin cambios: no hace falta molestar al servidor.
    if (trimmed === meme.content) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await memeService.update(meme.id, trimmed);
      onUpdated(updated);
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[30px] border-4 border-gray-800 w-full max-w-md max-h-[95vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Editar publicación
          </h2>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors cursor-pointer flex items-center justify-center"
            type="button"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex min-h-32 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 p-2">
            <img
              src={meme.image}
              alt={meme.content || "Meme"}
              className="max-h-56 max-w-full rounded-lg object-contain"
            />
          </div>

          <div>
            <label
              htmlFor="edit-meme-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Descripción
            </label>
            <input
              id="edit-meme-content"
              type="text"
              value={content}
              maxLength={MAX_CONTENT_LENGTH}
              autoFocus
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <span className="text-[11px] text-gray-400 mt-1 block text-right">
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="bg-[#b4b4b4] hover:bg-[#868686] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#5a6c8a] hover:bg-[#485770] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMemeModal;
