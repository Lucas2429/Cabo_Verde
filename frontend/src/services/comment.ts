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

// Agrega un comentario al meme. Requiere sesión: la cookie la envía el
// navegador y el token CSRF va en el header.
const create = (memeId: string, content: string) => {
  return axios
    .post<CommentData>(
      `${baseUrl}/${memeId}/comments`,
      { content },
      { headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" } }
    )
    .then((response) => response.data);
};

export default {
  getByMeme,
  create,
};
