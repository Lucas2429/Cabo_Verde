import type { PodiumPosition } from "../types/podium";

interface Props {
  group: PodiumPosition;
  // Un clic abre el meme (si es uno solo) o la ventana con todos los que
  // empataron en este puesto. Lo decide la página.
  onOpen: () => void;
}

const ORDINALS = ["Primer", "Segundo", "Tercer"];

// Cuanto más arriba en el podio, más grande la tarjeta.
const CARD_SIZE: Record<number, string> = {
  1: "w-60 md:w-80",
  2: "w-52 md:w-64",
  3: "w-44 md:w-56",
};

const MEDAL_COLOR: Record<number, string> = {
  1: "bg-amber-400 border-amber-600 text-amber-900",
  2: "bg-gray-300 border-gray-500 text-gray-600",
  3: "bg-[#cd7f32] border-[#8b4a1c] text-[#5c2f0f]",
};

// Máximo de tarjetas visibles en la pila; los demás empatados se ven al abrirla.
const MAX_STACKED = 3;

// Cada tarjeta de la pila tiene su posición de reposo y su animación al pasar el
// mouse. Son strings completos (no se arman con variables) para que Tailwind los
// detecte.
//  - Una sola tarjeta (sin empate): se levanta y se inclina un poco.
//  - Pila: la tarjeta de adelante sube y las de atrás se abren como abanico.
const layerClass = (index: number, isStack: boolean): string => {
  if (index === 0) {
    return isStack
      ? "z-30 group-hover:translate-x-3 group-hover:-translate-y-3 group-hover:scale-[1.03]"
      : "z-30 group-hover:-translate-y-2 group-hover:scale-105 group-hover:rotate-2";
  }
  if (index === 1) {
    return "z-20 -translate-x-4 translate-y-4 group-hover:-translate-x-9 group-hover:translate-y-5 group-hover:-rotate-6";
  }
  return "z-10 -translate-x-8 translate-y-8 group-hover:-translate-x-[4.5rem] group-hover:translate-y-9 group-hover:-rotate-12";
};

// Un puesto del podio. Si hay empate se muestra como una pila de tarjetas (una
// por meme, hasta 3) que se abre en abanico al pasar el mouse.
const PodiumStack = ({ group, onOpen }: Props) => {
  const { position, likes, memes } = group;
  const isStack = memes.length > 1;
  const layers = memes.slice(0, MAX_STACKED);

  const ordinal = ORDINALS[position - 1] ?? `${position}.º`;
  const likesText = `${likes} ${likes === 1 ? "like" : "likes"}`;
  const label = isStack
    ? `${ordinal} lugar: ${memes.length} memes empatados con ${likesText}. Ver todos`
    : `${ordinal} lugar: 1 meme con ${likesText}. Ver meme`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={isStack ? "Ver los memes empatados" : "Ver meme"}
      className="group flex flex-col items-center rounded-[22px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-indigo-500"
    >
      <div className={`relative aspect-square ${CARD_SIZE[position] ?? "w-44"}`}>
        {layers.map((meme, index) => (
          <div
            key={meme.id}
            aria-hidden="true"
            className={`absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${layerClass(
              index,
              isStack
            )}`}
          >
            <div
              className={`h-full w-full overflow-hidden rounded-[22px] border-4 border-white bg-gray-300 shadow-lg transition-[filter,box-shadow] duration-300 group-hover:shadow-2xl ${
                index > 0 ? "brightness-90 group-hover:brightness-100" : ""
              }`}
            >
              <img
                src={meme.image}
                alt=""
                draggable={false}
                decoding="async"
                // Se muestra la parte de arriba, donde suele ir el texto del meme.
                className="h-full w-full object-cover object-top"
              />
            </div>

            {/* Lo que va solo en la tarjeta de adelante. */}
            {index === 0 && (
              <>
                {isStack && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                    {memes.length} memes
                  </span>
                )}

                {/* Medalla con cintas, sobre la esquina inferior derecha. */}
                <div className="absolute -bottom-4 -right-4 h-12 w-12">
                  <span className="absolute left-1.5 top-9 h-8 w-3.5 -rotate-12 bg-red-800 [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" />
                  <span className="absolute right-1.5 top-9 h-8 w-3.5 rotate-12 bg-red-800 [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" />
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] font-display text-3xl leading-none shadow-md ${
                      MEDAL_COLOR[position] ?? MEDAL_COLOR[3]
                    }`}
                  >
                    {position}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Más margen en las pilas: las tarjetas de atrás sobresalen por abajo. */}
      <span
        className={`${
          isStack ? "mt-12" : "mt-6"
        } rounded-full bg-[#b4b4b4] px-6 py-2 text-lg font-semibold text-black shadow-md transition-colors group-hover:bg-[#868686]`}
      >
        {likesText}
      </span>
    </button>
  );
};

export default PodiumStack;
