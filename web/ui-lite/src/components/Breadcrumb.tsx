import { ChevronRight, Home } from "lucide-preact";
import { Link } from "wouter";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: any;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav class={`flex items-center space-x-1 text-sm ${className}`} aria-label="Breadcrumb">
      <ol class="flex items-center space-x-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const IconComponent = item.icon;

          return (
            <li key={index} class="flex items-center">
              {index > 0 && (
                <ChevronRight class="w-4 h-4 text-gray-400 mx-2" />
              )}
              
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  class="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {IconComponent && <IconComponent class="w-4 h-4 mr-1.5" />}
                  {item.label}
                </Link>
              ) : (
                <span
                  class={`flex items-center ${
                    isLast
                      ? "text-gray-900 dark:text-white font-medium"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {IconComponent && <IconComponent class="w-4 h-4 mr-1.5" />}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Common breadcrumb patterns for the app
export const createServiceBreadcrumb = (
  projectName: string,
  serviceName: string,
  currentPage?: string,
  projectId?: string,
  serviceId?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: "Dashboard",
      href: "/",
      icon: Home
    },
    {
      label: "Projects",
      href: "/projects"
    }
  ];

  if (projectName) {
    items.push({
      label: projectName,
      href: projectId ? `/projects/${projectId}` : undefined
    });
  }

  if (serviceName) {
    items.push({
      label: "Services",
      href: projectId ? `/projects/${projectId}/services` : undefined
    });
    
    items.push({
      label: serviceName,
      href: serviceId ? `/services/${serviceId}` : undefined
    });
  }

  if (currentPage) {
    items.push({
      label: currentPage,
      active: true
    });
  }

  return items;
};

export const createProjectBreadcrumb = (
  projectName: string,
  currentPage?: string,
  projectId?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: "Dashboard", 
      href: "/",
      icon: Home
    },
    {
      label: "Projects",
      href: "/projects"
    }
  ];

  if (projectName) {
    items.push({
      label: projectName,
      href: projectId ? `/projects/${projectId}` : undefined
    });
  }

  if (currentPage) {
    items.push({
      label: currentPage,
      active: true
    });
  }

  return items;
};

// Responsive breadcrumb that collapses on mobile
export function ResponsiveBreadcrumb({ items, className = "" }: BreadcrumbProps) {
  if (items.length <= 2) {
    return <Breadcrumb items={items} className={className} />;
  }

  // On mobile, show only first, last, and current
  const mobileItems = items.length > 3 ? [
    items[0],
    { label: "...", href: undefined },
    items[items.length - 1]
  ] : items;

  return (
    <div class={className}>
      {/* Desktop breadcrumb */}
      <div class="hidden md:block">
        <Breadcrumb items={items} />
      </div>
      
      {/* Mobile breadcrumb */}
      <div class="md:hidden">
        <Breadcrumb items={mobileItems} />
      </div>
    </div>
  );
}