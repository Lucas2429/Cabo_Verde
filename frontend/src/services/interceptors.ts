import axios from "axios";
import { useAuthStore } from "../stores/authStore";

// URL del login. Ahí el 403 "banned" lo muestra el propio formulario (LoginPage),
// así que no debe activar también el aviso global.
const LOGIN_URL = "/api/login";

let installed = false;

// Si el backend responde 403 con code "banned" a CUALQUIER petición, la cuenta
// fue baneada con la sesión abierta (el backend lo comprueba en cada petición,
// ver `withUser`): se cierra la sesión local y se muestra el aviso. Se instala una
// sola vez al arrancar la app (main.tsx).
export function setupInterceptors() {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 403 &&
        (error.response.data as { code?: unknown } | undefined)?.code === "banned" &&
        error.config?.url !== LOGIN_URL
      ) {
        useAuthStore.getState().handleBanned();
      }
      return Promise.reject(error);
    }
  );
}
