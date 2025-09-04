import { useEffect } from 'preact/hooks';
import { useLocation } from 'wouter';

// Map of route patterns to page titles
const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/services': 'Services',
  '/routes': 'Routes',
  '/logs': 'Logs',
  '/settings': 'Settings',
  '/onboarding': 'Setup',
  '/login': 'Login',
};

// Generate title for service/project detail pages
const generateDynamicTitle = (path: string): string => {
  if (path.startsWith('/services/') && path.split('/').length === 3) {
    return 'Service Details';
  }
  if (path.startsWith('/projects/') && path.split('/').length === 3) {
    return 'Project Details';
  }
  if (path.startsWith('/settings/')) {
    const tab = path.split('/')[2];
    return tab ? `Settings - ${tab.charAt(0).toUpperCase() + tab.slice(1)}` : 'Settings';
  }
  if (path.startsWith('/routes/wizard')) {
    return 'Route Wizard';
  }
  if (path.startsWith('/quickstart/spring')) {
    return 'Spring Boot Setup';
  }
  return 'GLINR Dock';
};

export function usePageTitle(customTitle?: string) {
  const [location] = useLocation();

  useEffect(() => {
    let title = 'GLINR Dock';

    if (customTitle) {
      title = `${customTitle} | GLINR Dock`;
    } else {
      const pageTitle = routeTitles[location] || generateDynamicTitle(location);
      title = pageTitle === 'GLINR Dock' ? pageTitle : `${pageTitle} | GLINR Dock`;
    }

    document.title = title;

    // Set meta description based on page
    const description = getPageDescription(location);
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

  }, [location, customTitle]);
}

function getPageDescription(path: string): string {
  if (path === '/' || path === '/dashboard') {
    return 'GLINR Dock Dashboard - Monitor and manage your Docker containers and services';
  }
  if (path === '/projects') {
    return 'Manage your Docker projects and containerized applications';
  }
  if (path === '/services') {
    return 'View and control your Docker services and containers';
  }
  if (path === '/routes') {
    return 'Configure routing and load balancing for your services';
  }
  if (path === '/logs') {
    return 'View system and application logs';
  }
  if (path === '/settings') {
    return 'Configure GLINR Dock settings and preferences';
  }
  if (path.startsWith('/services/')) {
    return 'Service details, logs, configuration and monitoring';
  }
  if (path.startsWith('/projects/')) {
    return 'Project overview and service management';
  }
  return 'GLINR Dock - Docker Container Management Platform';
}