import axios from "axios";
import type { MemesData } from "../types/memesData";
import type { WeeklyPodium } from "../types/podium";
import { getStoredSession } from "./auth";

const baseUrl = "/api/memes";

const getAll = () => {
  return axios.get<MemesData[]>(baseUrl).then((response) => response.data);
};

// Podio de la semana en curso. Es público.
const getPodium = () => {
  return axios
    .get<WeeklyPodium>(`${baseUrl}/podium`)
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
  getPodium,
  create,
};
