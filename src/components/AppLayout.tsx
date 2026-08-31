import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { resolveTheme, type ThemePreference, type ThemeStorage } from "../storage/themeStorage";

const navigationItems = [
  { to: "/", label: "題庫" },
  { to: "/favorites", label: "收藏" },
  { to: "/settings", label: "設定" },
];

export interface AppLayoutContext {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

interface AppLayoutProps {
  themeStorage: ThemeStorage;
}

export function AppLayout({ themeStorage }: AppLayoutProps) {
  const [themePreference, setThemePreferenceState] = useState(() =>
    themeStorage.getPreference(),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    getSystemPrefersDark(),
  );

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    function handleChange(event: MediaQueryListEvent) {
      setSystemPrefersDark(event.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const resolvedTheme = resolveTheme(themePreference, systemPrefersDark);
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [systemPrefersDark, themePreference]);

  function setThemePreference(preference: ThemePreference) {
    themeStorage.setPreference(preference);
    setThemePreferenceState(preference);
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link className="brand" to="/">
          Quizquiz Shell
        </Link>
        <nav aria-label="主選單">
          {navigationItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet context={{ themePreference, setThemePreference } satisfies AppLayoutContext} />
      </main>
    </div>
  );
}

function getSystemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
