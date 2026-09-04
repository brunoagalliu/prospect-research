const VARIANTS = {
  neutral: 'bg-ink-100 text-ink-600',
  brand: 'bg-brand-100 text-brand-700',
  signal: 'bg-signal-light text-signal-dark',
  good: 'bg-good-light text-good-dark',
};

export default function Badge({ variant = 'neutral', children }) {
  return <span className={`badge ${VARIANTS[variant]}`}>{children}</span>;
}
