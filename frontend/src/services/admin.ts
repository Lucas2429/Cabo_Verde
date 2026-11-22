import axios from "axios";
import type {
  AlertCounts,
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

// Usuarios reportados, agrupados igual que los posts y comentarios.
const getReportedUsers = (status: ReportFilter) => {
  return axios
    .get<{ items: ReportedUserItem[] }>(`${baseUrl}/reports/users`, {
      ...authConfig(),
      params: { status },
    })
    .then((response) => response.data.items);
};

// Cuántos posts, comentarios y usuarios están "en alerta" (el umbral lo define
// el backend y viene en `threshold`). El header de los admins muestra una marca
// si hay alguno.
const getReportAlerts = () => {
  return axios
    .get<AlertCounts>(`${baseUrl}/reports/alerts`, authConfig())
    .then((response) => response.data);
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

// --- Acciones sobre usuarios -----------------------------------------------

// Banea a un usuario: no podrá iniciar sesión y su sesión abierta se corta al
// instante. El motivo es obligatorio y solo lo ven los admins.
const banUser = (username: string, reason: string) => {
  return axios
    .post(
      `${baseUrl}/users/${encodeURIComponent(username)}/ban`,
      { reason },
      authConfig()
    )
    .then(() => undefined);
};

// Levanta el baneo: el usuario puede volver a iniciar sesión.
const unbanUser = (username: string) => {
  return axios
    .post(
      `${baseUrl}/users/${encodeURIComponent(username)}/unban`,
      {},
      authConfig()
    )
    .then(() => undefined);
};

const dismissUserReports = (username: string) => {
  return axios
    .post(
      `${baseUrl}/users/${encodeURIComponent(username)}/dismiss-reports`,
      {},
      authConfig()
    )
    .then(() => undefined);
};

export default {
  getReportedMemes,
  getReportedComments,
  getReportedUsers,
  getReportAlerts,
  removeMeme,
  setCommentsLocked,
  dismissMemeReports,
  removeComment,
  dismissCommentReports,
  banUser,
  unbanUser,
  dismissUserReports,
};
