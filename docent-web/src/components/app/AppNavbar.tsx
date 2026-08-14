import { Link, NavLink } from 'react-router-dom';

export default function AppNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-lg font-body-ui text-body-ui text-primary">
      <div className="flex items-center gap-lg">
        <Link to="/" className="font-headline-md text-headline-md font-bold text-primary">
          Docent
        </Link>
        <nav className="hidden gap-md md:flex">
          <a
            href="#"
            className="rounded px-2 py-1 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            Dashboard
          </a>
          <NavLink
            to="/app"
            className={({ isActive }) =>
              `rounded px-2 py-1 transition-colors hover:bg-surface-container-low ${
                isActive
                  ? 'border-b-2 border-secondary pb-1 font-bold text-secondary'
                  : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            Workspace
          </NavLink>
          <NavLink
            to="/how-it-works"
            className={({ isActive }) =>
              `rounded px-2 py-1 transition-colors hover:bg-surface-container-low ${
                isActive
                  ? 'border-b-2 border-secondary pb-1 font-bold text-secondary'
                  : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            How it works
          </NavLink>
          <a
            href="#"
            className="rounded px-2 py-1 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            Library
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-sm">
        <button
          aria-label="Notifications"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          aria-label="Settings"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
        <Link
          to="/"
          className="ml-sm flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-secondary-container text-[13px] font-bold text-white"
        >
          D
        </Link>
      </div>
    </header>
  );
}