import axios from "axios";
import type { WeeklyPodium } from "../types/podium";
import type { Department } from "../types/departments";
import type { MemeOrder, MemesData } from "../types/memesData";
import { getStoredSession } from "./auth";
import type { TagCount } from "../types/tag";

const baseUrl = "/api/memes";

const csrfHeaders = () => ({ "X-CSRF-Token": getStoredSession()?.csrf ?? "" });

interface GetAllOptions {
  // Solo memes de usuarios de estas carreras (o etiquetados con ellas).
  // Vacío o sin indicar: todos.
  departments?: Department[];
  // Hashtags (sin "#"). El meme debe tener TODOS. Vacío: no filtra.
  tags?: string[];
  // Por defecto, del más nuevo al más antiguo.
  order?: MemeOrder;
}

const getAll = ({
  departments = [],
  tags = [],
  order = "newest",
}: GetAllOptions = {}) => {
  // Los parámetros se repiten (department=a&department=b, tag=x&tag=y) en vez
  // de ir separados por comas, porque algunos nombres de carrera llevan comas.
  const params = new URLSearchParams();
  departments.forEach((department) => params.append("department", department));
  tags.forEach((tag) => params.append("tag", tag));
  params.set("order", order);

  return axios
    .get<MemesData[]>(baseUrl, { params })
    .then((response) => response.data);
};

// Hashtags que ya existen, los más usados primero. Con `query` solo los que
// empiezan con ese texto (para el buscador del filtro).
const getTags = (query = "") => {
  return axios
    .get<TagCount[]>(`${baseUrl}/tags`, { params: query ? { q: query } : {} })
    .then((response) => response.data);
};

// Podio de la semana en curso. Es público.
const getPodium = () => {
  return axios
    .get<WeeklyPodium>(`${baseUrl}/podium`)
    .then((response) => response.data);
};

interface CreateOptions {
  // Etiqueta especial de carrera (opcional).
  departments?: Department[];
  // Hashtags libres, sin "#" (máx. 5).
  tags?: string[];
}

// Sube un meme nuevo. Va como multipart/form-data porque lleva un archivo;
// axios agrega solo el header Content-Type con su boundary.
// departments y tags se repiten como campos (tags=a&tags=b), igual que en
// requests.rest.
const create = (content: string, image: File, { departments = [], tags = [] }: CreateOptions = {}) => {
  const formData = new FormData();
  formData.append("content", content);
  departments.forEach((department) => formData.append("departments", department));
  tags.forEach((tag) => formData.append("tags", tag));
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
  getTags,
  getPodium,
  create,
  update,
  remove,
};
