import {
  browserStorageAdapter,
  type StorageAdapter,
} from "./storageAdapter";

export const THEME_STORAGE_KEY = "quizquiz-shell-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeStorage {
  getPreference(): ThemePreference;
  setPreference(preference: ThemePreference): void;
}

export function createThemeStorage(storage: StorageAdapter): ThemeStorage {
  return {
    getPreference() {
      try {
        const value = storage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(value) ? value : "system";
      } catch {
        return "system";
      }
    },
    setPreference(preference) {
      try {
        storage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Storage failure must not crash the App.
      }
    },
  };
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export const themeStorage = createThemeStorage(browserStorageAdapter);
