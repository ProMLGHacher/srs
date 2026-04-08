import { NavLink, Outlet } from "react-router"

export function RootLayout() {
  return (
    <div className="min-h-screen bg-[#11141d] text-(--kvatum-on-surface)">
      <header className="sticky top-0 z-30 border-b border-black/40 bg-[#1a1d27] px-4 py-3">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 text-sm">
          <div className="rounded-md bg-[#5865f2] px-3 py-1 text-xs font-semibold tracking-wide text-white">KVATUM</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? "rounded-md bg-[#2b2d31] px-4 py-1.5 font-medium text-white"
                : "rounded-md px-4 py-1.5 text-[#b5bac1] hover:bg-[#23262d]"
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
