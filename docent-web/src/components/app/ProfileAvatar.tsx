import { useSettings } from '../../context/SettingsContext';

interface Props {
  size?: number;
  className?: string;
}

/** Avatar that reflects the user's chosen photo/initials from settings. */
export default function ProfileAvatar({ size = 32, className = '' }: Props) {
  const { settings } = useSettings();
  const name = settings.profile.name.trim() || 'Docent User';
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'D';
  const url = settings.profile.avatarUrl;

  const style = { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={style}
      className={`flex items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-secondary-container text-[13px] font-bold text-white ${className}`}
    >
      {initials}
    </span>
  );
}