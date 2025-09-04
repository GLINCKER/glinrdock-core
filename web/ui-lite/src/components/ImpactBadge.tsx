import { ChangeImpact } from "../utils/changeImpact";
import { Zap, RotateCcw, Box, Wrench, AlertTriangle } from "lucide-preact";

interface ImpactBadgeProps {
  impact: ChangeImpact;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function ImpactBadge({ 
  impact, 
  size = 'md', 
  showIcon = true, 
  showText = true,
  showTooltip = false,
  className = ""
}: ImpactBadgeProps) {
  const getIcon = () => {
    const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
    
    switch (impact.type) {
      case 'hot_reload': return <Zap class={iconSize} />;
      case 'app_restart': return <RotateCcw class={iconSize} />;
      case 'container_restart': return <Box class={iconSize} />;
      case 'image_rebuild': return <Wrench class={iconSize} />;
      default: return <AlertTriangle class={iconSize} />;
    }
  };

  const getText = () => {
    switch (impact.type) {
      case 'hot_reload': return 'Hot Reload';
      case 'app_restart': return 'App Restart';
      case 'container_restart': return 'Container Restart';
      case 'image_rebuild': return 'Image Rebuild';
      default: return 'Unknown';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  return (
    <div
      class={`inline-flex items-center rounded-full font-medium border ${impact.bgColor} ${impact.borderColor} ${impact.color} ${sizeClasses[size]} ${className}`}
      title={`${getText()} - ${impact.description} (${impact.downtime})`}
    >
      {showIcon && (
        <span class={showText ? 'mr-1.5' : ''}>
          {getIcon()}
        </span>
      )}
      {showText && <span>{getText()}</span>}
    </div>
  );
}

interface ImpactTooltipProps {
  impact: ChangeImpact;
  children: any;
}

export function ImpactTooltip({ impact, children }: ImpactTooltipProps) {
  return (
    <div 
      class="relative group"
      title={`${impact.description} - Expected downtime: ${impact.downtime}`}
    >
      {children}
      
      {/* Tooltip - appears on hover */}
      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        <div class="font-medium mb-1">{impact.description}</div>
        <div class="text-gray-300">Downtime: {impact.downtime}</div>
        
        {/* Arrow */}
        <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
      </div>
    </div>
  );
}

// Quick impact indicator for form fields
export function FieldImpactIndicator({ 
  impact, 
  className = "" 
}: { 
  impact: ChangeImpact; 
  className?: string; 
}) {
  const getIcon = () => {
    switch (impact.type) {
      case 'hot_reload': return <Zap class="w-4 h-4" />;
      case 'app_restart': return <RotateCcw class="w-4 h-4" />;
      case 'container_restart': return <Box class="w-4 h-4" />;
      case 'image_rebuild': return <Wrench class="w-4 h-4" />;
      default: return <AlertTriangle class="w-4 h-4" />;
    }
  };

  return (
    <ImpactTooltip impact={impact}>
      <div class={`inline-flex items-center ${className}`}>
        <span class="mr-1">{getIcon()}</span>
        <span class={`text-xs font-medium ${impact.color}`}>
          {impact.downtime}
        </span>
      </div>
    </ImpactTooltip>
  );
}