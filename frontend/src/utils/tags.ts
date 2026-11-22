// Mismos límites que el backend (controllers/memes.ts).
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;

// Letras (con tildes y ñ), números y guion bajo. Sin espacios ni símbolos.
const TAG_PATTERN = /^[\p{L}\p{N}_]+$/u;

export const TAG_FORMAT_ERROR = `El hashtag solo puede tener letras, números o _ (máx. ${MAX_TAG_LENGTH}).`;
export const TAGS_LIMIT_ERROR = `Máximo ${MAX_TAGS} hashtags.`;

// "#Parcial " -> "parcial". Devuelve null si no es un hashtag válido.
export const normalizeTag = (value: string): string | null => {
  const tag = value.trim().replace(/^#+/, "").toLowerCase();
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(tag)
    ? tag
    : null;
};

// Suma a `tags` el hashtag que esté escrito en el campo (`pending`), si lo hay.
// Devuelve la lista final o un mensaje de error. Sirve tanto al agregar con
// Enter como al guardar el formulario con un hashtag a medio confirmar.
export const withPendingTag = (
  tags: string[],
  pending: string
): { tags: string[] } | { error: string } => {
  if (pending.trim() === "") return { tags };
  const tag = normalizeTag(pending);
  if (!tag) return { error: TAG_FORMAT_ERROR };
  if (tags.includes(tag)) return { tags };
  if (tags.length >= MAX_TAGS) return { error: TAGS_LIMIT_ERROR };
  return { tags: [...tags, tag] };
};