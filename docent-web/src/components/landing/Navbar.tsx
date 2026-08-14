import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NotificationsPanel from '../app/NotificationsPanel';
import UserMenu from '../app/UserMenu';

const NAV_LINKS = [
  { label: 'Notebooks', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'How it works', to: '/how-it-works' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-lg transition-all duration-300 ${
        scrolled || open
          ? 'glass-panel border-b border-outline-variant/80'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="flex items-center gap-md">
        <Link to="/" className="font-headline-md text-headline-md font-bold text-primary">
          Docent
        </Link>
        <div className="ml-xl hidden gap-md md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-sm">
        <NotificationsPanel />
        <Link
          to="/settings"
          aria-label="Settings"
          className="hidden items-center justify-center rounded p-sm text-on-surface-variant transition-colors hover:bg-surface-container-low sm:flex"
        >
          <span className="material-symbols-outlined">settings</span>
        </Link>
        <div>
          <UserMenu />
        </div>
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded p-sm transition-colors hover:bg-surface-container-low md:hidden"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            {open ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-outline-variant/80 bg-surface-container-lowest px-lg py-md shadow-lg md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              onClick={() => setOpen(false)}
              className="block rounded px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}