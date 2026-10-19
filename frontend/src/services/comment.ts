import axios from "axios";
import type { CommentData } from "../types/commentData";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

type DeleteCommentResult =
  | {
    deletionType: "soft";
    comment: CommentData;
  }
  | {
    deletionType: "hard";
    commentId: string;
  };

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


// Actualizar un comentario propio.
const update = (memeId: string, commentId: string, content: string) => {
  return axios
    .patch<CommentData>(
      `${baseUrl}/${memeId}/comments/${commentId}`,
      { content },
      { headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "", }, }
    )
    .then((response) => response.data);
};



const remove = (memeId: string, commentId: string) => {
  return axios
    .delete<DeleteCommentResult>(
      `${baseUrl}/${memeId}/comments/${commentId}`,
      { headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "", }, }
    )
    .then((response) => response.data);
};



export default {
  getByMeme,
  create,
  update,
  remove,
};
