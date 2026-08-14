import { Link, NavLink } from 'react-router-dom';
import NotificationsPanel from './NotificationsPanel';
import UserMenu from './UserMenu';

const NAV_LINKS = [
  { label: 'Notebooks', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'How it works', to: '/how-it-works' },
];

export default function AppNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-lg font-body-ui text-body-ui text-primary">
      <div className="flex items-center gap-lg">
        <Link to="/" className="font-headline-md text-headline-md font-bold text-primary">
          Docent
        </Link>
        <nav className="hidden gap-md md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded px-2 py-1 transition-colors hover:bg-surface-container-low ${
                  isActive
                    ? 'border-b-2 border-secondary pb-1 font-bold text-secondary'
                    : 'text-on-surface-variant hover:text-primary'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-sm">
        <NotificationsPanel />
        <Link
          to="/settings"
          aria-label="Settings"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">settings</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}