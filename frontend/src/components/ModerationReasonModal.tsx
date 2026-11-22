import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { useSessionExpired } from "../hooks/useSessionExpired";
import {
  MAX_REMOVAL_REASON_LENGTH,
  MIN_REMOVAL_REASON_LENGTH,
} from "../types/report";

interface ModerationReasonModalProps {
  title: string;
  description: string;
  // Vista previa de lo que se va a eliminar (imagen del meme, texto del comentario...).
  preview?: ReactNode;
  // Motivo sugerido (por ejemplo, el más reportado); el admin puede cambiarlo.
  defaultReason?: string;
  // Textos del botón de confirmar (por defecto, los de "Eliminar") y ícono del
  // encabezado. Se cambian cuando la acción no es eliminar (por ejemplo, banear).
  confirmLabel?: string;
  busyLabel?: string;
  icon?: ReactNode;
  // Hace la eliminación. Si falla, debe lanzar el error (axios) para mostrarlo acá.
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    switch (error.response.status) {
      case 403:
        return "No puedes moderar a otro administrador ni su contenido.";
      case 404:
        return "Esto ya no existe.";
      case 409:
        return "Esto ya fue moderado (por ejemplo, por otro administrador).";
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo eliminar. Intenta nuevamente.";
};

// Confirmación para ELIMINAR por moderación. Pide un motivo obligatorio porque
// queda guardado junto con el contenido eliminado (que no se borra de la base de
// datos). Se dibuja en un portal sobre el <body> por la misma razón que
// ReportModal: las tarjetas de la galería recortarían un modal `fixed`.
const ModerationReasonModal = ({
  title,
  description,
  preview,
  defaultReason = "",
  confirmLabel = "Eliminar",
  busyLabel = "Eliminando...",
  icon,
  onConfirm,
  onClose,
}: ModerationReasonModalProps) => {
  const handleSessionExpired = useSessionExpired();

  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const trimmed = reason.trim();
  const reasonTooShort = trimmed.length < MIN_REMOVAL_REASON_LENGTH;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (reasonTooShort) {
      setError("Escribe el motivo de la eliminación.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      // Ver ReportModal: se frena el clic para que no abra el meme de la tarjeta.
      onClick={(e) => {
        e.stopPropagation();
        if (!submitting) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="moderation-title"
        className="modal-card max-h-[95vh] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600 dark:bg-red-500/15 dark:text-red-400">
            {icon ?? <DeleteOutlinedIcon fontSize="inherit" />}
          </span>
          <h2
            id="moderation-title"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </div>

        {preview && <div className="mt-4">{preview}</div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="removal-reason" className="field-label">
              Motivo
            </label>
            <textarea
              id="removal-reason"
              value={reason}
              rows={3}
              maxLength={MAX_REMOVAL_REASON_LENGTH}
              autoFocus
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              placeholder="Queda registrado junto con el contenido eliminado."
              className="field resize-none"
            />
            <span className="field-hint text-right">
              {reason.length}/{MAX_REMOVAL_REASON_LENGTH}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-center gap-3 pt-1">
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
              disabled={submitting || reasonTooShort}
              className="btn-danger"
            >
              {submitting ? busyLabel : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ModerationReasonModal;
