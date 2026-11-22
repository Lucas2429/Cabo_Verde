import { create } from "zustand";
import adminService from "../services/admin";
import type { AlertCounts } from "../types/report";

// Store de las alertas de moderación. Lo lee el header de los admins (marca en
// el botón "Reportes") y la vista de reportes (marcas en las pestañas), y la
// vista de reportes lo actualiza cuando un admin resuelve algo, así las marcas
// se apagan sin esperar al siguiente refresco.
interface AdminState {
  // Cuántos posts, comentarios y usuarios tienen `threshold` o más reportes
  // pendientes, y ese umbral. Lo calcula el backend (es la única definición del
  // umbral). null hasta que llega la primera respuesta.
  alerts: AlertCounts | null;
  // Vuelve a pedir los números al backend. Si falla, se deja el valor anterior
  // (una alerta que no se pudo actualizar es mejor que una que desaparece).
  refreshAlerts: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  alerts: null,

  refreshAlerts: async () => {
    try {
      set({ alerts: await adminService.getReportAlerts() });
    } catch {
      // Sin conexión o sesión vencida: la sesión vencida se resuelve en la
      // próxima acción que reciba un 401; aquí no hay nada que hacer.
    }
  },
}));

// Total de contenidos en alerta (posts + comentarios + usuarios): es el número
// de la marca roja del botón "Reportes".
export const totalAlerts = (alerts: AlertCounts | null): number =>
  alerts ? alerts.memes + alerts.comments + alerts.users : 0;
