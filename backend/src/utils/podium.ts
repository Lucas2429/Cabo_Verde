// Cuántos puestos tiene el podio.
export const PODIUM_SIZE = 3;

export interface PodiumPosition<T> {
  // 1 = primer lugar, 2 = segundo, 3 = tercero.
  position: number;
  likes: number;
  // Todos los memes con esa cantidad de likes (más de uno si hay empate).
  memes: T[];
}

// Arma el podio a partir de los memes de la semana.
//
// - Se ordena por likes (los dislikes no restan).
// - Los empates comparten puesto: si tres memes tienen los mismos likes que
//   quedaron segundos, los tres van en el segundo lugar.
// - El ranking es "denso": el siguiente puesto lo ocupa el siguiente número
//   distinto de likes. Si dos memes empatan en el primer lugar, el segundo
//   lugar es el que le sigue en likes (no se salta al tercero). Así el podio
//   siempre tiene tres puestos cuando hay al menos tres cantidades distintas.
// - Un meme sin likes no entra al podio.
//
// Dentro de un mismo puesto se ordenan por menos dislikes y luego por el más
// antiguo primero; es solo el orden en que se muestran, no cambia el puesto.
export const buildPodium = <
  T extends { likes: number; dislikes: number; createdAt: Date }
>(
  memes: T[],
  size: number = PODIUM_SIZE
): PodiumPosition<T>[] => {
  const tiers = new Map<number, T[]>();
  for (const meme of memes) {
    if (meme.likes <= 0) continue;
    const tier = tiers.get(meme.likes);
    if (tier) {
      tier.push(meme);
    } else {
      tiers.set(meme.likes, [meme]);
    }
  }

  return Array.from(tiers.keys())
    .sort((a, b) => b - a)
    .slice(0, size)
    .map((likes, index) => ({
      position: index + 1,
      likes,
      memes: (tiers.get(likes) ?? []).sort(
        (a, b) =>
          a.dislikes - b.dislikes || a.createdAt.getTime() - b.createdAt.getTime()
      ),
    }));
};
