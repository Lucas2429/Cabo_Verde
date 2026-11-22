// Orden de la galería: del más nuevo al más antiguo o al revés.
export type MemeOrder = "newest" | "oldest";

export type MemesData = {
  id: string;
  content: string;
  author: string;
  image: string;
  // Tamaño de la imagen en píxeles (ya con la orientación EXIF aplicada). Se
  // usa para reservar el espacio de la tarjeta antes de que la imagen cargue. Es
  // null en los memes anteriores a esta función cuyo tamaño todavía no se calculó
  // (npm run backfill-image-sizes en el backend); en ese caso la tarjeta se ve
  // como antes, sin reserva.
  width: number | null;
  height: number | null;
  likes: number;
  dislikes: number;
  // true si un admin limitó los comentarios: se ven, pero no se puede comentar.
  commentsLocked: boolean;
  createdAt: string;
  updatedAt: string;
};
