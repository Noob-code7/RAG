import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ProfileSettings {
  name: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  reducedMotion: boolean;
}

export interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  documentReady: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

export interface PrivacySettings {
  shareUsageData: boolean;
  retainQueryHistory: boolean;
}

export interface Settings {
  profile: ProfileSettings;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  language: string;
}

const STORAGE_KEY = 'docent.settings';

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: 'Docent User',
    email: 'you@docent.app',
    bio: 'Researching with grounded AI answers.',
    avatarUrl: null,
  },
  appearance: {
    theme: 'light',
    reducedMotion: false,
  },
  notifications: {
    inApp: true,
    email: false,
    documentReady: true,
    weeklyDigest: false,
    productUpdates: true,
  },
  privacy: {
    shareUsageData: true,
    retainQueryHistory: true,
  },
  language: 'en',
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
];

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      profile: { ...DEFAULT_SETTINGS.profile, ...parsed.profile },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...parsed.privacy },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(settings: Settings) {
  document.documentElement.classList.toggle('dark', resolveDark(settings.appearance.theme));
}

export function storedSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  return loadSettings();
}

export interface SettingsPatch {
  profile?: Partial<ProfileSettings>;
  appearance?: Partial<AppearanceSettings>;
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
  language?: string;
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: SettingsPatch) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage may be unavailable — non-fatal
    }
    applyTheme(settings);
  }, [settings]);

  // Keep the applied theme in sync when the OS scheme changes in "system" mode.
  useEffect(() => {
    if (settings.appearance.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(settings);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings]);

  const update = useCallback((patch: SettingsPatch) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      profile: patch.profile ? { ...prev.profile, ...patch.profile } : prev.profile,
      appearance: patch.appearance ? { ...prev.appearance, ...patch.appearance } : prev.appearance,
      notifications: patch.notifications
        ? { ...prev.notifications, ...patch.notifications }
        : prev.notifications,
      privacy: patch.privacy ? { ...prev.privacy, ...patch.privacy } : prev.privacy,
    }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}