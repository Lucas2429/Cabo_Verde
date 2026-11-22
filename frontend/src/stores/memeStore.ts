import { create } from "zustand";
import memeService from "../services/meme";
import type { Department } from "../types/departments";
import type { MemeOrder, MemesData } from "../types/memesData";
import type { ReactionType } from "../types/reaction";

// Store de la galería de memes (entidad principal del proyecto). Vive fuera de
// los componentes, así que el filtro, el orden y la lista sobreviven cuando el
// usuario se va a otra página y vuelve con el botón "atrás" del navegador.
interface MemeState {
  memes: MemesData[];
  // true hasta que llega la primera respuesta del backend (muestra el esqueleto).
  loading: boolean;
  loadError: boolean;
  // Carreras seleccionadas en las categorías (vacío = todas), hashtags
  // seleccionados (vacío = no filtra) y orden de la galería. El backend filtra
  // y ordena; cada cambio vuelve a pedir la lista.
  selectedDepartments: Department[];
  selectedTags: string[];
  order: MemeOrder;
  // Reacción del usuario con sesión a cada meme: { idDelMeme: tipo }.
  myReactions: Record<string, ReactionType>;

  fetchMemes: () => Promise<void>;
  toggleDepartment: (department: Department) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  clearFilters: () => void;
  // Deja SOLO ese filtro (reemplaza lo que hubiera). Se usa al tocar un
  // hashtag o una carrera dentro del modal de un meme.
  showOnlyTag: (tag: string) => void;
  showOnlyDepartment: (department: Department) => void;
  toggleOrder: () => void;
  updateCounts: (
    memeId: string,
    counts: { likes: number; dislikes: number }
  ) => void;
  patchMeme: (memeId: string, patch: Partial<MemesData>) => void;
  removeMeme: (memeId: string) => void;
  setMyReactions: (reactions: Record<string, ReactionType>) => void;
  setMyReaction: (memeId: string, type: ReactionType | null) => void;
}

// Si el filtro cambia antes de que llegue una respuesta, la anterior se
// descarta para que no pise a la más reciente.
let lastRequestId = 0;

export const useMemeStore = create<MemeState>((set, get) => ({
  memes: [],
  loading: true,
  loadError: false,
  selectedDepartments: [],
  selectedTags: [],
  order: "newest",
  myReactions: {},

  fetchMemes: async () => {
    const requestId = ++lastRequestId;
    const { selectedDepartments, selectedTags, order } = get();
    try {
      const memes = await memeService.getAll({
        departments: selectedDepartments,
        tags: selectedTags,
        order,
      });
      if (requestId !== lastRequestId) return;
      set({ memes, loadError: false, loading: false });
    } catch {
      if (requestId !== lastRequestId) return;
      set({ loadError: true, loading: false });
    }
  },

  toggleDepartment: (department) =>
    set((state) => ({
      selectedDepartments: state.selectedDepartments.includes(department)
        ? state.selectedDepartments.filter((item) => item !== department)
        : [...state.selectedDepartments, department],
    })),

  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((item) => item !== tag)
        : [...state.selectedTags, tag],
    })),

  clearTags: () => set({ selectedTags: [] }),

  clearFilters: () => set({ selectedDepartments: [], selectedTags: [] }),
  showOnlyTag: (tag) => set({ selectedTags: [tag], selectedDepartments: [] }),

  showOnlyDepartment: (department) => set({ selectedDepartments: [department], selectedTags: [] }),

  toggleOrder: () =>
    set((state) => ({ order: state.order === "newest" ? "oldest" : "newest" })),

  updateCounts: (memeId, counts) =>
    set((state) => ({
      memes: state.memes.map((meme) =>
        meme.id === memeId ? { ...meme, ...counts } : meme
      ),
    })),

  patchMeme: (memeId, patch) =>
    set((state) => ({
      memes: state.memes.map((meme) =>
        meme.id === memeId ? { ...meme, ...patch } : meme
      ),
    })),

  removeMeme: (memeId) =>
    set((state) => ({ memes: state.memes.filter((meme) => meme.id !== memeId) })),

  setMyReactions: (reactions) => set({ myReactions: reactions }),

  setMyReaction: (memeId, type) =>
    set((state) => {
      const next = { ...state.myReactions };
      if (type) {
        next[memeId] = type;
      } else {
        delete next[memeId];
      }
      return { myReactions: next };
    }),
}));