import axios from "axios";
import type { ReactionState, ReactionType } from "../types/reaction";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

// Todas las llamadas requieren sesión: la cookie la envía el navegador y el
// token CSRF va en el header.
const authConfig = () => ({
  headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" },
});

// Reacciones del usuario con sesión: { "<idDelMeme>": "like" | "dislike" }.
const getMine = () => {
  return axios
    .get<Record<string, ReactionType>>(`${baseUrl}/reactions/mine`, authConfig())
    .then((response) => response.data);
};

// Pone (o cambia) la reacción del usuario a un meme.
const set = (memeId: string, type: ReactionType) => {
  return axios
    .put<ReactionState>(`${baseUrl}/${memeId}/reaction`, { type }, authConfig())
    .then((response) => response.data);
};

// Quita la reacción del usuario a un meme.
const remove = (memeId: string) => {
  return axios
    .delete<ReactionState>(`${baseUrl}/${memeId}/reaction`, authConfig())
    .then((response) => response.data);
};

export default {
  getMine,
  set,
  remove,
};
