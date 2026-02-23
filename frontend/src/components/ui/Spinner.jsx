import { Loader2 } from 'lucide-react';

export default function Spinner({ className = '', size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <Loader2
      className={`animate-spin text-primary-600 ${sizeClass} ${className}`}
      aria-label="Loading"
    />
  );
}
