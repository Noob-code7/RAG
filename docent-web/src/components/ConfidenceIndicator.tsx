import type { Confidence } from '../types';

const META: Record<Confidence, { label: string; cls: string; dot: string }> = {
  grounded: {
    label: 'High Confidence',
    cls: 'border-on-tertiary-container/30 bg-on-tertiary-container/5 text-on-tertiary-container',
    dot: 'bg-on-tertiary-container',
  },
  partial: {
    label: 'Medium Confidence',
    cls: 'border-amber-600/30 bg-amber-500/10 text-amber-700',
    dot: 'bg-amber-500',
  },
  not_found: {
    label: 'Low Confidence',
    cls: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
    dot: 'bg-slate-400',
  },
};

export default function ConfidenceIndicator({ confidence }: { confidence: Confidence }) {
  const meta = META[confidence];
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${meta.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}