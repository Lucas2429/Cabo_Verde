import type { MemesData } from "./memesData";

export type UserProfile = {
  // Identificador único; se muestra como @username.
  username: string;
  // Nombre público; puede repetirse entre usuarios.
  displayName: string;
  description: string;
  department: string;
  memesCount: number;
  // Los últimos memes publicados (máximo 3), del más nuevo al más antiguo.
  latestMemes: MemesData[];
};

// Límites que valida el backend (backend/src/models/user.ts).
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 150;
