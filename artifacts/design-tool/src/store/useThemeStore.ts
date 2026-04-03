import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t);
      },
    }),
    { name: "sai-theme" }
  )
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light-mode");
    root.classList.remove("dark-mode");
  } else {
    root.classList.remove("light-mode");
    root.classList.add("dark-mode");
  }
}
