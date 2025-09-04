// Simple Icons caching utility with preloading and fallback handling
import { cache, simpleIconsRateLimiter } from "./cache";

export interface SimpleIconData {
  svg: string;
  color: string;
  slug: string;
  name: string;
}

// Preload common icons to reduce API calls
const COMMON_ICONS = [
  "postgresql",
  "redis",
  "mongodb",
  "mysql",
  "nginx",
  "apache",
  "nodedotjs",
  "python",
  "java",
  "rabbitmq",
  "elasticsearch",
  "grafana",
  "docker",
  "traefik",
  "caddy",
  "vault",
  "consul",
  "portainer",
  "wordpress",
  "ghost",
  "nextcloud",
  "gitea",
  "gitlab",
  "jenkins",
  "prometheus",
  "kibana",
];

class SimpleIconsManager {
  private preloadingPromise: Promise<void> | null = null;
  private failedIcons = new Set<string>();

  constructor() {
    // Start preloading common icons on instantiation
    this.preloadCommonIcons();
  }

  async getIcon(slug: string, color: string): Promise<string | null> {
    // Check if this icon has failed before
    if (this.failedIcons.has(slug)) {
      return null;
    }

    const cacheKey = `${slug}-${color}`;

    // Check cache first
    const cached = cache.get<SimpleIconData>(cacheKey, "simpleicons");
    if (cached) {
      return cached.svg;
    }

    // Check rate limiting
    if (!simpleIconsRateLimiter.canMakeRequest("simpleicons")) {
      console.warn(
        `Rate limit exceeded for Simple Icons. Remaining: ${simpleIconsRateLimiter.getRemainingRequests(
          "simpleicons"
        )}`
      );
      return null;
    }

    try {
      const cleanColor = color.replace("#", "");
      const url = `https://cdn.simpleicons.org/${slug}/${cleanColor}`;

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          // Mark as failed to avoid future requests
          this.failedIcons.add(slug);
          console.warn(`Simple Icon not found: ${slug}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const svg = await response.text();

      // Cache the result with 24-hour TTL
      const iconData: SimpleIconData = { svg, color, slug, name: slug };
      cache.set(cacheKey, iconData, "simpleicons");

      return svg;
    } catch (error) {
      console.warn(`Failed to fetch Simple Icon ${slug}:`, error);
      this.failedIcons.add(slug);
      return null;
    }
  }

  async preloadCommonIcons(): Promise<void> {
    if (this.preloadingPromise) {
      return this.preloadingPromise;
    }

    this.preloadingPromise = this.doPreload();
    return this.preloadingPromise;
  }

  private async doPreload(): Promise<void> {
    const promises = COMMON_ICONS.map(async (slug) => {
      // Use default colors for preloading
      const defaultColor = "000000"; // Black as default
      try {
        await this.getIcon(slug, defaultColor);
      } catch (error) {
        // Ignore errors during preloading
        console.warn(`Failed to preload icon ${slug}:`, error);
      }
    });

    // Use Promise.allSettled to avoid failing if some icons don't exist
    await Promise.allSettled(promises);
    // console.log(`Simple Icons: Preloaded ${COMMON_ICONS.length} common icons`)
  }

  // Create a cached image element for better performance
  createCachedImage(
    slug: string,
    color: string,
    className?: string
  ): HTMLImageElement | null {
    const cacheKey = `${slug}-${color}`;
    const cached = cache.get<SimpleIconData>(cacheKey, "simpleicons");

    if (!cached) {
      return null;
    }

    const img = document.createElement("img");
    img.src = `data:image/svg+xml;base64,${btoa(cached.svg)}`;
    img.alt = cached.name;
    img.loading = "lazy";

    if (className) {
      img.className = className;
    }

    return img;
  }

  // Check if an icon is available in cache
  isIconCached(slug: string, color: string): boolean {
    const cacheKey = `${slug}-${color}`;
    return cache.get<SimpleIconData>(cacheKey, "simpleicons") !== null;
  }

  // Get failed icons for debugging
  getFailedIcons(): string[] {
    return Array.from(this.failedIcons);
  }

  // Clear failed icons (useful for retrying)
  clearFailedIcons(): void {
    this.failedIcons.clear();
  }
}

// Export singleton instance
export const simpleIconsManager = new SimpleIconsManager();

// Utility function for components to use
export async function getSimpleIcon(
  slug: string,
  color: string
): Promise<string | null> {
  return simpleIconsManager.getIcon(slug, color);
}

// Utility function to create optimized Simple Icons URLs with caching
export function getSimpleIconUrl(slug: string, color: string): string {
  const cleanColor = color.replace("#", "");
  return `https://cdn.simpleicons.org/${slug}/${cleanColor}`;
}

// Preact/React hook for using Simple Icons with caching
export function useSimpleIcon(
  slug: string,
  color: string
): {
  iconSvg: string | null;
  isLoading: boolean;
  error: boolean;
} {
  // This would be implemented as a proper React/Preact hook
  // For now, returning a basic structure
  return {
    iconSvg: null,
    isLoading: true,
    error: false,
  };
}
