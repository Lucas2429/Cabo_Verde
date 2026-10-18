import axios from "axios";
import type { CommentData } from "../types/commentData";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

// Comentarios de un meme, del más nuevo al más viejo. Es público.
const getByMeme = (memeId: string) => {
  return axios
    .get<CommentData[]>(`${baseUrl}/${memeId}/comments`)
    .then((response) => response.data);
};

// Agrega un comentario al meme. Si se pasa `parent` (id de otro comentario del
// mismo meme), el comentario es una respuesta a ese. Requiere sesión: la
// cookie la envía el navegador y el token CSRF va en el header.
const create = (memeId: string, content: string, parent: string | null = null) => {
  return axios
    .post<CommentData>(
      `${baseUrl}/${memeId}/comments`,
      { content, parent },
      { headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" } }
    )
    .then((response) => response.data);
};

export default {
  getByMeme,
  create,
};
