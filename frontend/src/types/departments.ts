export const DEPARTMENTS = [
  "Astronomía",
  "DCC",
  "Física",
  "Geofísica",
  "Geología",
  "Civil",
  "Minas",
  "Eléctrica",
  "Industrial",
  "Matemática",
  "Mecánica",
  "Química, Biotecnología y Materiales",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// Texto corto de cada carrera para las categorías de la galería. Se mantiene
// el mismo orden que DEPARTMENTS (y que backend/src/models/user.ts).
export const DEPARTMENT_SHORT_NAMES: Record<Department, string> = {
  "Astronomía": "ASTRO",
  DCC: "DCC",
  Física: "DFI",
  Geofísica: "GEOFI",
  Geología: "GEO",
  Civil: "DIC",
  Minas: "DIMIN",
  Eléctrica: "DIE",
  Industrial: "IND",
  Matemática: "DIM",
  Mecánica: "DIMEC",
  "Química, Biotecnología y Materiales": "IQBM",
};
