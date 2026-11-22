import axios from "axios";
import type { ContentUnderReview, ReportReason } from "../types/report";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

const authConfig = () => ({
  headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" },
});

// Reporta un meme. `details` solo es obligatorio si el motivo es "other". Requiere
// sesión. El backend responde 409 si ya lo reportaste, 403 si es tuyo y 429 si
// mandaste demasiados reportes en la última hora.
const reportMeme = (memeId: string, reason: ReportReason, details: string) => {
  return axios
    .post(`${baseUrl}/${memeId}/report`, { reason, details }, authConfig())
    .then(() => undefined);
};

// Reporta un comentario de un meme (mismas reglas que reportMeme).
const reportComment = (
  memeId: string,
  commentId: string,
  reason: ReportReason,
  details: string
) => {
  return axios
    .post(
      `${baseUrl}/${memeId}/comments/${commentId}/report`,
      { reason, details },
      authConfig()
    )
    .then(() => undefined);
};

// Reporta a un usuario (su perfil o su conducta en general). Mismas reglas que
// reportMeme, más: los admins no se pueden reportar (403, code "admin_target") y
// un usuario ya baneado tampoco (409, code "user_banned").
const reportUser = (username: string, reason: ReportReason, details: string) => {
  return axios
    .post(
      `/api/users/${encodeURIComponent(username)}/report`,
      { reason, details },
      authConfig()
    )
    .then(() => undefined);
};

// Mi contenido (memes y comentarios) que tiene reportes pendientes: mientras
// un admin no los resuelva, no puedo editarlo ni eliminarlo. Requiere sesión y
// solo devuelve lo propio.
const getMyContentUnderReview = () => {
  return axios
    .get<ContentUnderReview>(`${baseUrl}/under-review/mine`, authConfig())
    .then((response) => response.data);
};

export default { reportMeme, reportComment, reportUser, getMyContentUnderReview };
