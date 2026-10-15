export type ReactionType = "like" | "dislike";

// Respuesta del backend al reaccionar: la reacción que quedó del usuario
// (null si la quitó) y los totales actualizados del meme.
export type ReactionState = {
  type: ReactionType | null;
  likes: number;
  dislikes: number;
};
