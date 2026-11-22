import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import BlockIcon from "@mui/icons-material/Block";
import Header from "../components/Header";
import ModerationReasonModal from "../components/ModerationReasonModal";
import UserAvatar from "../components/UserAvatar";
import { useSessionExpired } from "../hooks/useSessionExpired";
import { useAdminStore } from "../stores/adminStore";
import adminService from "../services/admin";
import {
  REPORT_REASON_LABELS,
  type ReportedCommentItem,
  type ReportedMemeItem,
  type ReportedUserItem,
  type ReportEntry,
  type ReportFilter,
  type ReportReason,
  type Removal,
} from "../types/report";

type Tab = "memes" | "comments" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "memes", label: "Posts" },
  { id: "comments", label: "Comentarios" },
  { id: "users", label: "Usuarios" },
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

// Los textos de los motivos terminan en punto ("Fake news."); en etiquetas
// sueltas se ve mejor sin él.
const shortReason = (reason: ReportReason): string =>
  REPORT_REASON_LABELS[reason].replace(/\.$/, "");

// Motivo más repetido entre los reportes: se sugiere al eliminar o banear.
const topReason = (reports: ReportEntry[]): string => {
  const counts = new Map<ReportReason, number>();
  for (const report of reports) {
    counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  }
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  return top ? shortReason(top[0]) : "";
};

const describeActionError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "No se pudo conectar con el servidor.";
    switch (error.response.status) {
      case 403:
        return "No puedes moderar a otro administrador ni su contenido.";
      case 404:
        return "Esto ya no existe.";
      case 409:
        return "Esto ya fue moderado (por ejemplo, por otro administrador).";
    }
  }
  return "No se pudo completar la acción. Intenta nuevamente.";
};

// ---------------------------------------------------------------------------
// Carga de cada lista
// ---------------------------------------------------------------------------

type ListState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; items: T[] };

// Pide una lista de la administración. Cada lista se monta con una `key` que
// cambia con la pestaña y el filtro, así empieza de cero al cambiarlos. `reload`
// la vuelve a pedir (después de una acción) sin vaciarla: no hay parpadeo. Como
// toda acción puede encender o apagar una alerta, también refresca el número de
// alertas del header y de las pestañas.
function useAdminList<T>(fetcher: () => Promise<T[]>) {
  const handleSessionExpired = useSessionExpired();
  const refreshAlerts = useAdminStore((store) => store.refreshAlerts);
  const [state, setState] = useState<ListState<T>>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((items) => {
        if (!cancelled) setState({ status: "ok", items });
      })
      .catch((error) => {
        if (cancelled) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          void handleSessionExpired();
          return;
        }
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // `fetcher` y `handleSessionExpired` se recrean en cada render; la lista
    // solo debe pedirse al montarse y cuando se llama a `reload`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reload = () => {
    setReloadKey((key) => key + 1);
    void refreshAlerts();
  };

  return { state, reload };
}

// Mensajes de carga, error y lista vacía comunes a las tres pestañas.
function ListStatus<T>({
  state,
  emptyText,
  children,
}: {
  state: ListState<T>;
  emptyText: string;
  children: (items: T[]) => React.ReactNode;
}) {
  if (state.status === "loading") {
    return <p className="text-center text-gray-500 dark:text-gray-400">Cargando...</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-center text-red-600 dark:text-red-400">
        No se pudieron cargar los reportes. Intenta nuevamente.
      </p>
    );
  }
  if (state.items.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400">{emptyText}</p>;
  }
  return <>{children(state.items)}</>;
}

// ---------------------------------------------------------------------------
// Piezas compartidas por las tarjetas
// ---------------------------------------------------------------------------

function ReasonSummary({ reports }: { reports: ReportEntry[] }) {
  const counts = new Map<ReportReason, number>();
  for (const report of reports) {
    counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => (
          <span
            key={reason}
            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          >
            {shortReason(reason)} · {count}
          </span>
        ))}
    </div>
  );
}

// Cuántos reportes tiene un contenido o usuario. Las listas van de más a menos
// reportes, así que el número hace visible el orden. Si `alert` es true (el
// backend lo marcó en alerta: llegó al umbral de reportes pendientes), se
// destaca en rojo: es lo que debe revisar primero un admin y lo que enciende la
// marca del botón "Reportes" del header. El umbral lo entrega el backend.
function ReportCountBadge({ count, alert }: { count: number; alert: boolean }) {
  const threshold = useAdminStore((store) => store.alerts?.threshold);
  const noun = count === 1 ? "reporte" : "reportes";

  if (alert) {
    return (
      <span
        title={
          threshold
            ? `Tiene ${threshold} o más reportes pendientes: hay que revisarlo`
            : "Tiene muchos reportes pendientes: hay que revisarlo"
        }
        className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
      >
        Alerta · {count} {noun} pendientes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {count} {noun}
    </span>
  );
}

const STATUS_LABELS = { pending: "Pendiente", accepted: "Aceptado", dismissed: "Descartado" };

// Lista desplegable con el detalle de cada reporte (quién, cuándo y por qué).
function ReportsDetails({ reports }: { reports: ReportEntry[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
        Ver {reports.length === 1 ? "1 reporte" : `${reports.length} reportes`}
      </summary>
      <ul className="mt-2 space-y-2">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Link
                to={`/u/${encodeURIComponent(report.reporter)}`}
                className="font-semibold text-gray-800 hover:underline dark:text-gray-200"
              >
                @{report.reporter}
              </Link>{" "}
              · {formatDate(report.createdAt)} · {STATUS_LABELS[report.status]}
            </p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {shortReason(report.reason)}
            </p>
            {report.details && (
              <p className="break-words text-gray-600 dark:text-gray-400">
                “{report.details}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Aviso de una acción de moderación ya hecha: qué se hizo, quién, cuándo y por
// qué (por ejemplo "Publicación eliminada", "Usuario baneado").
function RemovalNotice({ removal, what }: { removal: Removal; what: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
      {what} por @{removal.by} el {formatDate(removal.at)}.
      {removal.reason && (
        <>
          {" "}
          <span className="font-semibold">Motivo:</span> {removal.reason}
        </>
      )}
    </p>
  );
}

// Corre una acción de moderación mostrando "ocupado" y el error si falla. Al
// terminar bien, `onChanged` vuelve a pedir la lista.
function useModerationAction(onChanged: () => void) {
  const handleSessionExpired = useSessionExpired();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(describeActionError(err));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}

// ---------------------------------------------------------------------------
// Pestaña "Posts"
// ---------------------------------------------------------------------------

function MemeReportCard({
  item,
  filter,
  onChanged,
}: {
  item: ReportedMemeItem;
  filter: ReportFilter;
  onChanged: () => void;
}) {
  const { meme, removal, reports, inAlert } = item;
  const { busy, error, run } = useModerationAction(onChanged);
  const [removing, setRemoving] = useState(false);
  const pending = filter === "pending";
  const pendingCount = reports.filter((report) => report.status === "pending").length;

  return (
    <article className="surface flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
      <a
        href={meme.image}
        target="_blank"
        rel="noreferrer"
        title="Ver imagen completa"
        className="shrink-0"
      >
        <img
          src={meme.image}
          alt={meme.content || "Meme"}
          loading="lazy"
          className="h-36 w-36 rounded-xl bg-gray-200 object-cover object-top dark:bg-gray-800 sm:h-40 sm:w-40"
        />
      </a>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="break-words font-medium text-gray-900 dark:text-gray-100">
            {meme.content}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <Link
              to={`/u/${encodeURIComponent(meme.author)}`}
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              @{meme.author}
            </Link>{" "}
            · {formatDate(meme.createdAt)} · Likes: {meme.likes} · Dislikes:{" "}
            {meme.dislikes}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ReportCountBadge
              count={inAlert ? pendingCount : reports.length}
              alert={inAlert}
            />
            {meme.commentsLocked && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                Comentarios limitados
              </span>
            )}
          </div>
        </div>

        {removal && <RemovalNotice removal={removal} what="Publicación eliminada" />}

        <ReasonSummary reports={reports} />
        <ReportsDetails reports={reports} />

        {!removal && (
          <div className="flex flex-wrap gap-2 pt-1">
            {pending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => adminService.dismissMemeReports(meme.id))}
                className="btn-secondary !px-4 !py-2"
              >
                Descartar reportes
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => adminService.setCommentsLocked(meme.id, !meme.commentsLocked))
              }
              className="btn-secondary !px-4 !py-2"
            >
              {meme.commentsLocked ? "Permitir comentarios" : "Limitar comentarios"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoving(true)}
              className="btn-danger !px-4 !py-2"
            >
              Eliminar publicación
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {removing && (
        <ModerationReasonModal
          title="¿Eliminar esta publicación?"
          description="Desaparecerá de la app para todos. Queda guardada con el motivo como registro de la moderación."
          defaultReason={topReason(reports)}
          preview={
            <img
              src={meme.image}
              alt={meme.content || "Meme"}
              className="mx-auto max-h-36 max-w-full rounded-lg object-contain"
            />
          }
          onConfirm={async (reason) => {
            await adminService.removeMeme(meme.id, reason);
            onChanged();
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </article>
  );
}

function MemesTab({ filter }: { filter: ReportFilter }) {
  const { state, reload } = useAdminList(() => adminService.getReportedMemes(filter));

  return (
    <ListStatus
      state={state}
      emptyText={
        filter === "pending"
          ? "No hay publicaciones con reportes pendientes."
          : "Todavía no hay publicaciones con reportes resueltos."
      }
    >
      {(items) => (
        <div className="space-y-4">
          {items.map((item) => (
            <MemeReportCard
              key={item.meme.id}
              item={item}
              filter={filter}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </ListStatus>
  );
}

// ---------------------------------------------------------------------------
// Pestaña "Comentarios"
// ---------------------------------------------------------------------------

function CommentReportCard({
  item,
  filter,
  onChanged,
}: {
  item: ReportedCommentItem;
  filter: ReportFilter;
  onChanged: () => void;
}) {
  const { comment, meme, removal, reports, inAlert } = item;
  const { busy, error, run } = useModerationAction(onChanged);
  const [removing, setRemoving] = useState(false);
  const pending = filter === "pending";
  const pendingCount = reports.filter((report) => report.status === "pending").length;

  return (
    <article className="surface flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
      {meme && (
        <a
          href={meme.image}
          target="_blank"
          rel="noreferrer"
          title="Ver la publicación donde está el comentario"
          className="shrink-0"
        >
          <img
            src={meme.image}
            alt={meme.content || "Meme"}
            loading="lazy"
            className="h-24 w-24 rounded-xl bg-gray-200 object-cover object-top dark:bg-gray-800"
          />
        </a>
      )}

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          {/* Texto ORIGINAL del comentario: es la evidencia que revisa el admin. */}
          <p className="break-words rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {comment.content}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <Link
              to={`/u/${encodeURIComponent(comment.author)}`}
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              @{comment.author}
            </Link>{" "}
            · {formatDate(comment.createdAt)}
            {meme?.removed && " · La publicación fue eliminada"}
          </p>
          <div className="mt-2">
            <ReportCountBadge
              count={inAlert ? pendingCount : reports.length}
              alert={inAlert}
            />
          </div>
        </div>

        {removal && <RemovalNotice removal={removal} what="Comentario eliminado" />}

        <ReasonSummary reports={reports} />
        <ReportsDetails reports={reports} />

        {!removal && pending && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => adminService.dismissCommentReports(comment.id))}
              className="btn-secondary !px-4 !py-2"
            >
              Descartar reportes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoving(true)}
              className="btn-danger !px-4 !py-2"
            >
              Eliminar comentario
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {removing && (
        <ModerationReasonModal
          title="¿Eliminar este comentario?"
          description="En la conversación quedará como “Comentario eliminado”. El texto original se guarda con el motivo como registro de la moderación."
          defaultReason={topReason(reports)}
          preview={
            <p className="break-words rounded-xl bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <span className="font-semibold">{comment.author}: </span>
              {comment.content}
            </p>
          }
          onConfirm={async (reason) => {
            await adminService.removeComment(comment.id, reason);
            onChanged();
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </article>
  );
}

function CommentsTab({ filter }: { filter: ReportFilter }) {
  const { state, reload } = useAdminList(() => adminService.getReportedComments(filter));

  return (
    <ListStatus
      state={state}
      emptyText={
        filter === "pending"
          ? "No hay comentarios con reportes pendientes."
          : "Todavía no hay comentarios con reportes resueltos."
      }
    >
      {(items) => (
        <div className="space-y-4">
          {items.map((item) => (
            <CommentReportCard
              key={item.comment.id}
              item={item}
              filter={filter}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </ListStatus>
  );
}

// ---------------------------------------------------------------------------
// Pestaña "Usuarios"
// ---------------------------------------------------------------------------

function UserReportCard({
  item,
  filter,
  onChanged,
}: {
  item: ReportedUserItem;
  filter: ReportFilter;
  onChanged: () => void;
}) {
  const { user, ban, reports, inAlert } = item;
  const { busy, error, run } = useModerationAction(onChanged);
  const [banning, setBanning] = useState(false);
  const pending = filter === "pending";
  const pendingCount = reports.filter((report) => report.status === "pending").length;

  return (
    <article className="surface flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
      <Link
        to={`/u/${encodeURIComponent(user.username)}`}
        title="Ver perfil"
        className="shrink-0"
      >
        <UserAvatar
          src={user.avatar}
          name={user.displayName}
          className="h-24 w-24 text-4xl"
        />
      </Link>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <Link
            to={`/u/${encodeURIComponent(user.username)}`}
            className="block break-words text-lg font-bold text-gray-900 hover:underline dark:text-gray-100"
          >
            {user.displayName}
          </Link>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            @{user.username} · {user.department}
          </p>
          <div className="mt-2">
            <ReportCountBadge
              count={inAlert ? pendingCount : reports.length}
              alert={inAlert}
            />
          </div>
        </div>

        {ban && <RemovalNotice removal={ban} what="Usuario baneado" />}

        <ReasonSummary reports={reports} />
        <ReportsDetails reports={reports} />

        <div className="flex flex-wrap gap-2 pt-1">
          {!ban && pending && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => adminService.dismissUserReports(user.username))}
                className="btn-secondary !px-4 !py-2"
              >
                Descartar reportes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBanning(true)}
                className="btn-danger !px-4 !py-2"
              >
                Banear usuario
              </button>
            </>
          )}
          {/* Un baneo se puede levantar (por ejemplo, si fue un error). */}
          {ban && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => adminService.unbanUser(user.username))}
              className="btn-secondary !px-4 !py-2"
            >
              Desbanear usuario
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {banning && (
        <ModerationReasonModal
          title={`¿Banear a @${user.username}?`}
          description="No podrá iniciar sesión y, si tiene la sesión abierta, se cerrará al instante. Sus publicaciones y comentarios no se eliminan. El motivo queda registrado y solo lo ven los administradores."
          defaultReason={topReason(reports)}
          confirmLabel="Banear"
          busyLabel="Baneando..."
          icon={<BlockIcon fontSize="inherit" />}
          onConfirm={async (reason) => {
            await adminService.banUser(user.username, reason);
            onChanged();
          }}
          onClose={() => setBanning(false)}
        />
      )}
    </article>
  );
}

function UsersTab({ filter }: { filter: ReportFilter }) {
  const { state, reload } = useAdminList(() => adminService.getReportedUsers(filter));

  return (
    <ListStatus
      state={state}
      emptyText={
        filter === "pending"
          ? "No hay usuarios con reportes pendientes."
          : "Todavía no hay usuarios con reportes resueltos."
      }
    >
      {(items) => (
        <div className="space-y-4">
          {items.map((item) => (
            <UserReportCard
              key={item.user.username}
              item={item}
              filter={filter}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </ListStatus>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function AdminReportsView() {
  const [tab, setTab] = useState<Tab>("memes");
  const [filter, setFilter] = useState<ReportFilter>("pending");
  // Cuántos elementos de cada pestaña están en alerta (lo calcula el backend). Se
  // muestra como una marca roja en la pestaña correspondiente.
  const alerts = useAdminStore((store) => store.alerts);

  return (
    <div className="app-bg">
      <div className="flex-1 px-3 pb-8 pt-6 sm:px-6 md:px-12 md:pt-10">
        <Header />

        <main className="surface mx-auto mt-6 min-h-64 max-w-[2000px] p-4 sm:p-6 md:mt-8 md:p-10">
          <h2 className="section-title">Reportes</h2>

          <div
            role="tablist"
            aria-label="Tipo de reporte"
            className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-6"
          >
            {TABS.map(({ id, label }) => {
              const alertCount = alerts?.[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`relative min-w-32 cursor-pointer rounded-full px-8 py-3 text-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:min-w-48 ${
                    tab === id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-4 ring-indigo-300 dark:ring-indigo-400/50"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                  }`}
                >
                  {label}
                  {alertCount > 0 && (
                    <span
                      title={`${alertCount} en alerta`}
                      aria-label={`${alertCount} en alerta`}
                      className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900"
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Las tres pestañas se pueden ver con los reportes pendientes o ya
              resueltos. */}
          <div
            role="group"
            aria-label="Estado de los reportes"
            className="mt-6 flex justify-center gap-2"
          >
            <button
              type="button"
              className="chip"
              aria-pressed={filter === "pending"}
              onClick={() => setFilter("pending")}
            >
              Pendientes
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={filter === "resolved"}
              onClick={() => setFilter("resolved")}
            >
              Resueltos
            </button>
          </div>

          <div className="mt-6">
            {/* La key reinicia la lista (vuelve a "Cargando...") al cambiar de
                pestaña o de filtro. */}
            {tab === "memes" && <MemesTab key={`memes-${filter}`} filter={filter} />}
            {tab === "comments" && (
              <CommentsTab key={`comments-${filter}`} filter={filter} />
            )}
            {tab === "users" && <UsersTab key={`users-${filter}`} filter={filter} />}
          </div>
        </main>
      </div>

      <footer className="px-4 pb-5 pt-2 text-center text-xs text-gray-500 dark:text-gray-500 sm:text-sm">
        v0.0.1 · © 2026 Cabo Verde · Todos los derechos reservados
      </footer>
    </div>
  );
}

// Solo los admins pueden entrar: lo exigen <ProtectedRoute> y <AdminRoute> en
// App.tsx. Esto es comodidad: aunque alguien llegara a esta URL, el backend
// responde 403 a todas las rutas de /api/admin.
function AdminReportsPage() {
  return <AdminReportsView />;
}

export default AdminReportsPage;
