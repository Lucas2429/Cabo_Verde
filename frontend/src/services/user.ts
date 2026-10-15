import axios from "axios";
import type { UserProfile } from "../types/profile";
import { getStoredSession } from "./auth";

const baseUrl = "/api/users";

// Perfil público: no requiere sesión.
const getProfile = (username: string) => {
  return axios
    .get<UserProfile>(`${baseUrl}/${encodeURIComponent(username)}`)
    .then((response) => response.data);
};

// Edita el perfil del usuario con sesión (el backend usa la cookie para saber
// quién es y exige el token CSRF).
const updateMe = (data: { displayName: string; description: string }) => {
  return axios
    .patch<{ displayName: string; description: string }>(`${baseUrl}/me`, data, {
      headers: { "X-CSRF-Token": getStoredSession()?.csrf ?? "" },
    })
    .then((response) => response.data);
};

export default { getProfile, updateMe };
