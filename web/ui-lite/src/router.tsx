import { Router as WouterRouter, Route, Switch, useLocation } from "wouter";
import { useState, useEffect } from "preact/hooks";
import { lazy, Suspense } from "preact/compat";
import Onboarding from "./pages/Onboarding";
import { Logs } from "./pages/Logs";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Services } from "./pages/Services";
import { ServiceTemplates } from "./pages/ServiceTemplates";
import { Routes } from "./pages/Routes";
import { RouteWizard } from "./pages/Routes/Wizard";
import { RouteEdit } from "./pages/Routes/RouteEdit";
import { Nodes } from "./pages/Nodes";
import { Administration } from "./pages/Administration";
import { Clients } from "./pages/Clients";
import { SpringBoot } from "./pages/Quickstart/SpringBoot";
import { Settings } from "./pages/Settings";
import { Integrations } from "./pages/Settings/Integrations";
import { IntegrationsSetup } from "./pages/Settings/IntegrationsSetup";
import { EnvironmentTemplatesDatabase } from "./pages/Settings/EnvironmentTemplatesDatabase";
import { Certificates } from "./pages/Settings/Certificates";
import { Registries } from "./pages/Registries";
import { ServiceDetailPage } from "./pages/Services/Detail";
import { NotFound } from "./components/NotFound";
import { usePageTitle } from "./hooks/usePageTitle";

// Lazy load help components to keep main bundle size small
const HelpIndex = lazy(() => import("./pages/Help/Index").then(m => ({ default: m.HelpIndex })));
const HelpView = lazy(() => import("./pages/Help/View").then(m => ({ default: m.HelpView })));
// Manual help pages are now handled through HelpView component

// Dashboard wrapper to handle navigation
function DashboardWrapper() {
  const handlePageChange = (page: string) => {
    window.history.pushState({}, '', `/app/${page}`);
  };
  
  return <Dashboard onPageChange={handlePageChange} />;
}

// Services wrapper to handle navigation
function ServicesWrapper() {
  const handleNavigateToService = (serviceId: string) => {
    window.history.pushState({}, '', `/app/services/${serviceId}`);
  };
  
  return <Services onNavigateToService={handleNavigateToService} />;
}

// Route edit wrapper to handle route parameters
function RouteEditWrapper({ params }: { params: { id: string } }) {
  return <RouteEdit routeId={params.id} />;
}

// Route wizard wrapper to handle sub-path routing
function RouteWizardWrapper() {
  return <RouteWizard />;
}

function Login() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!token.trim()) {
      setError("Please enter a token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/v1/auth/info", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        localStorage.setItem("glinrdock_token", token);
        window.location.href = "/app/";
      } else {
        const errorText = await response.text();
        if (response.status === 401) {
          setError("Invalid token");
        } else {
          setError(`Authentication failed (${response.status})`);
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-900">
      <div class="max-w-md w-full space-y-8 p-8">
        <div>
          <h1 class="text-3xl font-bold text-center text-white mb-2">
            GLINR Dock
          </h1>
          <h2 class="text-xl text-center text-gray-400">Sign in to continue</h2>
        </div>

        <form class="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="token"
              class="block text-sm font-medium text-gray-300 mb-2"
            >
              API Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onInput={(e) => setToken((e.target as HTMLInputElement).value)}
              placeholder="Enter your API token"
              class="input"
              disabled={loading}
              required
            />
            {error && <p class="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full btn btn-primary"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div class="text-center text-sm text-gray-400">
          <p>Enter your GLINR Dock API token to access the dashboard.</p>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const [location] = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/", icon: "D" },
    { name: "Projects", path: "/projects", icon: "P" },
    { name: "Services", path: "/services", icon: "S" },
    { name: "Routes", path: "/routes", icon: "R" },
    { name: "Logs", path: "/logs", icon: "L" },
    { name: "Settings", path: "/settings", icon: "Set" },
    { name: "Help", path: "/help", icon: "?" },
  ];

  return (
    <aside class="hidden md:flex md:w-64 md:flex-col">
      <div class="flex flex-col flex-grow pt-5 bg-gray-800 overflow-y-auto">
        <div class="flex items-center flex-shrink-0 px-4">
          <h1 class="text-xl font-bold text-white">
            <a href="/app/">GLINR Dock</a>
          </h1>
        </div>

        <div class="mt-5 flex-grow flex flex-col">
          <nav class="flex-1 px-2 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={`/app${item.path}`}
                class={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  location === item.path ||
                  (item.path !== "/" && location.startsWith(item.path))
                    ? "bg-gray-900 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span
                  class={`mr-3 h-6 w-6 text-center ${
                    location === item.path ? "text-gray-300" : "text-gray-400"
                  }`}
                >
                  {item.icon}
                </span>
                {item.name}
              </a>
            ))}
          </nav>
        </div>

        <div class="flex-shrink-0 p-4 border-t border-gray-700">
          <div class="text-xs text-gray-400">UI-Lite v1.0</div>
        </div>
      </div>
    </aside>
  );
}

export function RequireAuth({ children }: { children: any }) {
  const token = localStorage.getItem("glinrdock_token");
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [onboardingNeeded, setOnboardingNeeded] = useState<boolean | null>(
    null
  );

  if (!token) {
    setLocation("/login");
    return null;
  }

  useEffect(() => {
    const checkOnboarding = async () => {
      // Skip onboarding check for onboarding page itself and login/license pages
      if (
        location === "/onboarding" ||
        location === "/login" ||
        location === "/license"
      ) {
        setOnboardingNeeded(false);
        return;
      }

      try {
        const response = await fetch("/v1/system/onboarding");
        if (response.ok) {
          const data = await response.json();
          setOnboardingNeeded(data.needed);

          if (data.needed && location !== "/onboarding") {
            setLocation("/onboarding");
          }
        } else {
          setOnboardingNeeded(false);
        }
      } catch (err) {
        console.error("Failed to check onboarding status:", err);
        setOnboardingNeeded(false);
      }
    };

    checkOnboarding();
  }, [location, setLocation]);

  // Show loading while checking onboarding status
  if (onboardingNeeded === null) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-gray-900">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p class="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
}

function Layout({ children }: { children: any }) {
  // Use the page title hook for automatic title management
  // Individual pages can override this by calling usePageTitle with custom title
  usePageTitle();

  return (
    <div class="flex h-screen bg-gray-900">
      <Nav />
      <main class="flex-1 relative overflow-y-auto focus:outline-none">
        <div class="p-6">{children}</div>
      </main>
    </div>
  );
}

// Service Detail wrapper to handle props from URL params
function ServiceDetailWrapper() {
  const [location] = useLocation();
  const params = location.split('/');
  const serviceId = params[2] || '';
  const tab = params[3] || 'overview';
  
  const handleBack = () => {
    window.history.pushState({}, '', '/app/services');
  };
  
  const handleTabChange = (newTab: string) => {
    const newPath = newTab === 'overview' 
      ? `/app/services/${serviceId}`
      : `/app/services/${serviceId}/${newTab}`;
    window.history.pushState({}, '', newPath);
  };
  
  return (
    <ServiceDetailPage 
      serviceId={serviceId}
      initialTab={tab}
      onBack={handleBack}
      onTabChange={handleTabChange}
    />
  );
}

// Help wrapper components to handle navigation
function HelpIndexWrapper() {
  const handleNavigateToHelp = (slug: string) => {
    window.history.pushState({}, '', `/app/help/${slug}`);
  };

  return (
    <Suspense fallback={
      <div class="p-6">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="text-center text-gray-400 mt-4">Loading help...</p>
      </div>
    }>
      <HelpIndex onNavigateToHelp={handleNavigateToHelp} />
    </Suspense>
  );
}

function HelpViewWrapper() {
  const [location] = useLocation();
  const params = location.split('/');
  // For /help/guides/troubleshoot -> params = ['', 'help', 'guides', 'troubleshoot']  
  // We want everything after /help/
  let slug = params.slice(2).join('/') || '';
  
  // Strip .md extension if present
  if (slug.endsWith('.md')) {
    slug = slug.slice(0, -3);
  }
  
  const handleBack = () => {
    window.history.pushState({}, '', '/app/help');
  };
  
  const handleNavigateToHelp = (newSlug: string) => {
    window.history.pushState({}, '', `/app/help/${newSlug}`);
  };

  // Handle manual pages that don't come from the manifest but should use HelpView
  // These pages will be handled by HelpView with custom document loading

  return (
    <Suspense fallback={
      <div class="p-6">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="text-center text-gray-400 mt-4">Loading help document...</p>
      </div>
    }>
      <HelpView 
        slug={slug}
        onBack={handleBack}
        onNavigateToHelp={handleNavigateToHelp}
      />
    </Suspense>
  );
}

// Page transition wrapper to prevent flash
function PageWrapper({ children }: { children: any }) {
  return (
    <div class="fade-in" style="animation-duration: 150ms;">
      {children}
    </div>
  );
}

// Clean wouter-based routing - just the routes, no layout
export function ContentRouter() {
  return (
    <WouterRouter base="/app">
      <PageWrapper>
        <Switch>
        {/* Exact routes first */}
        <Route path="/" component={DashboardWrapper} />
        <Route path="/dashboard" component={DashboardWrapper} />
        
        {/* Specific nested routes before parent routes */}
        <Route path="/routes/wizard">
        <RouteWizard />
      </Route>
        <Route path="/routes/:id/edit" component={RouteEditWrapper} />
        <Route path="/quickstart/spring" component={SpringBoot} />
        <Route path="/settings/environments/tpl-database" component={EnvironmentTemplatesDatabase} />
        <Route path="/settings/integrations/setup" component={IntegrationsSetup} />
        <Route path="/settings/integrations" component={Integrations} />
        <Route path="/settings/certificates" component={Certificates} />
        <Route path="/settings" component={Settings} />
        
        {/* Help routes - specific nested routes first */}
        <Route path="/help/:section/:slug" component={HelpViewWrapper} />
        <Route path="/help/:slug" component={HelpViewWrapper} />
        <Route path="/help" component={HelpIndexWrapper} />
        
        {/* Service detail routes - need specific handling */}
        <Route path="/services/:id/:tab?" component={ServiceDetailWrapper} />
        
        {/* Main section routes */}
        <Route path="/projects/:id?" component={Projects} />
        <Route path="/services" component={ServicesWrapper} />
        <Route path="/templates" component={ServiceTemplates} />
        <Route path="/routes" component={Routes} />
        <Route path="/nodes" component={Nodes} />
        <Route path="/administration" component={Administration} />
        <Route path="/clients" component={Clients} />
        <Route path="/logs" component={Logs} />
        <Route path="/registries" component={Registries} />
        
        {/* Catch-all 404 - MUST be last */}
        <Route path="*" component={NotFound} />
      </Switch>
      </PageWrapper>
    </WouterRouter>
  );
}

// Clean wouter-based routing for content only
function AppRoutes() {
  return (
    <Switch>
      {/* Exact routes first */}
      <Route path="/" component={DashboardWrapper} />
      <Route path="/dashboard" component={DashboardWrapper} />
      
      {/* Specific nested routes before parent routes */}
      <Route path="/routes/wizard" component={RouteWizardWrapper} />
      <Route path="/routes/:id/edit" component={RouteEditWrapper} />
      <Route path="/quickstart/spring" component={SpringBoot} />
      <Route path="/settings/environments/tpl-database" component={EnvironmentTemplatesDatabase} />
      <Route path="/settings/integrations/setup" component={IntegrationsSetup} />
      <Route path="/settings/integrations" component={Integrations} />
      <Route path="/settings/certificates" component={Certificates} />
      <Route path="/settings" component={Settings} />
      
      {/* Help routes - specific nested routes first */}
      <Route path="/help/:section/:slug" component={HelpViewWrapper} />
      <Route path="/help/:slug" component={HelpViewWrapper} />
      <Route path="/help" component={HelpIndexWrapper} />
      
      {/* Service detail routes - need specific handling */}
      <Route path="/services/:id/:tab?" component={ServiceDetailWrapper} />
      
      {/* Main section routes - specific routes first */}
      <Route path="/projects/:id?" component={Projects} />
      <Route path="/services" component={ServicesWrapper} />
      <Route path="/templates" component={ServiceTemplates} />
      <Route path="/nodes" component={Nodes} />
      <Route path="/administration" component={Administration} />
      <Route path="/clients" component={Clients} />
      <Route path="/logs" component={Logs} />
      <Route path="/registries" component={Registries} />
      <Route path="/routes" component={Routes} />
      
      {/* Catch-all 404 - MUST be last */}
      <Route path="*" component={NotFound} />
    </Switch>
  );
}

export function Router() {
  return (
    <WouterRouter base="/app">
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/onboarding" component={Onboarding} />

        <Route path="/*">
          <RequireAuth>
            <Layout>
              <AppRoutes />
            </Layout>
          </RequireAuth>
        </Route>
      </Switch>
    </WouterRouter>
  );
}
