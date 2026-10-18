import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import Header from "../components/Header";
import Meme from "../components/Meme";
import MemeModal from "../components/MemeModal";
import userService from "../services/user";
import { useReactions } from "../hooks/useReactions";
import { useAuth } from "../context/auth";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  type UserProfile,
} from "../types/profile";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ok"; profile: UserProfile };

const pillClass =
  "bg-[#b4b4b4] text-black font-semibold rounded-[30px] px-6 py-4 text-center w-full break-words";

const grayButtonClass =
  "bg-[#b4b4b4] hover:bg-[#868686] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#b4b4b4] text-black font-semibold rounded-full px-6 py-3 transition-colors cursor-pointer shadow-md";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

const describeEditError = (error: unknown): string => {
  if (axios.isAxiosError(error) && error.response) {
    const message = (error.response.data as { error?: unknown } | undefined)?.error;
    if (typeof message === "string") {
      if (message.includes("displayName must be")) {
        return `El nombre debe tener entre 1 y ${MAX_DISPLAY_NAME_LENGTH} caracteres.`;
      }
      if (message.includes("description must be")) {
        return `La descripción puede tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`;
      }
    }
  } else if (axios.isAxiosError(error)) {
    return "No se pudo conectar con el servidor.";
  }
  return "No se pudo guardar. Intenta nuevamente.";
};

interface EditFormProps {
  profile: UserProfile;
  onSaved: (data: { displayName: string; description: string }) => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}

// Formulario para editar el nombre a mostrar y la descripción (solo en el
// perfil propio).
function ProfileEditForm({ profile, onSaved, onCancel, onSessionExpired }: EditFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [description, setDescription] = useState(profile.description);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const saved = await userService.updateMe({
        displayName: displayName.trim(),
        description: description.trim(),
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
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
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
        <p className="text-[11px] text-gray-500 mt-1">
          Puede repetirse. Tu @{profile.username} es único y no cambia.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
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
        <p className="text-[11px] text-gray-500 mt-1 text-right">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#5a6c8a] hover:bg-[#485770] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
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
  const { username: currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  // Se guarda solo el id (y no una copia del meme) para que el modal siempre
  // muestre los likes y dislikes actualizados del perfil.
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);

  const selectedMeme =
    state.status === "ok"
      ? state.profile.latestMemes.find((meme) => meme.id === selectedMemeId) ?? null
      : null;

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

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleSessionExpired = async () => {
    setSelectedMemeId(null);
    await logout();
    navigate("/login");
  };

  // Like / dislike (lógica compartida con la galería). Aquí solo se indica cómo
  // actualizar los totales dentro de los memes del perfil.
  const { myReactions, handleReact } = useReactions({
    onCountsChange: (memeId, counts) =>
      setState((prev) =>
        prev.status === "ok"
          ? {
              status: "ok",
              profile: {
                ...prev.profile,
                latestMemes: prev.profile.latestMemes.map((meme) =>
                  meme.id === memeId ? { ...meme, ...counts } : meme
                ),
              },
            }
          : prev
      ),
    onSessionExpired: handleSessionExpired,
  });

  const handleReport = () => {
    setReported(true);
    setReportsReceived((n) => n + 1);
  };

  const renderContent = () => {
    if (state.status === "loading") {
      return <p className="text-center text-gray-500">Cargando perfil...</p>;
    }
    if (state.status === "not-found") {
      return (
        <p className="text-center text-gray-500">
          No existe ningún usuario con el nombre @{username}.
        </p>
      );
    }
    if (state.status === "error") {
      return (
        <p className="text-center text-gray-500">
          No se pudo cargar el perfil. ¿Está corriendo el backend?
        </p>
      );
    }

    const { profile } = state;
    const isOwnProfile = currentUser === profile.username;

    return (
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Columna izquierda: avatar y datos del usuario. */}
        <aside className="md:w-80 shrink-0 flex flex-col items-center gap-4">
          <div
            aria-hidden="true"
            className="w-44 h-44 md:w-56 md:h-56 rounded-full border-[6px] border-black bg-[#5a6c8a] text-white flex items-center justify-center font-display text-8xl md:text-9xl leading-none select-none"
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </div>

          <div className={profile.description ? pillClass : `${pillClass} text-gray-600`}>
            {profile.description || "Sin descripción"}
          </div>
          <div className={pillClass}>Reportes recibidos: {reportsReceived}</div>
          <div className={pillClass}>Publicaciones: {profile.memesCount}</div>
        </aside>

        {/* Columna derecha: nombre, acciones y últimas publicaciones. */}
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
                    setEditing(false);
                  }}
                />
              ) : (
                <>
                  <h2 className="text-4xl sm:text-5xl font-bold text-black break-words">
                    {profile.displayName}
                  </h2>
                  <p className="text-2xl text-gray-700 mt-1 break-all">
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
                      className="flex items-center gap-1.5 text-red-600 font-semibold hover:underline cursor-pointer"
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
            <h3 className="inline-block bg-[#b4b4b4] text-black font-semibold rounded-full px-8 py-4 mb-6">
              Últimas publicaciones
            </h3>

            {profile.latestMemes.length === 0 ? (
              <p className="text-gray-500">
                {isOwnProfile
                  ? "Todavía no has publicado nada."
                  : "Este usuario todavía no ha publicado nada."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
                {profile.latestMemes.map((meme) => (
                  <div key={meme.id} onClick={() => setSelectedMemeId(meme.id)}>
                    <Meme
                      meme={meme}
                      reaction={myReactions[meme.id] ?? null}
                      onReact={(type) => handleReact(meme.id, type)}
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
    <div className="min-h-screen bg-[#52648a] flex flex-col">
      <div className="flex-1 px-3 sm:px-6 md:px-12 pt-6 md:pt-10 pb-8">
        <Header />

        <main className="max-w-[2000px] mx-auto mt-6 md:mt-8 bg-white rounded-[30px] md:rounded-[50px] border-[6px] border-[#b4b4b4] p-4 sm:p-6 md:p-10 min-h-64">
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
        />
      </div>

      <footer className="px-4 pb-3 text-xs sm:text-sm font-bold text-white">
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
