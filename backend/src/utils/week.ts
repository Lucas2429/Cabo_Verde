// La "semana" del podio va de lunes 00:00 a domingo 23:59 en hora de Chile.
// Se usa la zona horaria de Santiago (y no la del servidor) para que la semana
// cambie a la medianoche de los usuarios sin importar dónde corra el backend
// (un servidor en UTC la cambiaría 3 o 4 horas antes de tiempo).
export const WEEK_TIMEZONE = "America/Santiago";

const DAYS_SINCE_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TIMEZONE,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

// Fecha y hora que marca el reloj en Santiago para un instante dado.
const wallClock = (instant: number) => {
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Algunos motores devuelven "24" a medianoche.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    daysSinceMonday: DAYS_SINCE_MONDAY[parts.weekday],
  };
};

// La hora de Santiago expresada como si fuera UTC (en ms). Restarle el instante
// real da el desfase horario de Santiago en ese momento.
const wallClockAsUtc = (instant: number): number => {
  const w = wallClock(instant);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
};

// Instante real que corresponde a una hora de reloj de Santiago. Se calcula en
// dos pasadas porque el desfase cambia con el horario de verano: el lunes a las
// 00:00 puede tener un desfase distinto al de "ahora" si en medio hubo cambio
// de hora (en Chile ocurre en la madrugada de un domingo).
const wallClockToInstant = (wallUtc: number): number => {
  let instant = wallUtc - (wallClockAsUtc(wallUtc) - wallUtc);
  instant = wallUtc - (wallClockAsUtc(instant) - instant);
  return instant;
};

// Semana en curso: `start` es el lunes a las 00:00 (incluido) y `end` el lunes
// siguiente a las 00:00 (excluido).
export const getCurrentWeek = (now: Date = new Date()): { start: Date; end: Date } => {
  const w = wallClock(now.getTime());
  // Date.UTC acepta días fuera de rango (0, -3, 35...) y ajusta el mes solo.
  const mondayWall = Date.UTC(w.year, w.month - 1, w.day - w.daysSinceMonday);
  const nextMondayWall = Date.UTC(w.year, w.month - 1, w.day - w.daysSinceMonday + 7);

  return {
    start: new Date(wallClockToInstant(mondayWall)),
    end: new Date(wallClockToInstant(nextMondayWall)),
  };
};
