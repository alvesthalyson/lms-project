import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (variant: ToastVariant, message: string, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (variant, message, durationMs = 5000) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, variant, message }] }));
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React (mutation cache, interceptors). */
export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message, 8000),
  info: (message: string) => useToastStore.getState().push("info", message),
};
