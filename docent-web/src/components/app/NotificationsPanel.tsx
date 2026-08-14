import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDismissable } from '../../hooks/useDismissable';
import { useToast } from '../ui/Toast';

interface Notification {
  id: number;
  icon: string;
  title: string;
  time: string;
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    icon: 'check_circle',
    title: '3 documents finished indexing',
    time: '5m ago',
    unread: true,
  },
  {
    id: 2,
    icon: 'error',
    title: '1 document failed to index',
    time: '20m ago',
    unread: true,
  },
  {
    id: 3,
    icon: 'tips_and_updates',
    title: 'New: open sources straight from citations',
    time: '2h ago',
    unread: true,
  },
  {
    id: 4,
    icon: 'folder',
    title: 'Library now supports bulk actions',
    time: '1d ago',
    unread: false,
  },
];

export default function NotificationsPanel() {
  const { open, setOpen, ref } = useDismissable();
  const [items, setItems] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const push = useToast();

  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => setItems((list) => list.map((n) => ({ ...n, unread: false })));
  const markRead = (id: number) =>
    setItems((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  const clearAll = () => {
    setItems([]);
    push('Notifications cleared.');
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[90] mt-2 w-80 animate-fade-pop overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-md py-sm">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Notifications
            </h3>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          <div className="flex max-h-[320px] flex-col overflow-y-auto font-body-ui text-body-ui">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-sm px-md py-xl text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px] text-outline-variant">
                  notifications_off
                </span>
                <p>You’re all caught up.</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="flex cursor-pointer items-start gap-sm border-b border-outline-variant/50 px-md py-sm text-left transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined mt-px text-[18px] text-on-surface-variant">
                    {n.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-on-surface">{n.title}</span>
                    <span className="block font-label-caps text-label-caps text-on-surface-variant">
                      {n.time}
                    </span>
                  </span>
                  {n.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-md py-sm font-label-caps text-label-caps">
            <Link
              to="/settings?tab=notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-secondary transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-[14px]">settings</span>
              Preferences
            </Link>
            <button
              onClick={clearAll}
              disabled={items.length === 0}
              className="cursor-pointer border-none bg-transparent p-0 text-on-surface-variant transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}