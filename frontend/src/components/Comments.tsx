import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import SendIcon from "@mui/icons-material/Send";
import SettingsIcon from "@mui/icons-material/Settings";
import ReportOutlinedIcon from "@mui/icons-material/ReportOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import commentService from "../services/comment";
import type { CommentData } from "../types/commentData";
import { useAuth } from "../context/auth";
import { timeAgo } from "../utils/time";
import {
  PENDING_REPORTS_MESSAGES,
  UNDER_REVIEW_HINT,
  isPendingReportsError,
} from "../utils/reports";
import { useUnderReview } from "../hooks/useUnderReview";
import UserAvatar from "./UserAvatar";
import ModerationReasonModal from "./ModerationReasonModal";
import ReportModal from "./ReportModal";
import adminService from "../services/admin";

const MAX_CONTENT_LENGTH = 300;

interface CommentsProps {
  memeId: string;
  // true si un admin limitó los comentarios de este meme: se pueden leer, pero
  // no escribir ni responder.
  locked: boolean;
  // Se llama si el backend responde 401 (la sesión expiró).
  onSessionExpired: () => void;
}

const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    if (isPendingReportsError(error)) {
      return PENDING_REPORTS_MESSAGES.comment;
    }
    const serverMessage = (error.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof serverMessage === "string") {
      return serverMessage;
    }
  }
  return "No se pudo enviar el comentario. Intenta nuevamente.";
};

// Sube por la cadena de padres hasta el comentario de primer nivel. Si el padre
// no está en la lista (no debería pasar), el comentario se trata como raíz.
const findRootId = (comment: CommentData, byId: Map<string, CommentData>): string => {
  let current = comment;
  const seen = new Set<string>();
  while (current.parent && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parent);
    if (!parent) break;
    current = parent;
  }
  return current.id;
};

// Lista de comentarios del meme y formulario para escribir uno. Se monta con
// key={memeId} desde MemeModal, así el estado se reinicia al abrir otro meme.
//
// Los comentarios se muestran como hilos de dos niveles: los de primer nivel
// (del más nuevo al más viejo) y, debajo de cada uno, todas sus respuestas (de
// la más vieja a la más nueva, para que se lean como una conversación). Si se
// responde a una respuesta, queda en el mismo hilo con un "@usuario" al inicio.
const Comments = ({ memeId, locked, onSessionExpired }: CommentsProps) => {
  const { username, isAdmin } = useAuth();
  const navigate = useNavigate();
  // Comentario que se está reportando (id) y comentario que un admin va a
  // eliminar por moderación.
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [moderatingComment, setModeratingComment] = useState<CommentData | null>(null);

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Comentario seleccionado para eliminar.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Indica si hay una eliminación en proceso.
  const [deleting, setDeleting] = useState(false);
  // Error al intentar eliminar.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Comentario al que se está respondiendo (null = comentario de primer nivel).
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  // Ids de los hilos con las respuestas desplegadas.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  // Mis comentarios con reportes pendientes: mientras un admin no los resuelva no
  // se pueden editar ni eliminar (el backend lo exige; esto solo bloquea los
  // botones y explica por qué). Solo se consulta si hay algún comentario propio
  // en la lista.
  const hasOwnComments =
    username !== null && comments.some((comment) => comment.author === username);
  const { commentIds: commentsUnderReview, refresh: refreshUnderReview } =
    useUnderReview(hasOwnComments);

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

  // Arma los hilos a partir de la lista plana que devuelve el backend (del más
  // nuevo al más viejo).
  const { byId, roots, repliesByRoot } = useMemo(() => {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    const roots: CommentData[] = [];
    const repliesByRoot = new Map<string, CommentData[]>();

    for (const comment of comments) {
      const rootId = findRootId(comment, byId);
      if (rootId === comment.id) roots.push(comment);
    }
    // Recorrido inverso: las respuestas quedan de la más vieja a la más nueva.
    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      const rootId = findRootId(comment, byId);
      if (rootId === comment.id) continue;
      const list = repliesByRoot.get(rootId) ?? [];
      list.push(comment);
      repliesByRoot.set(rootId, list);
    }

    return { byId, roots, repliesByRoot };
  }, [comments]);

  const startReply = (comment: CommentData) => {
    setReplyingTo(comment);
    setError(null);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const toggleThread = (rootId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const content = commentText.trim();
    if (content === "") return;

    setSubmitting(true);
    setError(null);
    try {
      const comment = await commentService.create(
        memeId,
        content,
        replyingTo?.id ?? null
      );
      // El backend entrega los comentarios del más nuevo al más viejo; se
      // respeta ese orden. Los hilos se reconstruyen en el useMemo.
      setComments((prev) => [comment, ...prev]);
      if (replyingTo) {
        // Desplegar el hilo para que se vea la respuesta recién enviada.
        const rootId = findRootId(replyingTo, byId);
        setExpanded((prev) => new Set(prev).add(rootId));
      }
      setCommentText("");
      setReplyingTo(null);
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

  const startEdit = (comment: CommentData) => {
    setEditingId(comment.id);
    setEditText(comment.content);
    setEditError(null);
  };

  const cancelEdit = () => {
    if (savingEdit) return;

    setEditingId(null);
    setEditText("");
    setEditError(null);
  };

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId || savingEdit) return;

    const content = editText.trim();

    if (!content || content.length > MAX_CONTENT_LENGTH) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      const updatedComment = await commentService.update(memeId, editingId, content);

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === updatedComment.id
            ? updatedComment
            : comment
        )
      );

      setEditingId(null);
      setEditText("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onSessionExpired();
        return;
      }

      // Si lo rechazó por reportes pendientes (se reportó con la página abierta),
      // se actualiza la lista para bloquear los botones.
      if (isPendingReportsError(err)) void refreshUnderReview();
      setEditError(describeError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const startDelete = (comment: CommentData) => {
    setDeletingId(comment.id);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    if (deleting) return;

    setDeletingId(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deletingId || deleting) return;

    const commentId = deletingId;

    setDeleting(true);
    setDeleteError(null);


    try {
      const result = await commentService.remove(memeId, commentId);

      if (result.deletionType === "hard") {
        // Sin respuestas: eliminar el comentario de la lista.
        setComments((prev) =>
          prev.filter((comment) => comment.id !== result.commentId)
        );
      } else {
        // Con respuestas: mantener el comentario marcado como eliminado.
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === result.comment.id
              ? result.comment
              : comment
          )
        );
      }

      // Cancelar una respuesta pendiente al comentario eliminado.
      if (replyingTo?.id === commentId) {
        setReplyingTo(null);
      }

      setDeletingId(null);
    }
    catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setDeletingId(null);
        onSessionExpired();
        return;
      }

      if (isPendingReportsError(err)) void refreshUnderReview();
      setDeleteError(describeError(err));
    } finally {
      setDeleting(false);
    }
  };


  // Un admin eliminó el comentario: queda en el hilo como "Comentario eliminado"
  // (igual que si lo hubiera borrado su autor y tuviera respuestas).
  const markRemoved = (commentId: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              content: "[Comentario eliminado]",
              deletedAt: new Date().toISOString(),
            }
          : comment
      )
    );
    if (replyingTo?.id === commentId) setReplyingTo(null);
    if (editingId === commentId) setEditingId(null);
  };

  // Un invitado que toca "reportar" va al login (como con los likes).
  const handleReportClick = (comment: CommentData) => {
    if (username === null) {
      navigate("/login");
      return;
    }
    setReportingCommentId(comment.id);
  };

  const renderComment = (comment: CommentData, isReply: boolean) => {
    // Responder a una respuesta deja el comentario dentro del mismo hilo, así
    // que se aclara a quién va dirigido con un "@usuario".
    const parent = comment.parent ? byId.get(comment.parent) : undefined;
    const mention = isReply && parent && parent.parent ? parent.author : null;

    const isOwner = username === comment.author;
    const isEditing = editingId === comment.id;
    const isDeleted = Boolean(comment.deletedAt);
    // Los comentarios ajenos se reportan; los admins los moderan con el
    // engranaje (que reemplaza al botón de reportar).
    const canReport = !isAdmin && !isOwner;
    const canModerate = isAdmin && !isOwner;
    // Mi comentario con reportes pendientes: no se puede editar ni eliminar.
    const underReview = isOwner && commentsUnderReview.has(comment.id);

    return (
      <div key={comment.id} className="flex gap-3">
        
        <UserAvatar
          src={comment.authorAvatar}
          name={comment.author}
          className={isReply ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              to={`/u/${encodeURIComponent(comment.author)}`}
              className="font-semibold text-xs text-gray-900 dark:text-gray-100 hover:underline"
            >
              {comment.author}
            </Link>
            <span className="text-[10px] text-gray-400">
              {timeAgo(comment.createdAt)}
            </span>
            {underReview && (
              <span
                title={UNDER_REVIEW_HINT}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
              >
                En revisión
              </span>
            )}
          </div>
          {isDeleted ? (
            <p className="mt-0.5 text-sm italic text-gray-400">
              Comentario eliminado
            </p>
          ) : isEditing ? (
            <form onSubmit={handleSaveEdit} className="mt-2 space-y-2">
              <input
                type="text"
                value={editText}
                maxLength={MAX_CONTENT_LENGTH}
                onChange={(event) => setEditText(event.target.value)}
                autoFocus
                className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-800"
              />

              {editError && (
                <p role="alert" className="text-xs text-red-500">
                  {editError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingEdit || !editText.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  {savingEdit ? "Guardando..." : "Guardar"}
                </button>

                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                  className="rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-900 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )
            : (
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 break-words">
                {mention && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    @{mention}{" "}
                  </span>
                )}
                {comment.content}
              </p>
            )}

          {!isEditing && !isDeleted && (
            <div className="mt-1 flex items-center gap-3">
              {/* Los invitados pueden leer, pero no escribir. Con los comentarios
                  limitados por un admin, nadie puede responder. */}
              {username && !locked && (
                <button
                  type="button"
                  onClick={() => startReply(comment)}
                  className="text-xs font-semibold text-gray-500 hover:text-indigo-600 cursor-pointer"
                >
                  Responder
                </button>
              )}

              {username && isOwner && (
                <>
                  <button
                    type="button"
                    title={underReview ? UNDER_REVIEW_HINT : undefined}
                    aria-disabled={underReview}
                    onClick={() => {
                      if (!underReview) startEdit(comment);
                    }}
                    className={`text-xs font-semibold text-gray-500 hover:text-indigo-600 cursor-pointer ${
                      underReview ? "!cursor-not-allowed opacity-40 hover:!text-gray-500" : ""
                    }`}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    title={underReview ? UNDER_REVIEW_HINT : undefined}
                    aria-disabled={underReview}
                    onClick={() => {
                      if (!underReview) startDelete(comment);
                    }}
                    className={`text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer ${
                      underReview ? "!cursor-not-allowed opacity-40 hover:!text-red-500" : ""
                    }`}
                  >
                    Eliminar
                  </button>
                </>
              )}

              {canReport && (
                <button
                  type="button"
                  title="Reportar comentario"
                  aria-label="Reportar comentario"
                  onClick={() => handleReportClick(comment)}
                  className="ml-auto text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                >
                  <ReportOutlinedIcon sx={{ fontSize: 18 }} />
                </button>
              )}

              {canModerate && (
                <button
                  type="button"
                  title="Moderar comentario"
                  aria-label="Moderar comentario"
                  onClick={() => setModeratingComment(comment)}
                  className="ml-auto text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <SettingsIcon sx={{ fontSize: 18 }} />
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Comentarios{comments.length > 0 && ` (${comments.length})`}
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

        {roots.map((root) => {
          const replies = repliesByRoot.get(root.id) ?? [];
          const isExpanded = expanded.has(root.id);

          return (
            <div key={root.id}>
              {renderComment(root, false)}

              {replies.length > 0 && (
                <div className="ml-4 pl-7">
                  <button
                    type="button"
                    onClick={() => toggleThread(root.id)}
                    aria-expanded={isExpanded}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <ExpandLessIcon fontSize="small" />
                    ) : (
                      <ExpandMoreIcon fontSize="small" />
                    )}
                    {isExpanded
                      ? "Ocultar respuestas"
                      : replies.length === 1
                        ? "Ver 1 respuesta"
                        : `Ver ${replies.length} respuestas`}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                      {replies.map((reply) => renderComment(reply, true))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {locked ? (
          // Un admin limitó los comentarios de este meme: se leen, pero no se
          // puede comentar (el backend también lo rechaza con 403).
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 p-3 py-5">
            Los comentarios están limitados en esta publicación.
          </p>
        ) : username ? (
          <>
            {replyingTo && (
              <div className="flex items-center justify-between gap-2 px-4 pt-2.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate">
                  Respondiendo a{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {replyingTo.author}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={cancelReply}
                  title="Cancelar respuesta"
                  aria-label="Cancelar respuesta"
                  className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  replyingTo
                    ? `Responder a ${replyingTo.author}...`
                    : "Escribe un comentario..."
                }
                aria-label={
                  replyingTo
                    ? `Responder a ${replyingTo.author}`
                    : "Escribe un comentario"
                }
                value={commentText}
                maxLength={MAX_CONTENT_LENGTH}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-2.5 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                title={replyingTo ? "Enviar respuesta" : "Enviar comentario"}
                aria-label={replyingTo ? "Enviar respuesta" : "Enviar comentario"}
                disabled={submitting || commentText.trim() === ""}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white p-2.5 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <SendIcon fontSize="small" />
              </button>
            </form>
            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 pb-3 px-5">
                {error}
              </p>
            )}
          </>
        ) : (
          // Los invitados pueden leer, pero no escribir (el backend responde
          // 401 a cualquier comentario sin sesión).
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 p-3 py-5">
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


      {/* Formulario para reportar un comentario ajeno */}
      {reportingCommentId && (
        <ReportModal
          target="comment"
          memeId={memeId}
          commentId={reportingCommentId}
          onClose={() => setReportingCommentId(null)}
        />
      )}

      {/* Un admin elimina un comentario por moderación (pide el motivo) */}
      {moderatingComment && (
        <ModerationReasonModal
          title="¿Eliminar este comentario?"
          description="En la conversación quedará como “Comentario eliminado”. El texto original se guarda con el motivo como registro de la moderación."
          preview={
            <p className="break-words rounded-xl bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <span className="font-semibold">{moderatingComment.author}: </span>
              {moderatingComment.content}
            </p>
          }
          onConfirm={async (reason) => {
            await adminService.removeComment(moderatingComment.id, reason);
            markRemoved(moderatingComment.id);
          }}
          onClose={() => setModeratingComment(null)}
        />
      )}

      {/* Ventana de confirmación para eliminar un comentario */}
      {deletingId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-comment-title"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
          >
            <h3
              id="delete-comment-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              ¿Eliminar comentario?
            </h3>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Si el comentario no tiene respuestas, se eliminará
              definitivamente. Si tiene respuestas, se mostrará como
              "Comentario eliminado" para conservar la conversación.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-3 text-sm text-red-500"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-900 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Comments;
