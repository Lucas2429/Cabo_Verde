import axios from "axios";
import type { Department } from "../types/departments";
import type { MemeOrder, MemesData } from "../types/memesData";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

interface GetAllOptions {
  // Solo memes de usuarios de estas carreras. Vacío o sin indicar: todos.
  departments?: Department[];
  // Por defecto, del más nuevo al más antiguo.
  order?: MemeOrder;
}

const getAll = ({ departments = [], order = "newest" }: GetAllOptions = {}) => {
  // El parámetro se repite (department=a&department=b) en vez de ir separado
  // por comas, porque algunos nombres llevan comas.
  const params = new URLSearchParams();
  departments.forEach((department) => params.append("department", department));
  params.set("order", order);

  return axios
    .get<MemesData[]>(baseUrl, { params })
    .then((response) => response.data);
};

// Sube un meme nuevo. Va como multipart/form-data porque lleva un archivo;
// axios agrega solo el header Content-Type con su boundary.
const create = (content: string, image: File) => {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("image", image);

  return axios
    .post<MemesData>(baseUrl, formData, {
      headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" },
    })
    .then((response) => response.data);
};

export default {
  getAll,
  create,
};
