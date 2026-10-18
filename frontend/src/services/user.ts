import axios from "axios";
import type { MemesData } from "../types/memesData";
import type { UserProfile } from "../types/profile";
import { getStoredSession } from "./auth";

const baseUrl = "/api/users";

// Lo que devuelve el backend al editar el perfil.
export type UpdatedProfile = Pick<
  UserProfile,
  "displayName" | "description" | "avatar"
>;

interface UpdateMeData {
  displayName: string;
  description: string;
  // Archivo con la nueva foto de perfil (si no se cambia, se omite).
  avatar?: File | null;
  // true para quitar la foto actual y volver a la inicial del nombre.
  removeAvatar?: boolean;
}

// Perfil público: no requiere sesión.
const getProfile = (username: string) => {
  return axios
    .get<UserProfile>(`${baseUrl}/${encodeURIComponent(username)}`)
    .then((response) => response.data);
};

// Todos los memes de un usuario (el perfil solo trae los últimos 3). Público.
const getMemes = (username: string) => {
  return axios
    .get<MemesData[]>(`${baseUrl}/${encodeURIComponent(username)}/memes`)
    .then((response) => response.data);
};

// Edita el perfil del usuario con sesión (el backend usa la cookie para saber
// quién es y exige el token CSRF).
// Si hay foto nueva va como multipart/form-data (lleva un archivo; axios agrega
// solo el Content-Type con su boundary). Si no, se manda JSON como siempre.
const updateMe = ({ avatar, removeAvatar, ...fields }: UpdateMeData) => {
  const headers = { "X-CSRF-Token": getStoredSession()?.csrf ?? "" };

  if (avatar) {
    const formData = new FormData();
    formData.append("displayName", fields.displayName);
    formData.append("description", fields.description);
    formData.append("image", avatar);

    return axios
      .patch<UpdatedProfile>(`${baseUrl}/me`, formData, { headers })
      .then((response) => response.data);
  }

  return axios
    .patch<UpdatedProfile>(
      `${baseUrl}/me`,
      removeAvatar ? { ...fields, removeAvatar: true } : fields,
      { headers }
    )
    .then((response) => response.data);
};

export default { getProfile, getMemes, updateMe };
