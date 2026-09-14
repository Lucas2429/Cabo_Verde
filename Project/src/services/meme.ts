import axios from "axios";
import type { MemesData } from "../types/post";
const baseUrl = "http://localhost:3001/memes";

const getAll = () => {
  const request = axios.get(baseUrl);
  return request.then((response) => response.data);
};

interface MemesAnswer {
  thread: MemesData;
  comments: MemesData[];
}
const getMeme = (id: string) => {
  const request = axios.get<MemesAnswer>(`${baseUrl}/${id}`)
  return request.then(response => response.data)
}

interface MemesCreateData {
  content: string
  author: string
}
const create = (data: MemesCreateData) => {
  return axios.post<MemesData>(`${baseUrl}`, data).then(request => request.data)
}

const update = (id: number, newObject: MemesData) => {
  return axios
    .put<MemesData>(`${baseUrl}/${id}`, newObject)
    .then((request) => request.data);
};

export default {
  getAll,
  getMeme,
  create,
  update,
};
