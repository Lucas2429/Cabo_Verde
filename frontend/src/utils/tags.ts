// Mismos límites que el backend (controllers/memes.ts).
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;

// Letras (con tildes y ñ), números y guion bajo. Sin espacios ni símbolos.
const TAG_PATTERN = /^[\p{L}\p{N}_]+$/u;

// "#Parcial " -> "parcial". Devuelve null si no es un hashtag válido.
export const normalizeTag = (value: string): string | null => {
  const tag = value.trim().replace(/^#+/, "").toLowerCase();
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(tag)
    ? tag
    : null;
};