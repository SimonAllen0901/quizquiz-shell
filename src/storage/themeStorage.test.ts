import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../test/memoryStorage";
import { THEME_STORAGE_KEY, createThemeStorage, resolveTheme } from "./themeStorage";
import type { StorageAdapter } from "./storageAdapter";

describe("themeStorage", () => {
  it("falls back to system for missing or invalid data", () => {
    const storage = new MemoryStorage();
    const themeStorage = createThemeStorage(storage);

    expect(themeStorage.getPreference()).toBe("system");
    storage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(themeStorage.getPreference()).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)("persists the %s preference", (theme) => {
    const storage = new MemoryStorage();
    const themeStorage = createThemeStorage(storage);

    themeStorage.setPreference(theme);

    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(theme);
    expect(themeStorage.getPreference()).toBe(theme);
  });

  it("does not throw if storage access is unavailable", () => {
    const storage: StorageAdapter = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const themeStorage = createThemeStorage(storage);

    expect(themeStorage.getPreference()).toBe("system");
    expect(() => themeStorage.setPreference("dark")).not.toThrow();
  });
});

describe("resolveTheme", () => {
  it("returns explicit themes without consulting the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("resolves system using the supplied color-scheme preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
