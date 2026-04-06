import { NavLink, Outlet } from "react-router"

export function RootLayout() {
  return (
    <div className="min-h-screen bg-[var(--kvt-color-surface)]">
      <header className="border-b border-white/10 px-4 py-3">
        <nav className="mx-auto flex max-w-3xl gap-4 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "font-medium text-[var(--kvt-color-primary)]" : "text-[var(--kvt-color-on-surface-variant)]"
            }
          >
            Главная
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
