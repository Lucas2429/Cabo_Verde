import { useCallback, useEffect, useState } from "react";
import reportService from "../services/report";

const EMPTY = {
  memeIds: new Set<string>(),
  commentIds: new Set<string>(),
};

// Contenido PROPIO que tiene reportes pendientes de revisión. Mientras un admin
// no los resuelva, el autor no puede editarlo ni eliminarlo (el backend lo
// rechaza con 409); esta lista sirve para deshabilitar los botones y explicar
// por qué, en vez de dejar que el usuario choque con el error.
//
// `enabled` evita la consulta cuando no hace falta (invitados, perfiles ajenos,
// o comentarios sin ninguno propio). Devuelve:
//   - memeIds / commentIds: ids de lo que está en revisión.
//   - refresh: vuelve a pedir la lista (por ejemplo, si una edición fue
//     rechazada porque el contenido se reportó mientras la página estaba abierta).
export function useUnderReview(enabled: boolean) {
  const [data, setData] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const result = await reportService.getMyContentUnderReview();
      setData({
        memeIds: new Set(result.memes),
        commentIds: new Set(result.comments),
      });
    } catch {
      // Sin la lista solo se pierde el aviso previo: el backend sigue
      // rechazando la acción, y el mensaje de error lo explica.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  // Si no está habilitado se devuelve vacío, sin guardar nada en el estado.
  return {
    memeIds: enabled ? data.memeIds : EMPTY.memeIds,
    commentIds: enabled ? data.commentIds : EMPTY.commentIds,
    refresh,
  };
}
