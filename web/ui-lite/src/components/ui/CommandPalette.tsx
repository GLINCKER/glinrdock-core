import { useEffect, useState, useRef, useMemo } from "preact/hooks";
import { createPortal } from "preact/compat";
import {
  FolderOpen,
  Server,
  Route,
  Settings,
  Database,
  FileText,
  Search,
  Loader2,
  AlertTriangle,
  ChevronRight,
  X,
  Globe,
  Users,
  Activity,
  Shield,
  Terminal,
  Layers,
  Network,
  Clock,
  Trash2,
  HelpCircle,
} from "lucide-preact";
import { apiClient } from "../../api";
import type { SearchHit, SearchSuggestion } from "../../api";
import { searchRegistry } from "../../utils/searchRegistry";
import { highlightMatchingText } from "../../utils/textHighlight";
import { QuickAccess } from "./QuickAccess";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [fts5Available, setFts5Available] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [featuredPages, setFeaturedPages] = useState<SearchHit[]>([]);
  const [backendPagesLoaded, setBackendPagesLoaded] = useState(false);
  const [dynamicSearchItems, setDynamicSearchItems] = useState<SearchHit[]>([]);
  const [fallbackPages] = useState<SearchHit[]>([
    {
      id: 1,
      type: "page",
      entity_id: "dashboard",
      title: "Dashboard",
      subtitle: "System overview and metrics",
      url_path: "/app/",
      score: 1.0,
      content: "Dashboard overview metrics status",
    },
    {
      id: 2,
      type: "page",
      entity_id: "projects",
      title: "Projects",
      subtitle: "Manage your projects",
      url_path: "/app/projects",
      score: 1.0,
      content: "Projects management repository",
    },
    {
      id: 3,
      type: "page",
      entity_id: "services",
      title: "Services",
      subtitle: "Container services",
      url_path: "/app/services",
      score: 1.0,
      content: "Services containers docker",
    },
    {
      id: 4,
      type: "page",
      entity_id: "routes",
      title: "Routes",
      subtitle: "Network routing",
      url_path: "/app/routes",
      score: 1.0,
      content: "Routes network proxy",
    },
    {
      id: 5,
      type: "page",
      entity_id: "nodes",
      title: "Nodes",
      subtitle: "Infrastructure nodes",
      url_path: "/app/nodes",
      score: 1.0,
      content: "Nodes infrastructure servers",
    },

    // Deployment section
    {
      id: 6,
      type: "page",
      entity_id: "quickstart",
      title: "Quick Start",
      subtitle: "Deployment quick start",
      url_path: "/app/quickstart",
      score: 1.0,
      content: "Quick Start deployment getting started guide tutorial",
    },
    {
      id: 7,
      type: "page",
      entity_id: "spring-boot",
      title: "Spring Boot",
      subtitle: "Spring Boot quickstart guide",
      url_path: "/app/quickstart/spring",
      score: 1.0,
      content:
        "Spring Boot Java quickstart deployment guide tutorial framework",
    },
    {
      id: 8,
      type: "page",
      entity_id: "templates",
      title: "Service Templates",
      subtitle: "Pre-built service configurations",
      url_path: "/app/templates",
      score: 1.0,
      content: "Templates configurations presets service deployment",
    },

    // Administration section - moved to Settings
    {
      id: 9,
      type: "page",
      entity_id: "system-admin",
      title: "System Administration",
      subtitle: "Emergency controls and system management",
      url_path: "/app/settings/system-admin",
      score: 1.0,
      content: "System Admin administration emergency lockdown restart backup restore monitoring",
    },
    {
      id: 10,
      type: "page",
      entity_id: "registries",
      title: "Registries",
      subtitle: "Container registries",
      url_path: "/app/registries",
      score: 1.0,
      content: "Registries docker hub container registry credentials",
    },
    {
      id: 11,
      type: "page",
      entity_id: "system-logs",
      title: "System Logs",
      subtitle: "View system logs",
      url_path: "/app/logs",
      score: 1.0,
      content: "System Logs debugging audit monitoring errors events",
    },
    {
      id: 12,
      type: "page",
      entity_id: "clients",
      title: "Clients",
      subtitle: "Connected clients",
      url_path: "/app/clients",
      score: 1.0,
      content: "Clients connections API access tokens authentication",
    },

    // Configuration section
    {
      id: 13,
      type: "page",
      entity_id: "settings",
      title: "Settings",
      subtitle: "Application settings hub",
      url_path: "/app/settings",
      score: 1.0,
      content: "Settings configuration preferences system config authentication plan licenses templates",
    },
    {
      id: 14,
      type: "page",
      entity_id: "settings-auth",
      title: "Authentication Settings",
      subtitle: "API tokens and authentication",
      url_path: "/app/settings/auth",
      score: 1.0,
      content: "Authentication settings API tokens security access management",
    },
    {
      id: 15,
      type: "page",
      entity_id: "settings-plan",
      title: "Plan & Limits",
      subtitle: "Subscription plan and resource limits",
      url_path: "/app/settings/plan-limits",
      score: 1.0,
      content: "Plan limits subscription license resources quota usage billing",
    },
    {
      id: 16,
      type: "page",
      entity_id: "settings-certificates",
      title: "SSL Certificates",
      subtitle: "DNS providers and SSL management",
      url_path: "/app/settings/certificates",
      score: 1.0,
      content: "SSL certificates DNS providers domain management security TLS",
    },
    {
      id: 17,
      type: "page",
      entity_id: "settings-templates",
      title: "Environment Templates",
      subtitle: "Environment variable templates",
      url_path: "/app/settings/environment-templates",
      score: 1.0,
      content: "Environment templates variables configuration deployment presets",
    },
    {
      id: 18,
      type: "page",
      entity_id: "integrations",
      title: "Integrations",
      subtitle: "GitHub, DNS, and Nginx integrations",
      url_path: "/app/settings/integrations",
      score: 1.0,
      content: "Integrations GitHub OAuth webhooks DNS certificates nginx proxy external services API",
    },
    {
      id: 19,
      type: "page",
      entity_id: "settings-license",
      title: "License Settings",
      subtitle: "License key management and validation",
      url_path: "/app/settings/license",
      score: 1.0,
      content: "License key management validation enterprise premium features subscription",
    },

    // Help & Documentation section
    {
      id: 20,
      type: "page",
      entity_id: "help",
      title: "Help & Documentation",
      subtitle: "User guides and documentation",
      url_path: "/app/help",
      score: 1.0,
      content: "help documentation guides faq getting started troubleshooting support user guide",
    },
    {
      id: 21,
      type: "help",
      entity_id: "help/getting-started",
      title: "Getting Started Guide",
      subtitle: "Quick introduction to GLINRDOCK",
      url_path: "/app/help/guides/getting-started",
      score: 1.0,
      content: "getting started quickstart onboarding introduction tutorial basics first time setup",
    },
    {
      id: 22,
      type: "help",
      entity_id: "help/installation",
      title: "Installation Guide",
      subtitle: "How to install and set up GLINRDOCK",
      url_path: "/app/help/guides/install",
      score: 1.0,
      content: "installation setup deployment configuration requirements install guide",
    },
    {
      id: 23,
      type: "help",
      entity_id: "help/services",
      title: "Managing Services",
      subtitle: "Deploy and manage your applications",
      url_path: "/app/help/using/services",
      score: 1.0,
      content: "services containers deployment management docker applications running",
    },
    {
      id: 24,
      type: "help",
      entity_id: "help/routes",
      title: "Configuring Routes",
      subtitle: "Set up network routing and domains",
      url_path: "/app/help/using/routes",
      score: 1.0,
      content: "routes domains https networking ssl certificates proxy configuration",
    },
    {
      id: 25,
      type: "help",
      entity_id: "help/search",
      title: "Using Search",
      subtitle: "Find and navigate your resources quickly",
      url_path: "/app/help/using/search",
      score: 1.0,
      content: "search navigation command palette find resources keyboard shortcuts",
    },
    {
      id: 26,
      type: "help",
      entity_id: "help/templates",
      title: "Working with Templates",
      subtitle: "Use service templates for faster deployment",
      url_path: "/app/help/using/templates",
      score: 1.0,
      content: "templates service deployment presets configurations quickstart",
    },
    {
      id: 27,
      type: "help",
      entity_id: "help/github-app",
      title: "GitHub App Integration",
      subtitle: "Connect GLINRDOCK to your GitHub repositories",
      url_path: "/app/help/integrations/github-app",
      score: 1.0,
      content: "github integration automation deployment git repositories webhooks",
    },
    {
      id: 28,
      type: "help",
      entity_id: "help/troubleshooting",
      title: "Troubleshooting Guide",
      subtitle: "Common issues and solutions",
      url_path: "/app/help/guides/troubleshoot",
      score: 1.0,
      content: "troubleshooting issues problems support debugging fixes solutions",
    },
    {
      id: 29,
      type: "help",
      entity_id: "help/faq",
      title: "Frequently Asked Questions",
      subtitle: "Answers to common questions",
      url_path: "/app/help/faq",
      score: 1.0,
      content: "faq questions answers help support common issues frequently asked",
    },
  ]);
  const [showingDefaultContent, setShowingDefaultContent] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Infinite scroll pagination state
  const [pagination, setPagination] = useState({
    page: 0,
    hasMore: true,
    total: 0,
    loadingMore: false,
  });
  const [paginatedResults, setPaginatedResults] = useState<SearchHit[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  // LRU Cache for search results with version tracking
  const CACHE_VERSION = "v2"; // Increment this to invalidate all existing cache
  const [searchCache] = useState(() => {
    const cache = new Map<
      string,
      {
        results: any[];
        timestamp: number;
        fts5Available: boolean;
        version: string;
      }
    >();
    console.log(
      "🔄 Search cache initialized - fresh start with version",
      CACHE_VERSION
    );
    return cache;
  });
  const CACHE_SIZE_LIMIT = 100; // Maximum number of cached queries
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  // LRU Cache for suggestions with shorter TTL
  const [suggestCache] = useState(() => {
    const cache = new Map<
      string,
      { suggestions: SearchSuggestion[]; timestamp: number; version: string }
    >();
    console.log(
      "🔄 Suggest cache initialized - fresh start with version",
      CACHE_VERSION
    );
    return cache;
  });
  const SUGGEST_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for suggestions

  // Search Usage Analytics
  const [searchAnalytics] = useState(() => {
    const stored = localStorage.getItem("glinrdock_search_analytics");
    return stored
      ? JSON.parse(stored)
      : {
          totalSearches: 0,
          popularQueries: {},
          zeroResultQueries: [],
          categoryUsage: {},
          searchSessions: [],
          operatorUsage: {},
          lastReset: Date.now(),
        };
  });

  const trackSearchAnalytics = (
    query: string,
    results: any[],
    operators: Record<string, string> = {},
    selectedCategory?: string
  ) => {
    searchAnalytics.totalSearches++;

    // Track popular queries
    const queryLower = query.toLowerCase().trim();
    if (queryLower.length >= 2) {
      searchAnalytics.popularQueries[queryLower] =
        (searchAnalytics.popularQueries[queryLower] || 0) + 1;
    }

    // Track zero result queries
    if (results.length === 0 && queryLower.length >= 2) {
      const zeroQuery = { query: queryLower, timestamp: Date.now(), operators };
      searchAnalytics.zeroResultQueries.push(zeroQuery);
      // Keep only last 50 zero-result queries
      if (searchAnalytics.zeroResultQueries.length > 50) {
        searchAnalytics.zeroResultQueries =
          searchAnalytics.zeroResultQueries.slice(-50);
      }
    }

    // Track category usage
    if (selectedCategory) {
      searchAnalytics.categoryUsage[selectedCategory] =
        (searchAnalytics.categoryUsage[selectedCategory] || 0) + 1;
    }

    // Track operator usage
    if (Object.keys(operators).length > 0) {
      Object.keys(operators).forEach((op) => {
        searchAnalytics.operatorUsage[op] =
          (searchAnalytics.operatorUsage[op] || 0) + 1;
      });
    }

    // Track search session (for pattern analysis)
    const session = {
      query: queryLower,
      results: results.length,
      timestamp: Date.now(),
      operators: Object.keys(operators),
      category: selectedCategory || "all",
    };
    searchAnalytics.searchSessions.push(session);

    // Keep only last 200 search sessions
    if (searchAnalytics.searchSessions.length > 200) {
      searchAnalytics.searchSessions =
        searchAnalytics.searchSessions.slice(-200);
    }

    // Save to localStorage
    localStorage.setItem(
      "glinrdock_search_analytics",
      JSON.stringify(searchAnalytics)
    );

    // Log analytics for debugging (can be removed in production)
    console.log("📊 Search Analytics:", {
      query: queryLower,
      results: results.length,
      totalSearches: searchAnalytics.totalSearches,
      operators: Object.keys(operators),
    });
  };

  // Track suggestion clicks and interactions
  const trackSuggestionHit = (suggestion: SearchSuggestion, query: string) => {
    const suggestionAnalytics = {
      query: query.toLowerCase().trim(),
      selectedSuggestion: suggestion.label,
      suggestionType: suggestion.type,
      timestamp: Date.now(),
    };

    // Store suggestion analytics (could expand this)
    console.log("🎯 Suggestion Hit:", suggestionAnalytics);

    // You could add this to the analytics object if needed
    // searchAnalytics.suggestionHits = searchAnalytics.suggestionHits || []
    // searchAnalytics.suggestionHits.push(suggestionAnalytics)
  };

  // Analytics insights function (for debugging/admin use)
  const getSearchInsights = () => {
    const topQueries = Object.entries(searchAnalytics.popularQueries)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const recentZeroResults = searchAnalytics.zeroResultQueries
      .slice(-10)
      .map((item) => ({
        query: item.query,
        operators: Object.keys(item.operators || {}),
      }));

    const topCategories = Object.entries(searchAnalytics.categoryUsage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([category, count]) => ({ category, count }));

    const operatorStats = Object.entries(searchAnalytics.operatorUsage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([operator, count]) => ({ operator, count }));

    return {
      totalSearches: searchAnalytics.totalSearches,
      topQueries,
      recentZeroResults,
      zeroResultRate: (
        (searchAnalytics.zeroResultQueries.length /
          searchAnalytics.totalSearches) *
        100
      ).toFixed(1),
      topCategories,
      operatorStats,
      avgSearchesPerSession:
        searchAnalytics.totalSearches > 0
          ? (
              searchAnalytics.searchSessions.length /
              searchAnalytics.totalSearches
            ).toFixed(2)
          : "0",
    };
  };

  // Expose insights to window for admin debugging
  if (typeof window !== "undefined") {
    (window as any).getSearchInsights = getSearchInsights;
    (window as any).clearSearchCache = () => {
      searchCache.clear();
      suggestCache.clear();
      console.log("🧹 Search and suggest caches cleared!");
    };
  }

  // Advanced search operators
  const parseSearchOperators = (query: string) => {
    const operators: Record<string, string> = {};
    let cleanQuery = query;

    // Extract operators like "type:service", "project:GLINR", "status:running"
    const operatorPattern = /(\w+):(\w+)/g;
    let match;

    while ((match = operatorPattern.exec(query)) !== null) {
      const [fullMatch, key, value] = match;
      operators[key] = value;
      cleanQuery = cleanQuery.replace(fullMatch, "").trim();
    }

    return { operators, cleanQuery: cleanQuery.replace(/\s+/g, " ").trim() };
  };

  // Check if search result matches operators
  const matchesOperators = (
    hit: any,
    operators: Record<string, string>
  ): boolean => {
    if (Object.keys(operators).length === 0) return true;

    for (const [key, value] of Object.entries(operators)) {
      switch (key.toLowerCase()) {
        case "type":
          if (hit.type !== value.toLowerCase()) return false;
          break;
        case "project":
          if (!hit.content?.toLowerCase().includes(value.toLowerCase()))
            return false;
          break;
        case "status":
          // For now, we don't have status info in search results
          // This could be enhanced in the future
          break;
        default:
          // Unknown operator, ignore
          break;
      }
    }

    return true;
  };

  // Cache helper functions
  const getCachedResults = (queryKey: string) => {
    const cached = searchCache.get(queryKey);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      searchCache.delete(queryKey);
      return null;
    }

    // Move to end (most recently used)
    searchCache.delete(queryKey);
    searchCache.set(queryKey, cached);

    console.log(
      "🎯 Cache HIT for query:",
      queryKey,
      "- Results:",
      cached.results.length
    );
    return cached;
  };

  const setCachedResults = (
    queryKey: string,
    results: any[],
    fts5Available: boolean
  ) => {
    // Remove oldest entries if cache is full
    if (searchCache.size >= CACHE_SIZE_LIMIT) {
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
      console.log("🗑️ Cache eviction - removed:", firstKey);
    }

    const cacheEntry = {
      results,
      timestamp: Date.now(),
      fts5Available,
      version: CACHE_VERSION,
    };

    searchCache.set(queryKey, cacheEntry);
    console.log(
      "💾 Cache SET for query:",
      queryKey,
      "- Results:",
      results.length,
      "- Cache size:",
      searchCache.size
    );
  };

  // Suggestion cache helper functions
  const getCachedSuggestions = (queryKey: string) => {
    const cached = suggestCache.get(queryKey);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > SUGGEST_CACHE_TTL) {
      suggestCache.delete(queryKey);
      return null;
    }

    // Move to end (most recently used)
    suggestCache.delete(queryKey);
    suggestCache.set(queryKey, cached);

    console.log(
      "🎯 Suggest Cache HIT for query:",
      queryKey,
      "- Suggestions:",
      cached.suggestions.length
    );
    return cached;
  };

  const setCachedSuggestions = (
    queryKey: string,
    suggestions: SearchSuggestion[]
  ) => {
    // Remove oldest entries if cache is full
    if (suggestCache.size >= CACHE_SIZE_LIMIT) {
      const firstKey = suggestCache.keys().next().value;
      suggestCache.delete(firstKey);
      console.log("🗑️ Suggest cache eviction - removed:", firstKey);
    }

    const cacheEntry = {
      suggestions,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    suggestCache.set(queryKey, cacheEntry);
    console.log(
      "💾 Suggest Cache SET for query:",
      queryKey,
      "- Suggestions:",
      suggestions.length,
      "- Cache size:",
      suggestCache.size
    );
  };

  // Search categories
  const searchCategories = [
    { id: "all", label: "All", icon: Search },
    { id: "project", label: "Projects", icon: FolderOpen },
    { id: "service", label: "Services", icon: Server },
    { id: "route", label: "Routes", icon: Globe },
    { id: "registry", label: "Registries", icon: Database },
    { id: "env_template", label: "Templates", icon: FileText },
    { id: "setting", label: "Settings", icon: Settings },
    { id: "page", label: "Pages", icon: Layers },
    { id: "help", label: "Help", icon: HelpCircle },
  ];

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("glinrdock_recent_searches");
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.warn("Failed to parse recent searches", e);
      }
    }
  }, []);

  // Subscribe to dynamic search items from search registry
  useEffect(() => {
    const unsubscribe = searchRegistry.subscribe((items) => {
      setDynamicSearchItems(items);
    });
    
    // Initialize with current items
    setDynamicSearchItems(searchRegistry.getItems());
    
    return unsubscribe;
  }, []);

  // Load pages from backend on mount and when palette opens
  useEffect(() => {
    const loadPagesFromBackend = async () => {
      if (backendPagesLoaded) return; // Don't reload if already loaded

      try {
        console.log("📄 Loading pages from backend...");

        // Try multiple search terms to get comprehensive page coverage
        const searchTerms = [
          "management",
          "system",
          "dashboard",
          "projects",
          "logs",
        ];
        const allPages = new Map<string, any>(); // Use Map to deduplicate by entity_id

        for (const term of searchTerms) {
          try {
            const result = await apiClient.search(term, {
              type: "page",
              limit: 10,
            });
            if (result.hits && result.hits.length > 0) {
              result.hits.forEach((page) => {
                allPages.set(page.entity_id.toString(), page);
              });
            }
          } catch (termError) {
            console.log(`⚠️ Search term "${term}" failed:`, termError);
          }
        }

        const combinedPages = Array.from(allPages.values());

        if (combinedPages.length > 0) {
          console.log(
            "✅ Loaded",
            combinedPages.length,
            "unique pages from backend"
          );
          setFeaturedPages(combinedPages);
          setBackendPagesLoaded(true);

          // Cache the pages in localStorage for offline fallback
          localStorage.setItem(
            "glinrdock_cached_pages",
            JSON.stringify({
              pages: combinedPages,
              timestamp: Date.now(),
            })
          );
        } else {
          console.log("⚠️ No pages from backend, using fallback");
          setFeaturedPages(fallbackPages);
        }
      } catch (error) {
        console.error(
          "❌ Failed to load pages from backend, using fallback:",
          error
        );

        // Try to load cached pages from localStorage
        try {
          const cached = localStorage.getItem("glinrdock_cached_pages");
          if (cached) {
            const cachedData = JSON.parse(cached);
            const age = Date.now() - cachedData.timestamp;

            // Use cached pages if less than 1 hour old
            if (
              age < 60 * 60 * 1000 &&
              cachedData.pages &&
              Array.isArray(cachedData.pages)
            ) {
              console.log("📱 Using cached pages from localStorage");
              setFeaturedPages(cachedData.pages);
              return;
            }
          }
        } catch (cacheError) {
          console.error("Failed to load cached pages:", cacheError);
        }

        // Final fallback to static pages
        console.log("📋 Using static fallback pages");
        setFeaturedPages(fallbackPages);
      }
    };

    if (isOpen) {
      loadPagesFromBackend();
    }
  }, [isOpen, backendPagesLoaded, fallbackPages]);

  // Save recent search
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    const updated = [
      searchQuery,
      ...recentSearches.filter((s) => s !== searchQuery),
    ].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem("glinrdock_recent_searches", JSON.stringify(updated));
  };

  // Load more results for infinite scroll
  const loadMoreResults = async () => {
    if (!query.trim() || pagination.loadingMore || !pagination.hasMore) return;

    try {
      setPagination((prev) => ({ ...prev, loadingMore: true }));

      const { operators, cleanQuery } = parseSearchOperators(query.trim());
      const searchQuery = cleanQuery.trim() || query.trim();
      const nextPage = pagination.page + 1;
      const pageSize = 20;

      console.log(
        "📄 Loading more results - page:",
        nextPage,
        "current total:",
        paginatedResults.length
      );

      const searchResult = await apiClient.search(searchQuery, {
        limit: pageSize,
        offset: nextPage * pageSize,
      });

      if (searchResult.hits && searchResult.hits.length > 0) {
        let newResults = searchResult.hits.filter((hit) =>
          matchesOperators(hit, operators)
        );

        // Update paginated results by appending new results
        setPaginatedResults((prev) => [...prev, ...newResults]);

        // Update pagination state
        const hasMore = searchResult.total
          ? (nextPage + 1) * pageSize < searchResult.total
          : newResults.length === pageSize;
        setPagination((prev) => ({
          ...prev,
          page: nextPage,
          hasMore,
          total: searchResult.total || prev.total,
          loadingMore: false,
        }));

        console.log("✅ Loaded more results:", {
          newResults: newResults.length,
          totalResults: paginatedResults.length + newResults.length,
          hasMore,
          total: searchResult.total,
        });
      } else {
        // No more results
        setPagination((prev) => ({
          ...prev,
          hasMore: false,
          loadingMore: false,
        }));
        console.log("🔚 No more results available");
      }
    } catch (error) {
      console.error("❌ Failed to load more results:", error);
      setPagination((prev) => ({ ...prev, loadingMore: false }));
    }
  };

  // Check FTS5 availability on mount
  useEffect(() => {
    apiClient
      .getSearchStatus()
      .then((status) => {
        setFts5Available(status.fts5);
      })
      .catch(() => {
        setFts5Available(false);
      });
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when results or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [results, selectedCategory]);

  // Reset pagination when query changes
  useEffect(() => {
    if (query.trim()) {
      setPagination({
        page: 0,
        hasMore: true,
        total: 0,
        loadingMore: false,
      });
      setPaginatedResults([]);
    }
  }, [query]);

  // Scroll detection for infinite loading
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;

    // Check if user scrolled near bottom (within 200px)
    if (
      scrollHeight - scrollTop - clientHeight < 200 &&
      pagination.hasMore &&
      !pagination.loadingMore
    ) {
      console.log("🔄 Near bottom - loading more results");
      loadMoreResults();
    }
  };

  // Attach scroll listener to results container
  useEffect(() => {
    const resultsContainer = resultsRef.current;
    if (resultsContainer) {
      resultsContainer.addEventListener("scroll", handleScroll);
      return () => resultsContainer.removeEventListener("scroll", handleScroll);
    }
  }, [pagination.hasMore, pagination.loadingMore]);

  // Enhanced smooth search with intelligent debouncing
  useEffect(() => {
    const trimmedQuery = query.trim();
    const now = Date.now();

    // Handle empty query
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setShowingDefaultContent(true);
      setIsTyping(false);
      return;
    }

    // Single character - show typing state but don't search
    if (trimmedQuery.length === 1) {
      setResults([]);
      setSuggestions([]);
      setShowingDefaultContent(true);
      setIsTyping(true);
      setLoading(false);
      setLoadingSuggestions(false);
      return;
    }

    // Multi-character search - switch to search mode
    setShowingDefaultContent(false);
    setIsTyping(true);

    // Cancel previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear previous timeouts
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Intelligent debounce delay based on query length and typing speed
    const timeSinceLastSearch = now - lastSearchTime;
    let debounceDelay: number;

    if (trimmedQuery.length === 2) {
      debounceDelay = 250; // Slightly longer for 2 chars to avoid too many requests
    } else if (trimmedQuery.length <= 4) {
      debounceDelay = timeSinceLastSearch < 500 ? 150 : 100; // Adaptive based on typing speed
    } else {
      debounceDelay = 80; // Very responsive for longer queries
    }

    // Show loading immediately for longer delays
    if (debounceDelay > 120) {
      setLoading(true);
    }

    // Start suggestions immediately for queries >= 2 characters (shorter debounce)
    if (trimmedQuery.length >= 2) {
      setLoadingSuggestions(true);
      setTimeout(async () => {
        const { operators } = parseSearchOperators(trimmedQuery);
        await fetchSuggestions(trimmedQuery, operators);
      }, 50); // Very short debounce for suggestions
    }

    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        setLastSearchTime(Date.now());

        // Parse advanced search operators
        const { operators, cleanQuery } = parseSearchOperators(trimmedQuery);
        const queryKey = trimmedQuery.toLowerCase();

        console.log(
          "🔍 Search operators:",
          operators,
          "Clean query:",
          cleanQuery
        );

        // Check cache first (with version validation)
        const cachedResult = getCachedResults(queryKey);
        if (cachedResult && cachedResult.version === CACHE_VERSION) {
          let backendResults = cachedResult.results.filter((hit) =>
            matchesOperators(hit, operators)
          );

          // Add matching page results to cached results too
          const matchingPages = allPages.filter((page) => {
            const searchText = `${page.title} ${page.subtitle || ""} ${
              page.content || ""
            }`.toLowerCase();
            const queryLower =
              cleanQuery.toLowerCase() || trimmedQuery.toLowerCase();
            const queryWords = queryLower
              .split(" ")
              .filter((word) => word.length > 0);

            // Check for matches: direct substring, word matches, or fuzzy matches
            const hasDirectMatch = searchText.includes(queryLower);
            const hasWordMatch = queryWords.some((word) =>
              searchText.includes(word)
            );

            // Simple fuzzy matching for common typos
            const hasFuzzyMatch = queryWords.some((word) => {
              if (word.length < 3) return false; // Skip very short words

              // Check if any word in the search text starts with the query word
              const searchWords = searchText.split(/\s+/);
              return searchWords.some((searchWord) => {
                // Allow 1-2 character differences for fuzzy matching
                if (Math.abs(searchWord.length - word.length) > 2) return false;

                // Simple edit distance approximation - check if they start similarly
                return (
                  searchWord.startsWith(word.slice(0, -1)) || // Remove last char
                  searchWord.startsWith(word.slice(0, -2)) || // Remove last 2 chars
                  word.startsWith(searchWord.slice(0, -1))
                ); // Query starts with search word
              });
            });

            return hasDirectMatch || hasWordMatch || hasFuzzyMatch;
          });

          // Merge cached backend results with page results
          const combinedResults = [...matchingPages, ...backendResults];

          setResults(combinedResults);
          // Initialize pagination with cached results
          setPaginatedResults(backendResults);
          setPagination({
            page: 0,
            hasMore: false, // No pagination for cached results
            total: backendResults.length,
            loadingMore: false,
          });
          setFts5Available(cachedResult.fts5Available);
          setLoading(false);
          setIsTyping(false);
          console.log("🎯 Cache hit with combined results:", {
            backendResults: backendResults.length,
            pageResults: matchingPages.length,
            total: combinedResults.length,
          });

          // Track analytics for cached results too
          trackSearchAnalytics(
            trimmedQuery,
            combinedResults,
            operators,
            selectedCategory
          );
          return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Use clean query for API search (without operators)
        const searchQuery = cleanQuery.trim() || trimmedQuery;
        const pageSize = 20;
        const searchResult = await apiClient.search(searchQuery, {
          limit: pageSize,
          offset: 0, // Start with first page
        });

        if (!controller.signal.aborted) {
          let results = searchResult.hits || [];

          console.log("🚀 SEARCH EXECUTION:", {
            originalQuery: trimmedQuery,
            cleanQuery: cleanQuery,
            operators: operators,
            backendResults: results.length,
            featuredPagesCount: featuredPages.length,
          });

          // Apply operator filtering to results
          if (Object.keys(operators).length > 0) {
            results = results.filter((hit) => matchesOperators(hit, operators));
            console.log(
              "🔧 Applied operator filtering:",
              Object.keys(operators),
              "- Results:",
              results.length
            );
          }

          // Add matching page results to search results
          console.log(
            `🔍 TESTING PAGE SEARCH - Query: "${trimmedQuery}" Clean: "${cleanQuery}"`
          );
          // Use enhanced search with relevance scoring for dynamic items (help articles)
          const dynamicMatches = searchDynamicItems(cleanQuery || trimmedQuery);
          
          // Filter static featured pages with existing logic
          const staticMatches = featuredPages.filter((page) => {
            const searchText = `${page.title} ${page.subtitle || ""} ${
              page.content || ""
            }`.toLowerCase();
            const queryLower =
              cleanQuery.toLowerCase() || trimmedQuery.toLowerCase();
            const queryWords = queryLower
              .split(" ")
              .filter((word) => word.length > 0);

            // Check for matches: direct substring, word matches, or fuzzy matches
            const hasDirectMatch = searchText.includes(queryLower);
            const hasWordMatch = queryWords.some((word) =>
              searchText.includes(word)
            );

            return hasDirectMatch || hasWordMatch;
          });
          
          // Combine static and dynamic matches, with dynamic first (better relevance scoring)
          const matchingPages = [...dynamicMatches, ...staticMatches];

          // Merge backend results with page results (pages first for navigation priority)
          const combinedResults = [...matchingPages, ...results];
          console.log("🔍 Combined results:", {
            backendResults: results.length,
            pageResults: matchingPages.length,
            total: combinedResults.length,
            totalFromBackend: searchResult.total,
            pages: matchingPages.map((p) => p.title),
          });

          setResults(combinedResults);
          // Initialize pagination with first page results
          setPaginatedResults(results);
          const hasMore = searchResult.total
            ? pageSize < searchResult.total
            : results.length === pageSize;
          setPagination({
            page: 0,
            hasMore,
            total: searchResult.total || results.length,
            loadingMore: false,
          });
          setLoading(false);
          setIsTyping(false);

          // Track search analytics with combined results
          trackSearchAnalytics(
            trimmedQuery,
            combinedResults,
            operators,
            selectedCategory
          );

          // Cache the original unfiltered results with version
          setCachedResults(queryKey, searchResult.hits || [], fts5Available);
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error("Search failed:", error);
          setResults([]);
          setLoading(false);
          setIsTyping(false);
        }
      }
    }, debounceDelay);

    // Set typing timeout to reset typing state
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, debounceDelay + 300); // Reset typing state after search completes

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [query]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const navigateToResult = (hit: SearchHit) => {
    // Save the current query as a recent search if it has actual results
    if (query.trim() && query.trim().length >= 2) {
      saveRecentSearch(query.trim());
    }

    // Smooth navigation without flash
    window.history.pushState({}, '', hit.url_path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    onClose();
  };

  // Handle clicking on recent search
  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
    // The useEffect will trigger search automatically
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("glinrdock_recent_searches");
  };

  // Fetch suggestions from API
  const fetchSuggestions = async (
    query: string,
    operators: Record<string, string>
  ) => {
    try {
      const { cleanQuery } = parseSearchOperators(query);
      const suggestQuery = cleanQuery.trim() || query.trim();
      const queryKey = `suggest:${suggestQuery.toLowerCase()}`;

      // Check cache first
      const cachedResult = getCachedSuggestions(queryKey);
      if (cachedResult) {
        setSuggestions(cachedResult.suggestions);
        setLoadingSuggestions(false);
        return;
      }

      // Parse operators for type filter
      let typeFilter: string | undefined;
      if (operators.type) {
        typeFilter = operators.type;
      } else if (selectedCategory && selectedCategory !== "all") {
        typeFilter = selectedCategory;
      }

      const suggestResult = await apiClient.suggest(suggestQuery, {
        type: typeFilter as any,
        limit: 8, // Limit suggestions to keep UI clean
      });

      if (suggestResult.suggestions) {
        // Filter out duplicates by url_path
        const uniqueSuggestions = suggestResult.suggestions.reduce(
          (acc, suggestion) => {
            const exists = acc.some((s) => s.url_path === suggestion.url_path);
            if (!exists) acc.push(suggestion);
            return acc;
          },
          [] as SearchSuggestion[]
        );

        setSuggestions(uniqueSuggestions);
        setCachedSuggestions(queryKey, uniqueSuggestions);
        console.log("🎯 Fetched suggestions:", uniqueSuggestions.length);
      }
    } catch (error) {
      console.warn("Failed to fetch suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedQuery})`, "gi");
      const parts = text.split(regex);

      return parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-purple-200/80 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200 px-1 rounded font-medium"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "project":
        return <FolderOpen className="w-4 h-4" />;
      case "service":
        return <Server className="w-4 h-4" />;
      case "route":
        return <Route className="w-4 h-4" />;
      case "registry":
        return <Database className="w-4 h-4" />;
      case "env_template":
        return <FileText className="w-4 h-4" />;
      case "setting":
        return <Settings className="w-4 h-4" />;
      case "page":
        return <Layers className="w-4 h-4" />;
      case "node":
        return <Network className="w-4 h-4" />;
      case "client":
        return <Users className="w-4 h-4" />;
      case "log":
        return <Terminal className="w-4 h-4" />;
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "help":
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case "project":
        return "text-blue-400";
      case "service":
        return "text-green-400";
      case "route":
        return "text-purple-400";
      case "registry":
        return "text-indigo-400";
      case "env_template":
        return "text-teal-400";
      case "setting":
        return "text-orange-400";
      case "page":
        return "text-pink-400";
      case "node":
        return "text-cyan-400";
      case "client":
        return "text-amber-400";
      case "log":
        return "text-slate-400";
      case "admin":
        return "text-red-400";
      case "help":
        return "text-emerald-400";
      default:
        return "text-purple-300";
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case "project":
        return "Projects";
      case "service":
        return "Services";
      case "route":
        return "Routes";
      case "registry":
        return "Registries";
      case "env_template":
        return "Environment Templates";
      case "setting":
        return "Settings";
      case "page":
        return "Pages";
      case "node":
        return "Nodes";
      case "client":
        return "Clients";
      case "log":
        return "Logs";
      case "admin":
        return "Administration";
      case "help":
        return "Help & Documentation";
      default:
        return "Other";
    }
  };

  // Combine static featured pages with dynamic search items
  const allPages = useMemo(() => {
    return [...featuredPages, ...dynamicSearchItems];
  }, [featuredPages, dynamicSearchItems]);

  // Enhanced search for dynamic items with relevance scoring
  const searchDynamicItems = (query: string) => {
    return searchRegistry.searchItems(query);
  };

  // Results are now combined in the search function itself
  // This ensures pages are included in both fresh searches and cached results
  const searchResults = results || [];

  // For search queries with pagination, merge pages with paginated backend results
  const paginatedCombinedResults = useMemo(() => {
    if (!query.trim() || paginatedResults.length === 0) {
      return searchResults;
    }

    // Find matching pages for the current query
    const { cleanQuery } = parseSearchOperators(query.trim());
    const matchingPages = allPages.filter((page) => {
      const searchText = `${page.title} ${page.subtitle || ""} ${
        page.content || ""
      }`.toLowerCase();
      const queryLower = (cleanQuery || query).toLowerCase().trim();
      return (
        searchText.includes(queryLower) ||
        queryLower.split(" ").some((word) => searchText.includes(word))
      );
    });

    // Combine pages with paginated results (pages first for navigation priority)
    return [...matchingPages, ...paginatedResults];
  }, [query, paginatedResults, allPages]);

  // For Pages category, prioritize backend pages over search results when not searching
  const effectiveResults =
    selectedCategory === "page" && !query.trim() && backendPagesLoaded
      ? allPages // Use loaded backend pages directly when browsing Pages category
      : query.trim() && paginatedResults.length > 0
      ? paginatedCombinedResults
      : searchResults;

  // Filter results by selected category
  const filteredResults =
    selectedCategory === "all"
      ? effectiveResults
      : effectiveResults.filter((hit) => hit.type === selectedCategory);

  // Create combined navigable items (suggestions + results)
  const combinedItems = useMemo(() => {
    const items: Array<{
      type: "suggestion" | "result";
      item: SearchSuggestion | SearchHit;
      index: number;
    }> = [];

    // Add suggestions first if visible
    if (isTyping && suggestions.length > 0) {
      suggestions.slice(0, 5).forEach((suggestion, index) => {
        items.push({ type: "suggestion", item: suggestion, index });
      });
    }

    // Add regular results
    filteredResults.forEach((result, index) => {
      items.push({ type: "result", item: result, index });
    });

    return items;
  }, [isTyping, suggestions, filteredResults]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, combinedItems.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (combinedItems[selectedIndex]) {
            const selectedItem = combinedItems[selectedIndex];
            if (selectedItem.type === "suggestion") {
              const suggestion = selectedItem.item as SearchSuggestion;
              trackSuggestionHit(suggestion, query);
              window.history.pushState({}, '', suggestion.url_path);
              window.dispatchEvent(new PopStateEvent('popstate'));
              onClose();
            } else {
              const result = selectedItem.item as SearchHit;
              navigateToResult(result);
            }
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, combinedItems, selectedIndex, onClose, query]);

  const groupedResults = filteredResults.reduce((groups, hit) => {
    const type = hit.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(hit);
    return groups;
  }, {} as Record<string, SearchHit[]>);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/15 dark:bg-black/20 backdrop-blur-lg"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="relative w-full max-w-3xl max-h-[70vh] min-h-[50vh] bg-white/90 dark:bg-black backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden flex flex-col mx-4 ring-1 ring-white/10 dark:ring-gray-700/20">
        {/* Enhanced Header with Glassmorphism */}
        <div className="relative flex items-center justify-between px-6 py-4 bg-gradient-to-r from-white/60 to-white/40 dark:from-black dark:to-gray-900/90 backdrop-blur-xl flex-shrink-0">
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
          <div className="flex items-center flex-1">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-700 dark:text-gray-300 mr-3 opacity-80" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse opacity-75"></div>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const newValue = (e.target as HTMLInputElement).value;
                setQuery(newValue);
                // Immediate feedback for single character
                if (newValue.length === 1) {
                  setIsTyping(true);
                }
              }}
              placeholder="Search projects, services, routes... (⌘K)"
              className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-400 outline-none text-lg font-medium tracking-wide"
            />
          </div>
          <div className="flex items-center gap-3">
            {!fts5Available && (
              <div className="flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 px-3 py-1.5 rounded-full border border-amber-300/30 dark:border-amber-700/30">
                <AlertTriangle className="w-3 h-3 mr-1.5" />
                <span className="font-medium">Basic Mode</span>
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-300/30 dark:border-blue-700/30">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="font-medium">Searching...</span>
              </div>
            )}
            {isTyping && !loading && query.trim().length >= 2 && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-900/30 px-3 py-1.5 rounded-full border border-green-300/30 dark:border-green-700/30">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium">Ready</span>
              </div>
            )}
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setShowingDefaultContent(true);
                  setIsTyping(false);
                  setLoading(false);
                  inputRef.current?.focus();
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 group"
                title="Clear search (Esc)"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Search Category Tabs */}
        {!showingDefaultContent && (
          <div className="px-6 py-3 border-b border-white/20 dark:border-gray-700/20 bg-gradient-to-r from-white/40 to-white/20 dark:from-gray-800/40 dark:to-gray-800/20 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Filter by Category</h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">{filteredResults.length} results</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {searchCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap backdrop-blur-sm ${
                    selectedCategory === category.id
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-400/20"
                      : "text-gray-700 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200/50 dark:border-gray-700/50"
                  }`}
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Main Content */}
          <div
            ref={resultsRef}
            className="flex-1 overflow-y-auto min-h-0 command-palette-scroll"
          >
            {showingDefaultContent ? (
              <div className="p-3">
                {/* Quick Navigation - Vertical List Layout */}
                {featuredPages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-xs font-medium text-blue-600 dark:text-blue-300 tracking-wide">
                        Quick Navigation
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {featuredPages.map((hit, index) => (
                        <button
                          key={`featured-${index}`}
                          onClick={() => navigateToResult(hit)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-100/60 dark:hover:bg-blue-500/5 backdrop-blur-sm rounded-md border border-transparent hover:border-blue-300/70 dark:hover:border-blue-500/10 transition-all group"
                        >
                          <div
                            className={`${getEntityColor(
                              hit.type
                            )} flex-shrink-0`}
                          >
                            {getEntityIcon(hit.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {highlightMatch(hit.title, query)}
                            </div>
                            {hit.subtitle && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {highlightMatch(hit.subtitle, query)}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider between sections */}
                {featuredPages.length > 0 && recentSearches.length > 0 && (
                  <div className="mx-3 my-3 border-t border-gray-300 dark:border-gray-600/20"></div>
                )}

                {/* Empty state when no recent searches or featured pages */}
                {recentSearches.length === 0 && featuredPages.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-600 dark:text-purple-200/70">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-base font-medium mb-2 text-gray-900 dark:text-white">
                      Search Everything
                    </p>
                    <p className="text-sm opacity-75">
                      Start typing to search across projects, services, and
                      routes
                    </p>
                  </div>
                )}
              </div>
            ) : query.length === 1 ? (
              <div className="px-4 py-8 text-center text-gray-600 dark:text-purple-200/70">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                  Keep Typing
                </p>
                <p className="text-sm opacity-75">
                  {isTyping && query.trim().length === 1
                    ? "Keep typing..."
                    : "Type at least 2 characters to start searching"}
                </p>
              </div>
            ) : loading ? (
              <div className="px-4 py-6 text-center text-gray-600 dark:text-gray-400">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-60" />
                <p className="text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">
                  Searching...
                </p>
                <p className="text-xs opacity-60">
                  Finding results for "{query}"
                </p>
              </div>
            ) : filteredResults.length === 0 && !loading && !isTyping ? (
              <div className="px-4 py-6 text-center text-gray-600 dark:text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-base font-medium mb-2 text-gray-800 dark:text-gray-200">
                  No results found
                </p>
                <p className="text-sm mb-3 opacity-75">
                  No matches for "
                  <span className="font-medium text-gray-900 dark:text-white">
                    {query}
                  </span>
                  "
                  {selectedCategory !== "all" && searchResults.length > 0 && (
                    <span> in {getEntityTypeLabel(selectedCategory)}</span>
                  )}
                </p>
                {selectedCategory !== "all" && searchResults.length > 0 ? (
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg transition-colors border border-blue-500/30 hover:border-blue-400/50"
                  >
                    View {searchResults.length} results in All categories
                  </button>
                ) : (
                  <p className="text-xs opacity-60">
                    Try different keywords or check spelling
                  </p>
                )}
              </div>
            ) : (
              <div className="py-2">
                {/* Suggestions section when typing */}
                {isTyping && suggestions.length > 0 && (
                  <div className="mb-4">
                    <div className="mx-4 mb-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide bg-gray-100 dark:bg-gradient-to-r dark:from-gray-900 dark:to-black/90 border border-gray-200 dark:border-gray-700/50 rounded-lg flex items-center gap-2">
                      <Search className="w-3 h-3" />
                      <span>Suggestions ({suggestions.length})</span>
                      {loadingSuggestions && (
                        <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                      )}
                    </div>
                    {suggestions.slice(0, 5).map((suggestion, index) => {
                      const globalIndex = index; // Suggestions come first in combined list
                      return (
                        <button
                          key={`suggestion-${suggestion.url_path}`}
                          onClick={() => {
                            trackSuggestionHit(suggestion, query);
                            window.history.pushState({}, '', suggestion.url_path);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                            onClose();
                          }}
                          className={`w-full flex items-start px-4 py-2.5 text-left bg-white/90 dark:bg-gray-900/50 hover:bg-gray-200/70 hover:shadow-sm dark:hover:bg-gradient-to-r dark:hover:from-purple-500/10 dark:hover:to-pink-500/10 transition-colors rounded-xl ${
                            globalIndex === selectedIndex
                              ? "bg-blue-100/80 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-200/50 dark:border-purple-400/50 shadow-lg"
                              : "border border-gray-200/50 dark:border-gray-700/30"
                          }`}
                        >
                          <div
                            className={`${getEntityColor(
                              suggestion.type
                            )} mt-0.5 mr-3 flex-shrink-0`}
                          >
                            {getEntityIcon(suggestion.type as any)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-800 dark:text-white truncate text-sm">
                                {highlightMatch(suggestion.label, query)}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded text-uppercase">
                                {getEntityTypeLabel(suggestion.type)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                              {suggestion.url_path}
                            </p>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <ChevronRight className="w-3 h-3 text-gray-500 dark:text-gray-500" />
                          </div>
                        </button>
                      );
                    })}
                    <div className="mx-3 my-3 border-t border-purple-500/20"></div>
                  </div>
                )}

                {selectedCategory === "all" &&
                Object.keys(groupedResults).length > 1
                  ? // Show grouped results when showing all categories and have multiple types
                    Object.entries(groupedResults).map(
                      ([type, hits], groupIndex) => (
                        <div
                          key={type}
                          className={groupIndex > 0 ? "mt-3" : ""}
                        >
                          <div className="mx-4 mb-1 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide bg-gray-100 dark:bg-gradient-to-r dark:from-gray-900 dark:to-black/90 border border-gray-200 dark:border-gray-700/50 rounded-lg flex items-center gap-2">
                            <span className={getEntityColor(type)}>
                              {getEntityIcon(type as any)}
                            </span>
                            <span>
                              {getEntityTypeLabel(type)} ({hits.length})
                            </span>
                          </div>
                          {hits.map((hit, hitIndex) => {
                            const suggestionOffset =
                              isTyping && suggestions.length > 0
                                ? Math.min(suggestions.length, 5)
                                : 0;
                            const globalIndex =
                              suggestionOffset +
                              Object.entries(groupedResults)
                                .slice(0, groupIndex)
                                .reduce(
                                  (acc, [, groupHits]) =>
                                    acc + groupHits.length,
                                  0
                                ) +
                              hitIndex;

                            return (
                              <button
                                key={`${hit.type}-${hit.entity_id}`}
                                onClick={() => navigateToResult(hit)}
                                className={`w-full flex items-start px-4 py-3 text-left bg-white/90 dark:bg-gray-900/50 hover:bg-gray-200/70 hover:shadow-sm dark:hover:bg-gradient-to-r dark:hover:from-purple-500/10 dark:hover:to-pink-500/10 backdrop-blur-sm transition-all rounded-xl ${
                                  globalIndex === selectedIndex
                                    ? "bg-blue-100/80 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-200/50 dark:border-purple-400/50 shadow-lg"
                                    : "border border-gray-200/50 dark:border-gray-700/30"
                                }`}
                              >
                                <div
                                  className={`${getEntityColor(
                                    hit.type
                                  )} mt-0.5 mr-3 flex-shrink-0`}
                                >
                                  {getEntityIcon(hit.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-800 dark:text-white truncate">
                                      {highlightMatch(hit.title, query)}
                                    </span>
                                    {fts5Available &&
                                      hit.score &&
                                      hit.score > 0 && (
                                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full font-mono">
                                          {hit.score.toFixed(1)}
                                        </span>
                                      )}
                                  </div>
                                  {hit.subtitle && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                      {highlightMatch(hit.subtitle, query)}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                                    {hit.url_path}
                                  </p>
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )
                    )
                  : // Show ungrouped results when filtering by category or single type
                    filteredResults.map((hit, index) => {
                      const suggestionOffset =
                        isTyping && suggestions.length > 0
                          ? Math.min(suggestions.length, 5)
                          : 0;
                      const globalIndex = suggestionOffset + index;
                      return (
                        <button
                          key={`${hit.type}-${hit.entity_id}`}
                          onClick={() => navigateToResult(hit)}
                          className={`w-full flex items-start px-4 py-3 text-left bg-white/90 dark:bg-gray-900/50 hover:bg-gray-200/70 hover:shadow-sm dark:hover:bg-gradient-to-r dark:hover:from-purple-500/10 dark:hover:to-pink-500/10 backdrop-blur-sm transition-all rounded-xl ${
                            globalIndex === selectedIndex
                              ? "bg-blue-100/80 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-200/50 dark:border-purple-400/50 shadow-lg"
                              : "border border-gray-200/50 dark:border-gray-700/30"
                          }`}
                        >
                          <div
                            className={`${getEntityColor(
                              hit.type
                            )} mt-0.5 mr-3 flex-shrink-0`}
                          >
                            {getEntityIcon(hit.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-800 dark:text-white truncate">
                                {highlightMatch(hit.title, query)}
                              </span>
                              {fts5Available && hit.score && hit.score > 0 && (
                                <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full font-mono">
                                  {hit.score.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {hit.subtitle && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {highlightMatch(hit.subtitle, query)}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                              {hit.url_path}
                            </p>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                          </div>
                        </button>
                      );
                    })}

                {/* Load More / Pagination Status */}
                {query.trim() && !showingDefaultContent && (
                  <>
                    {pagination.loadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Loading more results...
                        </span>
                      </div>
                    )}

                    {pagination.hasMore &&
                      !pagination.loadingMore &&
                      filteredResults.length > 10 && (
                        <div className="flex items-center justify-center py-4">
                          <button
                            onClick={loadMoreResults}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg transition-colors border border-blue-500/30 hover:border-blue-400/50"
                          >
                            <Search className="w-4 h-4" />
                            Load more results (
                            {pagination.total
                              ? `${filteredResults.length} of ${pagination.total}`
                              : `${filteredResults.length}+`}
                            )
                          </button>
                        </div>
                      )}

                    {!pagination.hasMore &&
                      !pagination.loadingMore &&
                      filteredResults.length > 10 && (
                        <div className="flex items-center justify-center py-4 text-xs text-gray-500 dark:text-gray-400">
                          All results loaded (
                          {pagination.total || filteredResults.length} total)
                        </div>
                      )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Content */}
          <div className="w-80 border-l border-white/20 dark:border-gray-700/20 bg-gradient-to-b from-white/30 to-white/10 dark:from-gray-800/30 dark:to-gray-800/10 backdrop-blur-xl overflow-y-auto custom-scrollbar">
            {/* Recent Searches */}
            {recentSearches.length > 0 && showingDefaultContent && (
              <div className="p-4 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-300 tracking-wide">
                      Recent Searches
                    </h3>
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className="opacity-60 group-hover:opacity-100 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-500/10 px-2 py-1 rounded-lg transition-all flex items-center gap-1"
                    title="Clear recent searches"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="font-medium">Clear</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {recentSearches.slice(0, 6).map((searchQuery, index) => (
                    <button
                      key={`recent-${index}`}
                      onClick={() => handleRecentSearchClick(searchQuery)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-amber-50/80 dark:bg-amber-900/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 rounded-lg border border-amber-200/50 dark:border-amber-700/30 hover:border-amber-300/70 dark:hover:border-amber-600/40 transition-all duration-200 backdrop-blur-sm group/item"
                      title={searchQuery}
                    >
                      <Search className="w-3 h-3 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="truncate font-medium">{searchQuery}</span>
                      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover/item:opacity-60 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Access Panel */}
            <QuickAccess 
              searchQuery={query}
              recentSearches={recentSearches}
              onSearchSelect={(searchQuery) => {
                setQuery(searchQuery);
                inputRef.current?.focus();
              }}
              onItemSelect={navigateToResult}
              isSearching={loading || loadingSuggestions}
            />

            {/* Analytics & Stats */}
            <div className="p-4 border-t border-white/20 dark:border-gray-700/20">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                  Quick Stats
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Search Mode:</span>
                  <span className={`px-2 py-1 rounded-full font-medium ${fts5Available ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                    {fts5Available ? 'Advanced' : 'Basic'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Total Pages:</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{featuredPages.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Recent Searches:</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{recentSearches.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-gray-700/20 bg-gradient-to-r from-white/60 to-white/40 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <kbd className="px-2.5 py-1.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-xs font-semibold shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 text-gray-800 dark:text-gray-200 ring-1 ring-gray-200/20 dark:ring-gray-700/20">
                    ↑
                  </kbd>
                  <kbd className="px-2.5 py-1.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-xs font-semibold shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 text-gray-800 dark:text-gray-200 ring-1 ring-gray-200/20 dark:ring-gray-700/20">
                    ↓
                  </kbd>
                </div>
                <span className="text-gray-700 dark:text-gray-400 text-sm font-medium ml-2">
                  Navigate
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 bg-blue-100/80 dark:bg-blue-900/50 backdrop-blur-sm border border-blue-300/50 dark:border-blue-600/50 rounded-lg text-xs font-semibold shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 text-blue-800 dark:text-blue-200 ring-1 ring-blue-200/20 dark:ring-blue-700/20">
                  ↵
                </kbd>
                <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">
                  Select
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 bg-red-100/80 dark:bg-red-900/50 backdrop-blur-sm border border-red-300/50 dark:border-red-600/50 rounded-lg text-xs font-semibold shadow-lg shadow-red-200/50 dark:shadow-red-900/50 text-red-800 dark:text-red-200 ring-1 ring-red-200/20 dark:ring-red-700/20">
                  Esc
                </kbd>
                <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">
                  Close
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${fts5Available ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`}></div>
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                GLINR
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Command Palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
