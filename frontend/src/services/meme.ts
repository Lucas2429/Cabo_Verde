import axios from "axios";
import type { MemesData } from "../types/memesData";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

const csrfHeaders = () => ({ "X-CSRF-Token": getStoredSession()?.csrf ?? "" });

const getAll = () => {
  return axios.get<MemesData[]>(baseUrl).then((response) => response.data);
};

// Sube un meme nuevo. Va como multipart/form-data porque lleva un archivo;
// axios agrega solo el header Content-Type con su boundary.
const create = (content: string, image: File) => {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("image", image);

  return axios
    .post<MemesData>(baseUrl, formData, { headers: csrfHeaders() })
    .then((response) => response.data);
};

// Cambia la descripción de un meme propio (el backend responde 403 si el meme
// es de otro usuario).
const update = (id: string, content: string) => {
  return axios
    .patch<MemesData>(`${baseUrl}/${id}`, { content }, { headers: csrfHeaders() })
    .then((response) => response.data);
};

// Elimina un meme propio, junto con sus comentarios y reacciones.
const remove = (id: string) => {
  return axios
    .delete(`${baseUrl}/${id}`, { headers: csrfHeaders() })
    .then(() => undefined);
};

export default {
  getAll,
  create,
  update,
  remove,
};
