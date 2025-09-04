// Removed unused import
import { getPlanBadgeProps } from '../plan';

interface PlanBadgeProps {
  plan: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function PlanBadge({ plan, className = '', size = 'sm' }: PlanBadgeProps) {
  const { text, className: planClassName } = getPlanBadgeProps(plan);
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  return (
    <span className={`
      inline-flex items-center rounded-full font-medium
      ${sizeClasses[size]}
      ${planClassName}
      ${className}
    `}>
      {text}
    </span>
  );
}