import axios from "axios";
import type { ReportReason } from "../types/report";
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

export default { reportMeme, reportComment };
