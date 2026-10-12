import { useEffect, useState } from "react";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import memeService from "../services/meme";
import type { MemesData } from "../types/memesData";
import { ACCEPT_ATTR, MAX_IMAGE_MB, validateImage } from "../utils/image";

const MAX_CONTENT_LENGTH = 300;

interface UploadMemeModalProps {
  onClose: () => void;
  onCreated: (meme: MemesData) => void;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    if (error.response.status === 413) {
      return `La imagen supera el máximo de ${MAX_IMAGE_MB} MB.`;
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo subir el meme. Intenta nuevamente.";
};

const UploadMemeModal = ({
  onClose,
  onCreated,
  onSessionExpired,
}: UploadMemeModalProps) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Vista previa local de la imagen elegida; se libera la URL al cambiarla.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const problem = validateImage(file);
    if (problem) {
      setError(problem);
      setImage(null);
      event.target.value = "";
      return;
    }
    setError(null);
    setImage(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!image) {
      setError("Selecciona una imagen.");
      return;
    }
    if (content.trim() === "") {
      setError("Escribe una descripción.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const meme = await memeService.create(content.trim(), image);
      onCreated(meme);
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }
      setError(describeError(err));
    } finally {
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
            Añada su meme
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
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Imagen
            </span>
            <input
              id="meme-image"
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleFileChange}
              className="sr-only"
            />
            <label
              htmlFor="meme-image"
              className="flex min-h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-center text-sm text-gray-500 hover:border-indigo-500 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Vista previa"
                  className="max-h-56 max-w-full rounded-lg object-contain"
                />
              ) : (
                <span>Haz clic para elegir una imagen</span>
              )}
            </label>
            <span className="text-[11px] text-gray-400 mt-1 block">
              JPG, PNG, WEBP o GIF · máximo {MAX_IMAGE_MB} MB
              {image && ` · ${image.name}`}
            </span>
          </div>

          <div>
            <label
              htmlFor="meme-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Descripción
            </label>
            <input
              id="meme-content"
              type="text"
              value={content}
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="Escribe algo gracioso..."
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

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#5a6c8a] hover:bg-[#485770] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
            >
              {submitting ? "Subiendo..." : "Add Meme"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadMemeModal;
