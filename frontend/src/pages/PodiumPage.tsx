import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import MemeModal from "../components/MemeModal";
import PodiumGroupModal from "../components/PodiumGroupModal";
import PodiumStack from "../components/PodiumStack";
import memeService from "../services/meme";
import { useReactions } from "../hooks/useReactions";
import { useAuth } from "../context/auth";
import type { PodiumPosition, WeeklyPodium } from "../types/podium";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: WeeklyPodium };

// Misma zona horaria con la que el backend calcula la semana: así las fechas
// coinciden aunque el navegador esté en otro país.
const WEEK_TIMEZONE = "America/Santiago";

const formatDay = (date: Date): string =>
  date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: WEEK_TIMEZONE,
  });

// "Semana del 12 de octubre al 18 de octubre". weekEnd es el lunes siguiente a
// las 00:00, así que se retrocede un minuto para caer en el domingo.
const formatWeek = ({ weekStart, weekEnd }: WeeklyPodium): string => {
  const lastDay = new Date(new Date(weekEnd).getTime() - 60_000);
  return `Semana del ${formatDay(new Date(weekStart))} al ${formatDay(lastDay)}`;
};

// En pantallas grandes el podio se arma como uno de verdad: el 1.º al centro y
// arriba, el 2.º a la izquierda y el 3.º a la derecha, cada uno más abajo. En
// el celular quedan uno debajo del otro, en orden.
const POSITION_LAYOUT: Record<number, string> = {
  1: "md:order-2",
  2: "md:order-1 md:mt-24",
  3: "md:order-3 md:mt-44",
};

function PodiumPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Puesto con la ventana de empatados abierta (null = ninguna).
  const [openPosition, setOpenPosition] = useState<number | null>(null);
  // Se guarda solo el id (y no una copia del meme) para que el modal siempre
  // muestre los likes y dislikes actualizados.
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  // Se pone en true cuando el usuario reacciona a algún meme: el podio hay que
  // volver a pedirlo (la reacción puede cambiar quién está en cada puesto).
  const needsRefresh = useRef(false);

  const podium = state.status === "ok" ? state.data.podium : [];
  const selectedMeme =
    podium.flatMap((group) => group.memes).find((meme) => meme.id === selectedMemeId) ??
    null;
  const openGroup = podium.find((group) => group.position === openPosition) ?? null;

  useEffect(() => {
    let cancelled = false;
    memeService
      .getPodium()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si se reaccionó a algo, se actualiza el podio cuando el usuario cierra todas
  // las ventanas. Hacerlo antes reordenaría las tarjetas mientras mira un meme,
  // o cerraría el meme si justo sale del podio.
  useEffect(() => {
    if (openPosition !== null || selectedMemeId !== null) return;
    if (!needsRefresh.current) return;
    needsRefresh.current = false;

    memeService
      .getPodium()
      .then((data) => setState({ status: "ok", data }))
      .catch(() => {
        // Si falla se deja el podio que ya estaba en pantalla.
      });
  }, [openPosition, selectedMemeId]);

  const handleSessionExpired = async () => {
    setOpenPosition(null);
    setSelectedMemeId(null);
    await logout();
    navigate("/login");
  };

  // Like / dislike (lógica compartida con la galería y el perfil). Aquí solo se
  // indica cómo actualizar los totales dentro del podio.
  const { myReactions, handleReact } = useReactions({
    onCountsChange: (memeId, counts) => {
      needsRefresh.current = true;
      setState((prev) =>
        prev.status === "ok"
          ? {
              status: "ok",
              data: {
                ...prev.data,
                podium: prev.data.podium.map((group) => ({
                  ...group,
                  memes: group.memes.map((meme) =>
                    meme.id === memeId ? { ...meme, ...counts } : meme
                  ),
                })),
              },
            }
          : prev
      );
    },
    onSessionExpired: handleSessionExpired,
  });

  // Un puesto con un solo meme abre el meme directo; con empate, abre la
  // ventana con todos.
  const handleOpen = (group: PodiumPosition) => {
    if (group.memes.length === 1) {
      setSelectedMemeId(group.memes[0].id);
    } else {
      setOpenPosition(group.position);
    }
  };

  const renderContent = () => {
    if (state.status === "loading") {
      return <p className="mt-10 text-center text-gray-500">Cargando podio...</p>;
    }
    if (state.status === "error") {
      return (
        <p className="mt-10 text-center text-gray-500">
          No se pudo cargar el podio. ¿Está corriendo el backend?
        </p>
      );
    }
    if (state.data.podium.length === 0) {
      return (
        <p className="mt-10 text-center text-gray-500">
          Todavía no hay memes con likes esta semana.{" "}
          <Link to="/" className="text-indigo-600 underline hover:text-indigo-800">
            ¡Ve a darle like a alguno!
          </Link>
        </p>
      );
    }

    return (
      <>
        {/* El padding izquierdo deja lugar a las tarjetas de atrás de las pilas. */}
        <div className="mt-10 flex flex-col md:flex-row items-center md:items-start justify-center gap-14 md:gap-16 lg:gap-28 pl-8 pb-8">
          {state.data.podium.map((group) => (
            <div key={group.position} className={POSITION_LAYOUT[group.position]}>
              <PodiumStack group={group} onOpen={() => handleOpen(group)} />
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Cuentan los memes publicados esta semana, de lunes a domingo. Si varios
          memes tienen los mismos likes, comparten puesto.
        </p>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#52648a] flex flex-col">
      <div className="flex-1 px-3 sm:px-6 md:px-12 pt-6 md:pt-10 pb-8">
        <Header />

        <main className="max-w-[2000px] mx-auto mt-6 md:mt-8 bg-white rounded-[30px] md:rounded-[50px] border-[6px] border-[#b4b4b4] p-4 sm:p-6 md:p-10 min-h-64">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h2 className="inline-block bg-[#b4b4b4] text-black font-display text-3xl md:text-4xl tracking-wide rounded-full px-8 py-3">
              Podio de la Semana
            </h2>
            {state.status === "ok" && (
              <p className="text-sm text-gray-500">{formatWeek(state.data)}</p>
            )}
          </div>

          {renderContent()}
        </main>

        {openGroup && (
          <PodiumGroupModal
            group={openGroup}
            myReactions={myReactions}
            onReact={handleReact}
            onSelectMeme={setSelectedMemeId}
            onClose={() => setOpenPosition(null)}
            closeOnEscape={selectedMemeId === null}
          />
        )}

        {/* Va después de la ventana de empatados para quedar encima de ella. */}
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

export default PodiumPage;
