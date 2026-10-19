import type { MemesData } from "./memesData";

// Un puesto del podio. Si hay empate, `memes` trae todos los memes que
// comparten ese puesto (todos con la misma cantidad de likes).
export type PodiumPosition = {
  // 1 = primer lugar, 2 = segundo, 3 = tercero.
  position: number;
  likes: number;
  memes: MemesData[];
};

// Podio de la semana en curso (de lunes a domingo, hora de Chile). Puede venir
// vacío si ningún meme de la semana tiene likes todavía.
export type WeeklyPodium = {
  // Lunes a las 00:00 (incluido) y lunes siguiente a las 00:00 (excluido).
  weekStart: string;
  weekEnd: string;
  podium: PodiumPosition[];
};
