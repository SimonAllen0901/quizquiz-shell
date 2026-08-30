import { Link, NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { to: "/", label: "題庫" },
  { to: "/favorites", label: "收藏" },
  { to: "/settings", label: "設定" },
];

export function AppLayout() {
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
        <Outlet />
      </main>
    </div>
  );
}
