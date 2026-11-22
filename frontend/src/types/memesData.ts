import type { Department } from "./departments";
// Orden de la galería: del más nuevo al más antiguo o al revés.
export type MemeOrder = "newest" | "oldest";

export type MemesData = {
  id: string;
  content: string;
  author: string;
  image: string;
  // Etiqueta especial de carrera (opcional al subir el meme).
  departments: Department[];
  // Hashtags libres, sin "#" y en minúscula (ej. "parcial").
  tags: string[];
  likes: number;
  dislikes: number;
  // true si un admin limitó los comentarios: se ven, pero no se puede comentar.
  commentsLocked: boolean;
  createdAt: string;
  updatedAt: string;
};
