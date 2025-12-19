import { useState, useEffect, useMemo, useRef } from 'react';
import { createContext, useContext } from 'react';
import { useRouteStore } from '@/client/features/router';
import { useIsAdmin } from '@/client/features/auth';

// Define router context and types
type RouteParams = Record<string, string>;
type QueryParams = Record<string, string>;

type RouterContextType = {
  currentPath: string;
  routeParams: RouteParams;
  queryParams: QueryParams;
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  routeParams: {},
  queryParams: {},
  navigate: () => { },
});

// Custom hook to use router
export const useRouter = () => useContext(RouterContext);

// Helper function to parse route parameters
const parseRouteParams = (currentPath: string, routePattern: string): RouteParams => {
  // Convert route pattern to regex
  // e.g., '/items/:id' becomes /^\/items\/([^\/]+)$/
  const paramNames: string[] = [];
  const patternRegex = routePattern.replace(/:[^\/]+/g, (match) => {
    paramNames.push(match.substring(1)); // Store param name without the colon
    return '([^/]+)';
  });

  const regex = new RegExp(`^${patternRegex.replace(/\//g, '\\/')}$`);
  const match = currentPath.match(regex);

  if (!match) return {};

  // Create params object from matched groups
  const params: RouteParams = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1]; // +1 because match[0] is the full match
  });

  return params;
};

// Helper function to parse query parameters
const parseQueryParams = (): QueryParams => {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const queryParams: QueryParams = {};

  params.forEach((value, key) => {
    queryParams[key] = value;
  });

  return queryParams;
};

// Routes that should NOT be persisted/restored
const EXCLUDED_ROUTES = ['/login', '/register', '/logout', '/forgot-password'];

// Router provider component
export const RouterProvider = ({ children, routes }: {
  children?: (Component: React.ComponentType) => React.ReactNode,
  routes: Record<string, React.ComponentType>
}) => {
  // Get setLastRoute action from route store
  const setLastRoute = useRouteStore((state) => state.setLastRoute);
  const hasRestoredRoute = useRef(false);
  const isAdmin = useIsAdmin();

  // Initialize with current path or default to '/'
  // eslint-disable-next-line state-management/prefer-state-architecture -- core router state, persisted separately to useUIStore
  const [currentPath, setCurrentPath] = useState<string>(() => {
    // Use the pathname part of the URL without the leading slash
    return typeof window !== 'undefined'
      ? window.location.pathname === '/'
        ? '/'
        : window.location.pathname
      : '/';
  });

  // Parse query parameters
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral query params from URL
  const [queryParams, setQueryParams] = useState<QueryParams>(() => parseQueryParams());

  // Restore last route on initial mount (only once)
  // This effect intentionally has no dependencies - it reads initial values on mount only
  useEffect(() => {
    if (hasRestoredRoute.current) return;
    hasRestoredRoute.current = true;

    // Get current values at mount time
    const initialPath = window.location.pathname === '/' ? '/' : window.location.pathname;
    const savedRoute = useRouteStore.getState().getValidLastRoute();

    // Only restore if:
    // 1. We have a valid last route
    // 2. Current path is the root (/) - indicates fresh app load
    // 3. The route is not excluded
    // 4. The route is not admin-only for non-admin users
    if (savedRoute &&
      initialPath === '/' &&
      !EXCLUDED_ROUTES.some(excluded => savedRoute.startsWith(excluded)) &&
      !(savedRoute.startsWith('/admin') && !isAdmin)) {
      // Navigate to the last route
      window.history.replaceState(null, '', savedRoute);
      setCurrentPath(savedRoute);
      setQueryParams(parseQueryParams());
    }
  }, [isAdmin]);

  // Persist current route to UI store
  useEffect(() => {
    // Don't persist excluded routes
    if (!EXCLUDED_ROUTES.some(excluded => currentPath.startsWith(excluded)) &&
      !(currentPath.startsWith('/admin') && !isAdmin)) {
      setLastRoute(currentPath);
    }
  }, [currentPath, setLastRoute, isAdmin]);

  // Enforce admin-only routes centrally: any /admin/* path requires admin.
  useEffect(() => {
    if (currentPath.startsWith('/admin') && !isAdmin) {
      // Redirect non-admins to home.
      window.history.replaceState(null, '', '/');
      setCurrentPath('/');
      setQueryParams(parseQueryParams());
    }
  }, [currentPath, isAdmin]);

  // Find matching route pattern and parse route parameters
  const { RouteComponent, routeParams } = useMemo(() => {
    const pathWithoutQuery = currentPath.split('?')[0];

    // Treat admin routes as home for non-admins (helps avoid flash before redirect effect runs).
    const effectivePath = (pathWithoutQuery.startsWith('/admin') && !isAdmin) ? '/' : pathWithoutQuery;
    // First check for exact matches
    if (routes[effectivePath]) {
      return { RouteComponent: routes[effectivePath], routeParams: {} };
    }

    // Then check for parameterized routes
    for (const pattern in routes) {
      if (pattern.includes(':')) {
        const params = parseRouteParams(effectivePath, pattern);
        if (Object.keys(params).length > 0) {
          return { RouteComponent: routes[pattern], routeParams: params };
        }
      }
    }

    // Fallback to not-found or home
    return {
      RouteComponent: routes['/not-found'] || routes['/'],
      routeParams: {}
    };
  }, [currentPath, routes, isAdmin]);

  // Handle navigation
  const navigate = (path: string, options: { replace?: boolean } = {}) => {
    // Update browser history
    if (options.replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }

    // Update current path state
    setCurrentPath(path);

    // Update query params
    setQueryParams(parseQueryParams());
  };

  // Listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setQueryParams(parseQueryParams());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Provide router context and render current route
  return (
    <RouterContext.Provider value={{ currentPath, routeParams, queryParams, navigate }}>
      {children ? children(RouteComponent) : <RouteComponent />}
    </RouterContext.Provider>
  );
};

// Route mapping utility
export const createRoutes = (routeComponents: Record<string, React.ComponentType>) => {
  return routeComponents;
};
