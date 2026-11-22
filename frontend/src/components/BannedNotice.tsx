import BlockIcon from "@mui/icons-material/Block";
import { useAuthStore } from "../stores/authStore";

// Aviso que aparece arriba de toda la app cuando una cuenta es baneada mientras
// se está usando (el backend responde 403 "banned" y la sesión se cierra sola,
// ver services/interceptors.ts). Queda visible hasta que el usuario lo cierra,
// también si lo mandan al login. Al intentar iniciar sesión con una cuenta
// baneada, el aviso lo da el propio formulario.
function BannedNotice() {
  const banned = useAuthStore((state) => state.banned);
  const dismissBanned = useAuthStore((state) => state.dismissBanned);

  if (!banned) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"
    >
      <BlockIcon fontSize="small" />
      <p>Tu cuenta fue baneada. Ya no puedes usar la plataforma con ella.</p>
      <button
        type="button"
        onClick={dismissBanned}
        className="cursor-pointer rounded-full bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30"
      >
        Entendido
      </button>
    </div>
  );
}

export default BannedNotice;
