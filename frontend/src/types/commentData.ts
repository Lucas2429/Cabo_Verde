export type CommentData = {
  id: string;
  content: string;
  author: string;
  // Id del comentario al que responde. null si es de primer nivel.
  parent: string | null;
  createdAt: string;
  updatedAt: string;
};
