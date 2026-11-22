import { useState } from "react";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import memeService from "../services/meme";
import type { Department } from "../types/departments";
import type { MemesData } from "../types/memesData";
import { PENDING_REPORTS_MESSAGES, isPendingReportsError } from "../utils/reports";
import { withPendingTag } from "../utils/tags";
import MemeTagsField from "./MemeTagsField";

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
    if (isPendingReportsError(error)) {
      return PENDING_REPORTS_MESSAGES.meme;
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

// Mismos elementos, sin importar el orden.
const sameItems = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

// Edita la descripción, las carreras y los hashtags de un meme propio. La
// imagen no se puede cambiar: para eso se elimina la publicación y se sube otra.
const EditMemeModal = ({
  meme,
  onClose,
  onUpdated,
  onSessionExpired,
}: EditMemeModalProps) => {
  const [content, setContent] = useState(meme.content);
  const [departments, setDepartments] = useState<Department[]>(
    meme.departments ?? []
  );
  const [tags, setTags] = useState<string[]>(meme.tags ?? []);
  const [tagInput, setTagInput] = useState("");
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

    // Si quedó un hashtag escrito sin confirmar, se incluye al guardar.
    const result = withPendingTag(tags, tagInput);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const finalTags = result.tags;

    // Sin cambios: no hace falta molestar al servidor.
    if (
      trimmed === meme.content &&
      sameItems(departments, meme.departments ?? []) &&
      sameItems(finalTags, meme.tags ?? [])
    ) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await memeService.update(meme.id, trimmed, {
        departments,
        tags: finalTags,
      });
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
        className="modal-card max-h-[95vh] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Editar publicación
          </h2>
          <button
            onClick={onClose}
            className="icon-btn"
            type="button"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex min-h-32 items-center justify-center rounded-2xl bg-gray-100 p-2 dark:bg-gray-800">
            <img
              src={meme.image}
              alt={meme.content || "Meme"}
              className="max-h-56 max-w-full rounded-lg object-contain"
            />
          </div>

          <div>
            <label htmlFor="edit-meme-content" className="field-label">
              Descripción
            </label>
            <input
              id="edit-meme-content"
              type="text"
              value={content}
              maxLength={MAX_CONTENT_LENGTH}
              autoFocus
              onChange={(e) => setContent(e.target.value)}
              className="field"
            />
            <span className="field-hint text-right">
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </div>

          <MemeTagsField
            departments={departments}
            onDepartmentsChange={setDepartments}
            tags={tags}
            onTagsChange={setTags}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            onError={setError}
            inputId="edit-meme-tags"
          />

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
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
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