/**
 * Small status/category badge. Variants: default, male, female, other, success, warning, danger.
 */
const VARIANT_CLASSES = {
  default: 'bg-slate-100 text-slate-700',
  male: 'bg-blue-100 text-blue-800',
  female: 'bg-pink-100 text-pink-800',
  other: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

export default function Badge({ children, variant = 'default', className = '' }) {
  const classes = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
      role="status"
    >
      {children}
    </span>
  );
}

/** Map gender value to Badge variant */
export function GenderBadge({ value }) {
  if (!value) return <Badge variant="other">—</Badge>;
  const v = String(value).toLowerCase();
  if (v === 'male') return <Badge variant="male">Male</Badge>;
  if (v === 'female') return <Badge variant="female">Female</Badge>;
  return <Badge variant="other">{value}</Badge>;
}
