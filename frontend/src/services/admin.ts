import axios from "axios";
import type {
  ReportedCommentItem,
  ReportedMemeItem,
  ReportedUserItem,
  ReportFilter,
} from "../types/report";
import { getStoredSession } from "./auth";

// Todas las rutas de /api/admin exigen sesión y rol admin (el backend responde
// 403 a cualquier otro usuario).
const baseUrl = "/api/admin";

const authConfig = () => ({
  headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" },
});

// --- Listas de reportes -----------------------------------------------------

// Posts reportados, agrupados (una fila por post). `status` = pendientes o ya
// resueltos.
const getReportedMemes = (status: ReportFilter) => {
  return axios
    .get<{ items: ReportedMemeItem[] }>(`${baseUrl}/reports/memes`, {
      ...authConfig(),
      params: { status },
    })
    .then((response) => response.data.items);
};

const getReportedComments = (status: ReportFilter) => {
  return axios
    .get<{ items: ReportedCommentItem[] }>(`${baseUrl}/reports/comments`, {
      ...authConfig(),
      params: { status },
    })
    .then((response) => response.data.items);
};

// Usuarios con reportes pendientes o aceptados.
const getReportedUsers = () => {
  return axios
    .get<{ items: ReportedUserItem[] }>(`${baseUrl}/reports/users`, authConfig())
    .then((response) => response.data.items);
};

// --- Acciones sobre posts ---------------------------------------------------

// Elimina un post por moderación (queda guardado con el motivo, pero desaparece
// de la app). El motivo es obligatorio.
const removeMeme = (memeId: string, reason: string) => {
  return axios
    .post(`${baseUrl}/memes/${memeId}/remove`, { reason }, authConfig())
    .then(() => undefined);
};

// Limita (true) o vuelve a permitir (false) los comentarios de un post.
const setCommentsLocked = (memeId: string, locked: boolean) => {
  return axios
    .put<{ commentsLocked: boolean }>(
      `${baseUrl}/memes/${memeId}/comments-lock`,
      { locked },
      authConfig()
    )
    .then((response) => response.data.commentsLocked);
};

const dismissMemeReports = (memeId: string) => {
  return axios
    .post(`${baseUrl}/memes/${memeId}/dismiss-reports`, {}, authConfig())
    .then(() => undefined);
};

// --- Acciones sobre comentarios --------------------------------------------

// Elimina un comentario por moderación: en el hilo queda como "Comentario
// eliminado". El motivo es obligatorio.
const removeComment = (commentId: string, reason: string) => {
  return axios
    .post(`${baseUrl}/comments/${commentId}/remove`, { reason }, authConfig())
    .then(() => undefined);
};

const dismissCommentReports = (commentId: string) => {
  return axios
    .post(`${baseUrl}/comments/${commentId}/dismiss-reports`, {}, authConfig())
    .then(() => undefined);
};

export default {
  getReportedMemes,
  getReportedComments,
  getReportedUsers,
  removeMeme,
  setCommentsLocked,
  dismissMemeReports,
  removeComment,
  dismissCommentReports,
};
