import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Header from "../components/Header";
import Meme from "../components/Meme";
import MemeModal from "../components/MemeModal";
import type { MemeModerationHandlers } from "../components/MemeAdminMenu";
import EditMemeModal from "../components/EditMemeModal";
import DeleteMemeModal from "../components/DeleteMemeModal";
import userService, { type UpdatedProfile } from "../services/user";
import { useReactions } from "../hooks/useReactions";
import { useAuth } from "../context/auth";
import type { MemesData } from "../types/memesData";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  type UserProfile,
} from "../types/profile";
import { ACCEPT_ATTR, MAX_IMAGE_MB, validateImage } from "../utils/image";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ok"; profile: UserProfile };

// Cuántos memes trae el perfil por defecto (debe coincidir con
// LATEST_MEMES_LIMIT en backend/src/controllers/users.ts).
const LATEST_MEMES_COUNT = 3;

const pillClass = "info-pill";

const grayButtonClass = "btn-secondary";

const inputClass = "field";

const describeEditError = (error: unknown): string => {
  if (axios.isAxiosError(error) && error.response) {
    if (error.response.status === 413) {
      return `La imagen supera el máximo de ${MAX_IMAGE_MB} MB.`;
    }
    const message = (error.response.data as { error?: unknown } | undefined)?.error;
    if (typeof message === "string") {
      if (message.includes("displayName must be")) {
        return `El nombre debe tener entre 1 y ${MAX_DISPLAY_NAME_LENGTH} caracteres.`;
      }
      if (message.includes("description must be")) {
        return `La descripción puede tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`;
      }
      if (message.includes("image")) {
        return "La imagen no es válida. Usa JPG, PNG, WEBP o GIF.";
      }
    }
  } else if (axios.isAxiosError(error)) {
    return "No se pudo conectar con el servidor.";
  }
  return "No se pudo guardar. Intenta nuevamente.";
};

// Foto de perfil; si el usuario no tiene, se muestra la inicial de su nombre.
function Avatar({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "w-44 h-44 md:w-56 md:h-56 border-4 shadow-xl shadow-indigo-500/20"
      : "w-24 h-24 border-4";
  const letterClass = size === "lg" ? "text-8xl md:text-9xl" : "text-5xl";

  if (src) {
    return (
      <img
        src={src}
        alt={`Foto de perfil de ${name}`}
        className={`${sizeClass} shrink-0 rounded-full border-indigo-500 bg-indigo-500 object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} ${letterClass} shrink-0 rounded-full border-indigo-500 bg-indigo-500 text-white flex items-center justify-center font-display leading-none select-none`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface EditFormProps {
  profile: UserProfile;
  onSaved: (data: UpdatedProfile) => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}

// Formulario para editar la foto, el nombre a mostrar y la descripción (solo en
// el perfil propio).
function ProfileEditForm({ profile, onSaved, onCancel, onSessionExpired }: EditFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [description, setDescription] = useState(profile.description);
  // Foto nueva elegida (aún sin subir) y su vista previa local.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // true si el usuario pidió quitar la foto que ya tenía.
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Vista previa local de la foto elegida; se libera la URL al cambiarla.
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const shownAvatar = avatarPreview ?? (removeAvatar ? null : profile.avatar);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se limpia el input para poder elegir de nuevo el mismo archivo.
    event.target.value = "";
    if (!file) return;

    const problem = validateImage(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setRemoveAvatar(profile.avatar !== null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const saved = await userService.updateMe({
        displayName: displayName.trim(),
        description: description.trim(),
        avatar: avatarFile,
        removeAvatar,
      });
      onSaved(saved);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }
      setError(describeEditError(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
      <div>
        <span className="field-label mb-2">
          Foto de perfil
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={shownAvatar} name={displayName || profile.username} size="md" />
          <div className="flex flex-col items-start gap-2">
            <input
              id="avatar"
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleFileChange}
              disabled={saving}
              className="sr-only peer"
            />
            <label
              htmlFor="avatar"
              className="btn-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 !px-5 !py-2"
            >
              {shownAvatar ? "Cambiar foto" : "Subir foto"}
            </label>
            {shownAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={saving}
                className="cursor-pointer text-sm font-semibold text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          JPG, PNG, WEBP o GIF · máximo {MAX_IMAGE_MB} MB
          {avatarFile && ` · ${avatarFile.name}`}
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className="field-label">
          Nombre a mostrar
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          required
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Puede repetirse. Tu @{profile.username} es único y no cambia.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="field-label">
          Descripción
        </label>
        <textarea
          id="description"
          value={description}
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} resize-none`}
        />
        <p className="mt-1 text-right text-[11px] text-gray-500 dark:text-gray-400">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={grayButtonClass}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ProfileView({ username }: { username: string }) {
  const { username: currentUser, logout, setAvatar: setSessionAvatar } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  // Se guarda solo el id (y no una copia del meme) para que los modales
  // siempre muestren los datos actualizados del perfil (likes, descripción...).
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  const [editingMemeId, setEditingMemeId] = useState<string | null>(null);
  const [deletingMemeId, setDeletingMemeId] = useState<string | null>(null);

  // Todas las publicaciones del usuario. Es null hasta que se pide "mostrar
  // todas": el perfil solo trae las últimas 3 y el resto se carga a demanda.
  const [allMemes, setAllMemes] = useState<MemesData[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allError, setAllError] = useState(false);

  const latestMemes = state.status === "ok" ? state.profile.latestMemes : [];
  const isOwnProfile = state.status === "ok" && currentUser === state.profile.username;

  const findMeme = (id: string | null): MemesData | null =>
    id === null
      ? null
      : allMemes?.find((meme) => meme.id === id) ??
        latestMemes.find((meme) => meme.id === id) ??
        null;

  const selectedMeme = findMeme(selectedMemeId);
  // Editar y eliminar solo existen en el perfil propio.
  const memeToEdit = isOwnProfile ? findMeme(editingMemeId) : null;
  const memeToDelete = isOwnProfile ? findMeme(deletingMemeId) : null;

  // SOLO FRONTEND: los reportes no existen en el backend. Estos valores viven
  // en memoria y se reinician al recargar o cambiar de perfil.
  const [reportsReceived, setReportsReceived] = useState(0);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    userService
      .getProfile(username)
      .then((profile) => {
        if (!cancelled) setState({ status: "ok", profile });
      })
      .catch((error) => {
        if (cancelled) return;
        const notFound = axios.isAxiosError(error) && error.response?.status === 404;
        setState({ status: notFound ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Aplica el mismo cambio a las dos listas de memes (las últimas 3 del perfil
  // y, si ya se cargó, la lista completa) para que siempre queden iguales.
  const updateMemes = (change: (memes: MemesData[]) => MemesData[]) => {
    setState((prev) =>
      prev.status === "ok"
        ? {
            status: "ok",
            profile: { ...prev.profile, latestMemes: change(prev.profile.latestMemes) },
          }
        : prev
    );
    setAllMemes((prev) => (prev ? change(prev) : prev));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleSessionExpired = async () => {
    setSelectedMemeId(null);
    setEditingMemeId(null);
    setDeletingMemeId(null);
    await logout();
    navigate("/login");
  };

  // Like / dislike (lógica compartida con la galería). Aquí solo se indica cómo
  // actualizar los totales dentro de los memes del perfil.
  const { myReactions, handleReact } = useReactions({
    onCountsChange: (memeId, counts) =>
      updateMemes((memes) =>
        memes.map((meme) => (meme.id === memeId ? { ...meme, ...counts } : meme))
      ),
    onSessionExpired: handleSessionExpired,
  });

  const handleReport = () => {
    setReported(true);
    setReportsReceived((n) => n + 1);
  };

  // "Mostrar todas": la primera vez trae la lista completa del backend; después
  // solo alterna entre ver todas y ver las últimas.
  const handleShowAll = async () => {
    if (allMemes) {
      setShowAll(true);
      return;
    }

    setLoadingAll(true);
    setAllError(false);
    try {
      setAllMemes(await userService.getMemes(username));
      setShowAll(true);
    } catch {
      setAllError(true);
    } finally {
      setLoadingAll(false);
    }
  };

  const handleMemeUpdated = (updated: MemesData) => {
    updateMemes((memes) =>
      memes.map((meme) => (meme.id === updated.id ? { ...meme, ...updated } : meme))
    );
  };

  const handleMemeDeleted = (memeId: string) => {
    updateMemes((memes) => memes.filter((meme) => meme.id !== memeId));
    setState((prev) =>
      prev.status === "ok"
        ? {
            status: "ok",
            profile: {
              ...prev.profile,
              memesCount: Math.max(0, prev.profile.memesCount - 1),
            },
          }
        : prev
    );
    // Si se borró uno de los últimos 3, el siguiente meme pasa a ocupar su
    // lugar: se vuelve a pedir el perfil para rellenar la lista y el contador.
    userService
      .getProfile(username)
      .then((profile) => setState({ status: "ok", profile }))
      .catch(() => {
        // Si falla, queda la lista ya filtrada en pantalla.
      });
  };

  // Lo que hace un admin desde el engranaje: un meme eliminado por moderación
  // se trata igual que uno borrado por su autor (sale de las listas, baja el
  // contador y se rellena el perfil); limitar comentarios solo cambia el meme.
  const moderation: MemeModerationHandlers = {
    onRemoved: handleMemeDeleted,
    onUpdated: (memeId, patch) =>
      updateMemes((memes) =>
        memes.map((meme) => (meme.id === memeId ? { ...meme, ...patch } : meme))
      ),
  };

  const renderContent = () => {
    if (state.status === "loading") {
      return <p className="text-center text-gray-500 dark:text-gray-400">Cargando perfil...</p>;
    }
    if (state.status === "not-found") {
      return (
        <p className="text-center text-gray-500 dark:text-gray-400">
          No existe ningún usuario con el nombre @{username}.
        </p>
      );
    }
    if (state.status === "error") {
      return (
        <p className="text-center text-gray-500 dark:text-gray-400">
          No se pudo cargar el perfil. ¿Está corriendo el backend?
        </p>
      );
    }

    const { profile } = state;
    const visibleMemes = showAll && allMemes ? allMemes : profile.latestMemes;
    // Hay más publicaciones que las que se ven, o ya se están viendo todas (y
    // son más de las que mostraría el perfil por defecto).
    const canToggleAll = showAll
      ? visibleMemes.length > LATEST_MEMES_COUNT
      : profile.memesCount > profile.latestMemes.length;

    return (
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Columna izquierda: avatar y datos del usuario. */}
        <aside className="md:w-80 shrink-0 flex flex-col items-center gap-4">
          <Avatar src={profile.avatar} name={profile.displayName} size="lg" />

          {/* Departamento del usuario ("Sin especificar" en las cuentas antiguas). */}
          <div className={pillClass}>Departamento: {profile.department}</div>

          <div className={profile.description ? pillClass : `${pillClass} !font-normal text-gray-500 dark:!text-gray-400`}>
            {profile.description || "Sin descripción"}
          </div>
          <div className={pillClass}>Reportes recibidos: {reportsReceived}</div>
          <div className={pillClass}>Publicaciones: {profile.memesCount}</div>
        </aside>

        {/* Columna derecha: nombre, acciones y publicaciones. */}
        <section className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <ProfileEditForm
                  profile={profile}
                  onCancel={() => setEditing(false)}
                  onSessionExpired={handleSessionExpired}
                  onSaved={(saved) => {
                    setState({ status: "ok", profile: { ...profile, ...saved } });
                    // El formulario solo existe en el perfil propio: se actualiza
                    // también la foto del banner.
                    setSessionAvatar(saved.avatar);
                    setEditing(false);
                  }}
                />
              ) : (
                <>
                  <h2 className="break-words text-4xl font-bold text-gray-900 dark:text-gray-100 sm:text-5xl">
                    {profile.displayName}
                  </h2>
                  <p className="mt-1 break-all text-2xl text-indigo-600 dark:text-indigo-400">
                    @{profile.username}
                  </p>
                </>
              )}
            </div>

            {!editing && (
              <div className="flex flex-wrap items-center gap-3">
                {isOwnProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className={grayButtonClass}
                    >
                      Editar perfil
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex cursor-pointer items-center gap-1.5 font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      <LogoutIcon fontSize="small" />
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={reported}
                    className={grayButtonClass}
                  >
                    {reported ? "Usuario reportado" : "Reportar usuario"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h3 className="section-title !text-2xl md:!text-3xl">
                {showAll ? "Todas las publicaciones" : "Últimas publicaciones"}
              </h3>

              {canToggleAll && (
                <button
                  type="button"
                  onClick={showAll ? () => setShowAll(false) : handleShowAll}
                  disabled={loadingAll}
                  aria-expanded={showAll}
                  className={`${grayButtonClass} flex items-center gap-1.5`}
                >
                  {showAll ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  {showAll
                    ? "Mostrar menos"
                    : loadingAll
                      ? "Cargando..."
                      : `Mostrar todas (${profile.memesCount})`}
                </button>
              )}
            </div>

            {allError && (
              <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
                No se pudieron cargar todas las publicaciones. Intenta nuevamente.
              </p>
            )}

            {visibleMemes.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                {isOwnProfile
                  ? "Todavía no has publicado nada."
                  : "Este usuario todavía no ha publicado nada."}
              </p>
            ) : (
              // Mismo formato que la galería del Home: columnas de ~16rem que
              // se adaptan al ancho disponible y apilan los memes de cualquier
              // tamaño sin dejar huecos entre filas ni recortarlos.
              <div className="columns-2xs gap-5">
                {visibleMemes.map((meme) => (
                  <div
                    key={meme.id}
                    className="mb-5 break-inside-avoid"
                    onClick={() => setSelectedMemeId(meme.id)}
                  >
                    <Meme
                      meme={meme}
                      reaction={myReactions[meme.id] ?? null}
                      onReact={(type) => handleReact(meme.id, type)}
                      // Solo en el perfil propio aparecen ⋮ (editar) y el
                      // basurero (eliminar).
                      onEdit={isOwnProfile ? () => setEditingMemeId(meme.id) : undefined}
                      onDelete={isOwnProfile ? () => setDeletingMemeId(meme.id) : undefined}
                      moderation={moderation}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="app-bg">
      <div className="flex-1 px-3 sm:px-6 md:px-12 pt-6 md:pt-10 pb-8">
        <Header />

        <main className="surface mx-auto mt-6 min-h-64 max-w-[2000px] p-4 sm:p-6 md:mt-8 md:p-10">
          {renderContent()}
        </main>

        <MemeModal
          meme={selectedMeme}
          reaction={selectedMeme ? myReactions[selectedMeme.id] ?? null : null}
          onReact={(type) => {
            if (selectedMeme) handleReact(selectedMeme.id, type);
          }}
          onClose={() => setSelectedMemeId(null)}
          onSessionExpired={handleSessionExpired}
          moderation={moderation}
        />

        {memeToEdit && (
          <EditMemeModal
            // El key reinicia el formulario si se edita otro meme.
            key={memeToEdit.id}
            meme={memeToEdit}
            onClose={() => setEditingMemeId(null)}
            onUpdated={handleMemeUpdated}
            onSessionExpired={handleSessionExpired}
          />
        )}

        {memeToDelete && (
          <DeleteMemeModal
            key={memeToDelete.id}
            meme={memeToDelete}
            onClose={() => setDeletingMemeId(null)}
            onDeleted={handleMemeDeleted}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </div>

      <footer className="px-4 pb-5 pt-2 text-center text-xs text-gray-500 dark:text-gray-500 sm:text-sm">
        v0.0.1 · © 2026 Cabo Verde · Todos los derechos reservados
      </footer>
    </div>
  );
}

function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  if (!username) return <Navigate to="/" replace />;
  // La key reinicia todo el estado (carga, edición, reportes) al pasar de un
  // perfil a otro sin recargar la página.
  return <ProfileView key={username} username={username} />;
}

export default ProfilePage;
