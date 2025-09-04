// Cached Simple Icons component with preloading and fallback
import { useState, useEffect } from "preact/hooks";
import { simpleIconsManager } from "../utils/simpleIcons";

interface CachedSimpleIconProps {
  slug: string;
  color: string;
  className?: string;
  alt?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export function CachedSimpleIcon({ 
  slug, 
  color, 
  className = "w-full h-full object-contain",
  alt,
  onError,
  onLoad 
}: CachedSimpleIconProps) {
  const [iconSvg, setIconSvg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadIcon = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        // Check cache first - this is very fast
        if (simpleIconsManager.isIconCached(slug, color)) {
          const svg = await simpleIconsManager.getIcon(slug, color);
          if (!cancelled) {
            setIconSvg(svg);
            setIsLoading(false);
            if (svg && onLoad) onLoad();
            if (!svg && onError) onError();
          }
          return;
        }

        // If not cached, load asynchronously
        const svg = await simpleIconsManager.getIcon(slug, color);
        if (!cancelled) {
          setIconSvg(svg);
          setIsLoading(false);
          
          if (svg) {
            if (onLoad) onLoad();
          } else {
            setHasError(true);
            if (onError) onError();
          }
        }
      } catch (error) {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
          if (onError) onError();
        }
      }
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [slug, color, onError, onLoad]);

  // Don't render anything if loading or error
  if (isLoading || hasError || !iconSvg) {
    return null;
  }

  // Render the cached SVG as a data URL
  const dataUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`;

  return (
    <img
      src={dataUrl}
      alt={alt || slug}
      className={`${className} cached-simple-icon`}
      loading="lazy"
      style={{ display: 'block' }}
    />
  );
}