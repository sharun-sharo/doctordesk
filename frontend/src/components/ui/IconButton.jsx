import { useState, useRef, useEffect } from 'react';

export default function IconButton({
  icon: Icon,
  onClick,
  'aria-label': ariaLabel,
  variant = 'default',
  title,
  className = '',
  ...rest
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 400);
  };
  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const variantClass =
    variant === 'danger'
      ? 'text-slate-500 hover:bg-red-50 hover:text-red-600 focus:ring-red-500/30'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:ring-emerald-500/30';

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={ariaLabel || title}
        title={title}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-95 ${variantClass} ${className}`}
        {...rest}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
      </button>
      {title && showTooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
        >
          {title}
        </span>
      )}
    </div>
  );
}
