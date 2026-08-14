import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-outline-variant bg-surface px-lg py-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-md sm:flex-row">
        <span className="font-headline-md text-headline-md font-bold text-primary">Docent</span>
        <nav className="flex gap-lg font-label-caps text-label-caps text-on-surface-variant">
          <Link to="/" className="transition-colors hover:text-primary">
            Notebooks
          </Link>
          <Link to="/help" className="transition-colors hover:text-primary">
            Docs
          </Link>
          <a href="#" className="transition-colors hover:text-primary">
            GitHub
          </a>
        </nav>
        <span className="text-xs text-on-surface-variant">© 2026 Docent</span>
      </div>
    </footer>
  );
}