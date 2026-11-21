import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import reportService from "../services/report";
import { useSessionExpired } from "../hooks/useSessionExpired";
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "../types/report";

interface ReportModalProps {
  // Qué se reporta: el meme completo o un comentario suyo.
  target: "meme" | "comment";
  memeId: string;
  // Solo cuando target es "comment".
  commentId?: string;
  onClose: () => void;
}

const describeError = (error: unknown, noun: string): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    switch (error.response.status) {
      case 403:
        return "No puedes reportar tu propio contenido.";
      case 404:
        return `Este ${noun} ya no existe.`;
      case 409:
        return `Ya reportaste este ${noun}.`;
      case 429:
        return "Enviaste demasiados reportes seguidos. Intenta de nuevo más tarde.";
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo enviar el reporte. Intenta nuevamente.";
};

// Formulario para reportar un meme o un comentario ajeno: se elige un motivo y,
// si es "Otro", se explica cuál. Se dibuja en un portal sobre el <body>: las
// tarjetas de la galería tienen `transform` y `overflow-hidden`, que recortarían
// o descolocarían un modal `fixed` si viviera dentro de ellas.
const ReportModal = ({ target, memeId, commentId, onClose }: ReportModalProps) => {
  const handleSessionExpired = useSessionExpired();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const noun = target === "meme" ? "publicación" : "comentario";

  // Escape cierra la ventana.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!reason) {
      setError("Elige un motivo.");
      return;
    }
    const trimmed = details.trim();
    if (reason === "other" && trimmed === "") {
      setError("Cuéntanos cuál es el motivo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (target === "meme") {
        await reportService.reportMeme(memeId, reason, trimmed);
      } else if (commentId) {
        await reportService.reportComment(memeId, commentId, reason, trimmed);
      }
      setSent(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(describeError(err, noun));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      // Se frena el clic: aunque el modal se dibuje en el <body>, React lo
      // propaga por el árbol de componentes y abriría el meme de la tarjeta.
      onClick={(e) => {
        e.stopPropagation();
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="modal-card max-h-[95vh] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="report-title"
            className="font-display text-4xl leading-none tracking-wide text-gray-900 dark:text-white"
          >
            Reportar
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="icon-btn"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircleOutlineIcon fontSize="inherit" />
            </span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Reporte enviado
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gracias por ayudarnos a cuidar la comunidad. Un administrador
              revisará este {noun}.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-2">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              ¿Por qué quieres reportar este {noun}?
            </p>

            <div role="radiogroup" aria-label="Motivo del reporte" className="space-y-2">
              {REPORT_REASONS.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:has-[:checked]:border-indigo-400 dark:has-[:checked]:bg-indigo-500/15 dark:has-[:checked]:text-indigo-200"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => {
                      setReason(option);
                      setError(null);
                    }}
                    className="accent-indigo-600"
                  />
                  {REPORT_REASON_LABELS[option]}
                </label>
              ))}
            </div>

            {/* "Otro" obliga a explicar cuál. */}
            {reason === "other" && (
              <div>
                <label htmlFor="report-details" className="field-label">
                  ¿Cuál?
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  rows={3}
                  maxLength={MAX_REPORT_DETAILS_LENGTH}
                  autoFocus
                  onChange={(e) => setDetails(e.target.value)}
                  className="field resize-none"
                />
                <span className="field-hint text-right">
                  {details.length}/{MAX_REPORT_DETAILS_LENGTH}
                </span>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ReportModal;
