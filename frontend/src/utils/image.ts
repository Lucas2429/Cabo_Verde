// Debe coincidir con el límite del backend (backend/src/utils/upload.ts).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

// Devuelve un mensaje de error, o null si la imagen es válida. Es solo una
// ayuda para el usuario: el backend vuelve a validar todo.
export const validateImage = (file: File): string | null => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Formato no permitido. Usa JPG, PNG, WEBP o GIF.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `La imagen pesa ${sizeMb} MB y el máximo es ${MAX_IMAGE_MB} MB.`;
  }
  return null;
};
