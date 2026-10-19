import { useState } from "react";
import axios from "axios";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import memeService from "../services/meme";
import type { MemesData } from "../types/memesData";

interface DeleteMemeModalProps {
  meme: MemesData;
  onClose: () => void;
  onDeleted: (memeId: string) => void;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    if (error.response.status === 403) {
      return "Solo puedes eliminar tus propias publicaciones.";
    }
  }
  return "No se pudo eliminar la publicación. Intenta nuevamente.";
};

// Confirmación antes de eliminar un meme propio (la acción no se puede deshacer).
const DeleteMemeModal = ({
  meme,
  onClose,
  onDeleted,
  onSessionExpired,
}: DeleteMemeModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await memeService.remove(meme.id);
      onDeleted(meme.id);
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }
      // Si ya no existía (404), el resultado es el que se buscaba.
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        onDeleted(meme.id);
        onClose();
        return;
      }
      setError(describeError(err));
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={deleting ? undefined : onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-meme-title"
        className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[30px] border-4 border-gray-800 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 text-4xl">
            <DeleteOutlinedIcon fontSize="inherit" />
          </span>
          <h2
            id="delete-meme-title"
            className="text-xl font-bold text-gray-800 dark:text-white"
          >
            ¿Eliminar esta publicación?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Se borrarán también sus comentarios y reacciones. Esta acción no se
            puede deshacer.
          </p>
        </div>

        <img
          src={meme.image}
          alt={meme.content || "Meme"}
          className="mx-auto mt-4 max-h-36 max-w-full rounded-lg object-contain"
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-center text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="bg-[#b4b4b4] hover:bg-[#868686] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteMemeModal;
