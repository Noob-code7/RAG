interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export default function Toggle({ checked, onChange, label, description }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full cursor-pointer items-center justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm text-left transition-colors hover:border-secondary"
    >
      <span>
        {label && <span className="block font-body-ui text-body-ui text-on-surface">{label}</span>}
        {description && (
          <span className="block font-body-ui text-[12px] text-on-surface-variant">{description}</span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-secondary' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}