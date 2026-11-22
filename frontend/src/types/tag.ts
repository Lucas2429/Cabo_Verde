// Un hashtag existente y cuántos memes lo usan (respuesta de GET /api/memes/tags).
export type TagCount = {
  tag: string;
  count: number;
};