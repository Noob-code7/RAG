import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useDismissable } from '../../hooks/useDismissable';
import { useToast } from '../ui/Toast';
import ProfileAvatar from './ProfileAvatar';

const PRIMARY_LINKS = [
  { label: 'Profile', to: '/settings?tab=profile', icon: 'person' },
  { label: 'Notebooks', to: '/', icon: 'folder' },
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
];

const SECONDARY_LINKS = [
  { label: 'Account settings', to: '/settings', icon: 'settings' },
  { label: 'Preferences', to: '/settings?tab=appearance', icon: 'tune' },
  { label: 'Keyboard shortcuts', to: '/help#shortcuts', icon: 'keyboard' },
  { label: 'Help & support', to: '/help', icon: 'help' },
];

export default function UserMenu() {
  const { open, setOpen, ref } = useDismissable();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const push = useToast();

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-sm block cursor-pointer rounded-full transition-transform hover:scale-105"
      >
        <ProfileAvatar size={32} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[90] mt-2 w-64 animate-fade-pop overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          <div className="flex items-center gap-sm border-b border-outline-variant bg-surface-container-low px-md py-sm">
            <ProfileAvatar size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-body-ui text-body-ui font-semibold text-on-surface">
                {settings.profile.name}
              </p>
              <p className="truncate font-label-caps text-label-caps text-on-surface-variant">
                {settings.profile.email}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-xs p-sm font-body-ui text-body-ui">
            {PRIMARY_LINKS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={close}
                className="flex items-center gap-sm rounded px-md py-sm text-on-surface transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-outline-variant" />

          <div className="flex flex-col gap-xs p-sm font-body-ui text-body-ui">
            {SECONDARY_LINKS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={close}
                className="flex items-center gap-sm rounded px-md py-sm text-on-surface transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                close();
                push('Signed out (demo) — this project has no auth yet.');
                navigate('/');
              }}
              className="flex cursor-pointer items-center gap-sm rounded px-md py-sm text-left text-error transition-colors hover:bg-error-container"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}