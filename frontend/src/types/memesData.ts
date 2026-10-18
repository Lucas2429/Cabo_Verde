// Orden de la galería: del más nuevo al más antiguo o al revés.
export type MemeOrder = "newest" | "oldest";

export type MemesData = {
  id: string;
  content: string;
  author: string;
  image: string;
  likes: number;
  dislikes: number;
  createdAt: string;
  updatedAt: string;
};
