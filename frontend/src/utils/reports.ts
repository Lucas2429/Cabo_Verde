import axios from "axios";

// Textos que se muestran cuando el backend rechaza (409, code "pending_reports")
// editar o eliminar un contenido propio que todavía tiene reportes pendientes.
export const PENDING_REPORTS_MESSAGES = {
  meme: "Esta publicación tiene reportes pendientes de revisión. Podrás editarla o eliminarla cuando un administrador los resuelva.",
  comment:
    "Este comentario tiene reportes pendientes de revisión. Podrás editarlo o eliminarlo cuando un administrador los resuelva.",
} as const;

// Explicación corta para los botones deshabilitados (tooltip).
export const UNDER_REVIEW_HINT =
  "Tiene reportes pendientes de revisión. No se puede editar ni eliminar hasta que un administrador los resuelva.";

// ¿El backend rechazó la acción porque el contenido tiene reportes pendientes?
// Se reconoce por el `code` de la respuesta, no por su texto (que está en inglés).
export const isPendingReportsError = (error: unknown): boolean =>
  axios.isAxiosError(error) &&
  error.response?.status === 409 &&
  (error.response.data as { code?: unknown } | undefined)?.code ===
    "pending_reports";
