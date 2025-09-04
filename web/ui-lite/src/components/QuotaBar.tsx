// Removed unused import
import { isUnlimited, getUsagePercentage, isNearLimit, isAtLimit, formatLimit } from '../plan';

interface QuotaBarProps {
  label: string;
  current: number;
  limit: number | string;
  className?: string;
}

export function QuotaBar({ label, current, limit, className = '' }: QuotaBarProps) {
  const percentage = getUsagePercentage(current, limit);
  const nearLimit = isNearLimit(current, limit);
  const atLimit = isAtLimit(current, limit);
  const unlimited = isUnlimited(limit);
  
  // Progress bar color based on usage
  let progressColor = 'bg-blue-500';
  if (atLimit) {
    progressColor = 'bg-red-500';
  } else if (nearLimit) {
    progressColor = 'bg-yellow-500';
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className={`text-sm ${
          atLimit ? 'text-red-600 dark:text-red-400' :
          nearLimit ? 'text-yellow-600 dark:text-yellow-400' :
          'text-gray-600 dark:text-gray-400'
        }`}>
          {current}/{formatLimit(limit)}
        </span>
      </div>
      
      {!unlimited && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      
      {unlimited && (
        <div className="text-xs text-green-600 dark:text-green-400 font-medium">
          Unlimited usage
        </div>
      )}
      
      {atLimit && (
        <div className="text-xs text-red-600 dark:text-red-400">
          Quota limit reached
        </div>
      )}
      
      {nearLimit && !atLimit && (
        <div className="text-xs text-yellow-600 dark:text-yellow-400">
          Approaching limit
        </div>
      )}
    </div>
  );
}