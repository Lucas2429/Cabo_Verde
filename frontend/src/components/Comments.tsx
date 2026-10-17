import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import SendIcon from "@mui/icons-material/Send";
import commentService from "../services/comment";
import type { CommentData } from "../types/commentData";
import { useAuth } from "../context/auth";
import { timeAgo } from "../utils/time";

const MAX_CONTENT_LENGTH = 300;

interface CommentsProps {
  memeId: string;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo enviar el comentario. Intenta nuevamente.";
};

// Lista de comentarios del meme y formulario para escribir uno. Se monta con
// key={memeId} desde MemeModal, así el estado se reinicia al abrir otro meme.
const Comments = ({ memeId, onSessionExpired }: CommentsProps) => {
  const { username } = useAuth();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    commentService
      .getByMeme(memeId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memeId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const content = commentText.trim();
    if (content === "") return;

    setSubmitting(true);
    setError(null);
    try {
      const comment = await commentService.create(memeId, content);
      // El más nuevo va arriba, igual que lo devuelve el backend.
      setComments((prev) => [comment, ...prev]);
      setCommentText("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Comentarios
        </h4>

        {loading && <p className="text-xs text-gray-400">Cargando comentarios...</p>}
        {loadError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            No se pudieron cargar los comentarios.
          </p>
        )}
        {!loading && !loadError && comments.length === 0 && (
          <p className="text-xs text-gray-400">
            Todavía no hay comentarios. ¡Sé el primero!
          </p>
        )}

        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {comment.author[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                  {comment.author}
                </span>
                <span className="text-[10px] text-gray-400">
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-xs break-words">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {username ? (
          <>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Escribe un comentario..."
                aria-label="Escribe un comentario"
                value={commentText}
                maxLength={MAX_CONTENT_LENGTH}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-2.5 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                title="Enviar comentario"
                aria-label="Enviar comentario"
                disabled={submitting || commentText.trim() === ""}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white p-2.5 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <SendIcon fontSize="small" />
              </button>
            </form>
            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2 px-2">
                {error}
              </p>
            )}
          </>
        ) : (
          // Los invitados pueden leer, pero no escribir (el backend responde
          // 401 a cualquier comentario sin sesión).
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2.5">
            <Link
              to="/login"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 underline"
            >
              Inicia sesión
            </Link>{" "}
            para comentar.
          </p>
        )}
      </div>
    </>
  );
};

export default Comments;
