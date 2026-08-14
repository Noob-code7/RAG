import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppNavbar from '../components/app/AppNavbar';
import ProfileAvatar from '../components/app/ProfileAvatar';
import Toggle from '../components/ui/Toggle';
import { useToast } from '../components/ui/Toast';
import {
  LANGUAGES,
  useSettings,
  type ThemeMode,
} from '../context/SettingsContext';

type TabKey = 'profile' | 'appearance' | 'notifications' | 'privacy' | 'language' | 'about';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: 'Profile', icon: 'person' },
  { key: 'appearance', label: 'Appearance', icon: 'palette' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  { key: 'privacy', label: 'Privacy & data', icon: 'privacy_tip' },
  { key: 'language', label: 'Language', icon: 'translate' },
  { key: 'about', label: 'About & help', icon: 'info' },
];

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: 'light_mode' },
  { key: 'dark', label: 'Dark', icon: 'dark_mode' },
  { key: 'system', label: 'System', icon: 'contrast' },
];

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-md">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      {description && (
        <p className="mt-xs font-body-ui text-body-ui text-on-surface-variant">{description}</p>
      )}
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabKey | null) ?? 'profile';
  const { settings, update, reset } = useSettings();
  const push = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setTab = (key: TabKey) => setSearchParams({ tab: key });

  const inputCls =
    'w-full rounded border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-ui text-body-ui text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none';

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      push('Please choose an image file for your avatar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update({ profile: { avatarUrl: String(reader.result) } });
      push('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docent-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    push('Your data has been exported.');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-md pb-16 pt-24 md:px-lg">
        <header className="mb-lg">
          <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">Settings</h1>
          <p className="max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
            Manage your profile, appearance, and preferences. Changes are saved automatically on
            this device.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-md lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-row flex-wrap gap-xs lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex cursor-pointer items-center gap-sm rounded px-md py-sm font-body-ui text-body-ui transition-colors ${
                  tab === t.key
                    ? 'bg-secondary text-on-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
            {tab === 'profile' && (
              <div>
                <SectionTitle
                  title="Profile"
                  description="How you appear across Docent and in the account menu."
                />
                <div className="mb-md flex items-center gap-md">
                  <ProfileAvatar size={56} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        handleAvatarFile(f);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="flex flex-col gap-xs">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded bg-primary px-md py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
                    >
                      Change photo
                    </button>
                    {settings.profile.avatarUrl && (
                      <button
                        onClick={() => update({ profile: { avatarUrl: null } })}
                        className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-on-surface-variant hover:text-error"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-md">
                  <div>
                    <label className="mb-xs block font-label-caps text-label-caps text-on-surface-variant">
                      Display name
                    </label>
                    <input
                      className={inputCls}
                      value={settings.profile.name}
                      onChange={(e) => update({ profile: { name: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="mb-xs block font-label-caps text-label-caps text-on-surface-variant">
                      Email
                    </label>
                    <input
                      className={inputCls}
                      type="email"
                      value={settings.profile.email}
                      onChange={(e) => update({ profile: { email: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="mb-xs block font-label-caps text-label-caps text-on-surface-variant">
                      Bio
                    </label>
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={3}
                      value={settings.profile.bio}
                      onChange={(e) => update({ profile: { bio: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div>
                <SectionTitle
                  title="Appearance"
                  description="Choose how Docent looks. System follows your OS theme automatically."
                />
                <div className="mb-lg flex flex-col gap-sm">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">Theme</label>
                  <div className="flex gap-sm">
                    {THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => update({ appearance: { theme: opt.key } })}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-sm rounded border px-md py-sm font-label-caps text-label-caps transition-colors ${
                          settings.appearance.theme === opt.key
                            ? 'border-secondary bg-secondary text-on-secondary'
                            : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-secondary hover:text-secondary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  checked={settings.appearance.reducedMotion}
                  onChange={(v) => update({ appearance: { reducedMotion: v } })}
                  label="Reduce motion"
                  description="Disable entrance animations and scroll effects."
                />
              </div>
            )}

            {tab === 'notifications' && (
              <div>
                <SectionTitle
                  title="Notifications"
                  description="Choose what you want to hear about. In-app alerts appear in the bell menu."
                />
                <div className="flex flex-col gap-sm">
                  <Toggle
                    checked={settings.notifications.inApp}
                    onChange={(v) => update({ notifications: { inApp: v } })}
                    label="In-app notifications"
                    description="Show alerts in the notification bell."
                  />
                  <Toggle
                    checked={settings.notifications.email}
                    onChange={(v) => update({ notifications: { email: v } })}
                    label="Email notifications"
                    description="Send a summary of activity to your email."
                  />
                  <Toggle
                    checked={settings.notifications.documentReady}
                    onChange={(v) => update({ notifications: { documentReady: v } })}
                    label="Document ready alerts"
                    description="Notify me when ingestion finishes."
                  />
                  <Toggle
                    checked={settings.notifications.weeklyDigest}
                    onChange={(v) => update({ notifications: { weeklyDigest: v } })}
                    label="Weekly digest"
                    description="A Monday recap of your workspace activity."
                  />
                  <Toggle
                    checked={settings.notifications.productUpdates}
                    onChange={(v) => update({ notifications: { productUpdates: v } })}
                    label="Product updates & tips"
                    description="Learn about new features as they ship."
                  />
                </div>
              </div>
            )}

            {tab === 'privacy' && (
              <div>
                <SectionTitle
                  title="Privacy & data"
                  description="Controls over what Docent stores and how your data is used."
                />
                <div className="flex flex-col gap-sm">
                  <Toggle
                    checked={settings.privacy.shareUsageData}
                    onChange={(v) => update({ privacy: { shareUsageData: v } })}
                    label="Share anonymous usage data"
                    description="Help improve Docent with aggregate, de-identified metrics."
                  />
                  <Toggle
                    checked={settings.privacy.retainQueryHistory}
                    onChange={(v) => update({ privacy: { retainQueryHistory: v } })}
                    label="Retain query history"
                    description="Keep a local record of questions you've asked."
                  />
                </div>
                <div className="mt-lg flex flex-col gap-sm">
                  <button
                    onClick={exportData}
                    className="flex cursor-pointer items-center justify-center gap-sm rounded border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    Export my data
                  </button>
                  <button
                    onClick={() => {
                      push('A confirmation would normally be required here.');
                    }}
                    className="flex cursor-pointer items-center justify-center gap-sm rounded border border-error/40 bg-transparent px-lg py-sm font-label-caps text-label-caps text-error transition-colors hover:bg-error/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                    Delete my data
                  </button>
                </div>
              </div>
            )}

            {tab === 'language' && (
              <div>
                <SectionTitle
                  title="Language"
                  description="Language is used for interface text and formatting."
                />
                <label className="mb-xs block font-label-caps text-label-caps text-on-surface-variant">
                  Display language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => update({ language: e.target.value })}
                  className="w-full cursor-pointer rounded border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-ui text-body-ui text-on-surface focus:border-secondary focus:outline-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === 'about' && (
              <div>
                <SectionTitle
                  title="About & help"
                  description="Version info, documentation, and where to get support."
                />
                <ul className="mb-lg flex flex-col gap-xs font-body-ui text-body-ui">
                  <li className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-md py-sm">
                    <span className="text-on-surface-variant">Version</span>
                    <span className="text-on-surface">0.1.0 (dev)</span>
                  </li>
                  <li className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-md py-sm">
                    <span className="text-on-surface-variant">Plan</span>
                    <span className="text-on-surface">Starter (demo)</span>
                  </li>
                  <li className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-md py-sm">
                    <span className="text-on-surface-variant">Storage bucket</span>
                    <span className="text-on-surface">documents</span>
                  </li>
                </ul>
                <div className="flex flex-col gap-sm">
                  <a
                    href="/how-it-works"
                    className="flex cursor-pointer items-center gap-sm rounded border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                  >
                    <span className="material-symbols-outlined text-[16px]">menu_book</span>
                    Read the documentation
                  </a>
                  <a
                    href="/help"
                    className="flex cursor-pointer items-center gap-sm rounded border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                  >
                    <span className="material-symbols-outlined text-[16px]">help</span>
                    Get help & support
                  </a>
                  <a
                    href="mailto:support@docent.app"
                    className="flex cursor-pointer items-center gap-sm rounded border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                  >
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    Contact support
                  </a>
                </div>
              </div>
            )}

            <div className="mt-lg flex justify-between border-t border-outline-variant pt-md">
              <button
                onClick={() => {
                  reset();
                  push('Settings reset to defaults.');
                }}
                className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:text-error"
              >
                Reset to defaults
              </button>
              <span className="font-label-caps text-label-caps text-on-surface-variant opacity-60">
                Saved automatically
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}