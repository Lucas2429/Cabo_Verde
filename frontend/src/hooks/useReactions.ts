import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import reactionService from "../services/reaction";
import { useAuth } from "../context/auth";
import type { ReactionType } from "../types/reaction";

interface Options {
  // Se llama con los totales actualizados que devuelve el backend. Cada página
  // guarda sus memes en su propio estado (la galería en una lista, el perfil
  // dentro del perfil), así que es ella la que los actualiza.
  onCountsChange: (
    memeId: string,
    counts: { likes: number; dislikes: number }
  ) => void;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void | Promise<void>;
}

// Lógica de likes y dislikes compartida por todas las páginas que muestran
// memes (galería y perfil). Devuelve:
//   - myReactions: la reacción del usuario a cada meme { idDelMeme: tipo }.
//   - handleReact: úsalo como onReact de <Meme> y <MemeModal>.
export function useReactions({ onCountsChange, onSessionExpired }: Options) {
  const { username } = useAuth();
  const navigate = useNavigate();

  const [myReactions, setMyReactions] = useState<Record<string, ReactionType>>({});
  // Memes con una reacción en curso: evita doble clic mientras se espera al backend.
  const reactingRef = useRef<Set<string>>(new Set());

  // Al iniciar (o restaurar) la sesión se cargan las reacciones del usuario; al
  // cerrarla se limpian.
  useEffect(() => {
    if (username === null) {
      setMyReactions({});
      return;
    }

    let cancelled = false;
    reactionService
      .getMine()
      .then((data) => {
        if (!cancelled) setMyReactions(data);
      })
      .catch(() => {
        // Sin las reacciones propias solo se pierde el resaltado de los botones;
        // si la sesión expiró, AuthProvider ya se encarga de cerrarla.
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Like / dislike. Tocar la misma reacción otra vez la quita; tocar la otra la
  // reemplaza. Un invitado va al login (y el backend igual responde 401).
  const handleReact = async (memeId: string, type: ReactionType) => {
    if (username === null) {
      navigate("/login");
      return;
    }
    if (reactingRef.current.has(memeId)) return;
    reactingRef.current.add(memeId);

    try {
      const result =
        myReactions[memeId] === type
          ? await reactionService.remove(memeId)
          : await reactionService.set(memeId, type);

      // Se usan los totales que devuelve el backend, no un cálculo local.
      onCountsChange(memeId, { likes: result.likes, dislikes: result.dislikes });
      setMyReactions((prev) => {
        const next = { ...prev };
        if (result.type) {
          next[memeId] = result.type;
        } else {
          delete next[memeId];
        }
        return next;
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await onSessionExpired();
      }
      // Otros errores (red, etc.): no cambia nada y se puede reintentar.
    } finally {
      reactingRef.current.delete(memeId);
    }
  };

  return { myReactions, handleReact };
}
