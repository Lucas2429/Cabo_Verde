import { useEffect, useState } from "react";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import memeService from "../services/meme";
import {
  DEPARTMENTS,
  DEPARTMENT_SHORT_NAMES,
  type Department,
} from "../types/departments";
import type { MemesData } from "../types/memesData";
import { ACCEPT_ATTR, MAX_IMAGE_MB, validateImage } from "../utils/image";
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from "../utils/tags";

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

const TAG_FORMAT_ERROR = `El hashtag solo puede tener letras, números o _ (máx. ${MAX_TAG_LENGTH}).`;

const UploadMemeModal = ({
  onClose,
  onCreated,
  onSessionExpired,
}: UploadMemeModalProps) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [content, setContent] = useState("");
  // Etiqueta especial de carrera (opcional) y hashtags libres.
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
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

  const toggleDepartment = (department: Department) => {
    setDepartments((current) =>
      current.includes(department)
        ? current.filter((item) => item !== department)
        : [...current, department]
    );
  };

  // Agrega el hashtag escrito al arreglo (si es válido y no está repetido).
  const addTag = () => {
    if (tagInput.trim() === "") return;

    const tag = normalizeTag(tagInput);
    if (!tag) {
      setError(TAG_FORMAT_ERROR);
      return;
    }
    if (tags.includes(tag)) {
      setTagInput("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`Máximo ${MAX_TAGS} hashtags.`);
      return;
    }
    setError(null);
    setTags([...tags, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter, coma o espacio cierran el hashtag. Enter se frena para que no
    // envíe el formulario completo.
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
      // Backspace con el campo vacío quita el último hashtag.
      setTags((current) => current.slice(0, -1));
    }
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

    // Si quedó un hashtag escrito sin confirmar, se incluye al publicar.
    let finalTags = tags;
    if (tagInput.trim() !== "") {
      const pending = normalizeTag(tagInput);
      if (!pending) {
        setError(TAG_FORMAT_ERROR);
        return;
      }
      if (!tags.includes(pending)) {
        if (tags.length >= MAX_TAGS) {
          setError(`Máximo ${MAX_TAGS} hashtags.`);
          return;
        }
        finalTags = [...tags, pending];
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const meme = await memeService.create(content.trim(), image, {
        departments,
        tags: finalTags,
      });
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
        className="modal-card max-h-[95vh] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Añada su meme
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
          <div>
            <span className="field-label">
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
              className="flex min-h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-2 text-center text-sm text-gray-500 transition-colors hover:border-indigo-500 hover:bg-indigo-50/50 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/60"
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
            <span className="field-hint">
              JPG, PNG, WEBP o GIF · máximo {MAX_IMAGE_MB} MB
              {image && ` · ${image.name}`}
            </span>
          </div>

          <div>
            <label
              htmlFor="meme-content"
              className="field-label"
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
              className="field"
            />
            <span className="field-hint text-right">
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </div>

          {/* Etiqueta especial de carrera (opcional, se pueden elegir varias). */}
          <div>
            <span className="field-label">Carrera (opcional)</span>
            <div
              role="group"
              aria-label="Carrera del meme"
              className="flex flex-wrap gap-2"
            >
              {DEPARTMENTS.map((department) => (
                <button
                  key={department}
                  type="button"
                  title={department}
                  aria-pressed={departments.includes(department)}
                  onClick={() => toggleDepartment(department)}
                  className="chip"
                >
                  {DEPARTMENT_SHORT_NAMES[department]}
                </button>
              ))}
            </div>
          </div>

          {/* Hashtags libres: se escribe y se confirma con Enter, coma o espacio. */}
          <div>
            <label htmlFor="meme-tags" className="field-label">
              Hashtags (opcional)
            </label>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="chip">
                    #{tag}
                    <button
                      type="button"
                      aria-label={`Quitar #${tag}`}
                      onClick={() => removeTag(tag)}
                      className="ml-1 inline-flex items-center"
                    >
                      <CloseIcon fontSize="inherit" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              id="meme-tags"
              type="text"
              value={tagInput}
              maxLength={MAX_TAG_LENGTH + 1}
              placeholder={
                tags.length >= MAX_TAGS ? "Máximo alcanzado" : "#parcial"
              }
              disabled={tags.length >= MAX_TAGS}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="field"
            />
            <span className="field-hint">
              Enter, coma o espacio para agregar · {tags.length}/{MAX_TAGS}
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
              className="btn-primary"
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