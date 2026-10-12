/**
 * Robust API Client for LocalMarket POS Backend Requests.
 * Safely parses responses, handles non-JSON / HTML / Gateway error responses,
 * and provides clear, user-friendly diagnostics when the API server is unreachable.
 * 
 * Supports configurable API base URL via VITE_API_BASE_URL or window.__LOCALMARKET_API_BASE_URL__.
 * - Empty / unset: Uses relative /api paths (standard local & Electron mode).
 * - Set: Uses targeted server URL (e.g. http://192.168.1.50:3000) for LAN multi-device mode.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isJson: boolean;
}

const BACKEND_UNAVAILABLE_MESSAGE =
  "LocalMarket backend is not reachable. The app interface is running, but the API server is unavailable.";

export const DEFAULT_PRODUCTION_CLOUD_ORIGIN = "https://local-market-nine.vercel.app";

/**
 * List of privileged routes that require server-side administrative credentials
 * (Supabase service-role, Backblaze B2 application keys).
 * In Electron desktop environments, these must route to the authenticated Cloud backend.
 */
export const CLOUD_REQUIRED_ROUTES = [
  '/api/auth/login-with-pin',
  '/api/auth/login-with-password',
  '/api/auth/setup-manager-password',
  '/api/verify-pin',
  '/api/staff/provision',
  '/api/staff/update-profile',
  '/api/staff/reset-pin',
  '/api/staff/update-access',
  '/api/storage/upload',
  '/api/storage/delete',
] as const;

/**
 * Checks whether an API path requires the privileged cloud backend in desktop mode.
 */
export function isCloudRequiredRoute(pathOrUrl: string): boolean {
  const cleanPath = pathOrUrl.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return (CLOUD_REQUIRED_ROUTES as readonly string[]).includes(normalized);
}

/**
 * Detects whether the current execution context is the Electron desktop application.
 */
export function isDesktopApp(): boolean {
  const globalTarget = typeof window !== 'undefined' ? window : globalThis;
  if (globalTarget && (globalTarget as any).electronAPI?.isDesktop) {
    return true;
  }
  if (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent || '')) {
    return true;
  }
  if (typeof process !== 'undefined' && (process.versions?.electron || process.env?.IS_ELECTRON_MAIN || process.env?.ELECTRON_APP)) {
    return true;
  }
  return false;
}

/**
 * Returns the configured API base URL, normalized without trailing slashes.
 */
export function getApiBaseUrl(): string {
  // 1. Check Vite build-time / env-time variable
  const envBaseUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL;
  if (envBaseUrl && typeof envBaseUrl === 'string' && envBaseUrl.trim() !== '') {
    return envBaseUrl.trim().replace(/\/+$/, '');
  }

  // 2. Check runtime global/window configuration (for dynamic LAN configuration)
  const globalTarget = typeof window !== 'undefined' ? window : globalThis;
  if (globalTarget && (globalTarget as any).__LOCALMARKET_API_BASE_URL__) {
    const customBaseUrl = (globalTarget as any).__LOCALMARKET_API_BASE_URL__;
    if (typeof customBaseUrl === 'string' && customBaseUrl.trim() !== '') {
      return customBaseUrl.trim().replace(/\/+$/, '');
    }
  }

  return '';
}

/**
 * Returns the effective cloud origin for privileged cloud-required operations.
 */
export function getCloudApiOrigin(): string {
  const globalTarget = typeof window !== 'undefined' ? window : globalThis;
  if (globalTarget && (globalTarget as any).__LOCALMARKET_CLOUD_ORIGIN__) {
    const customOrigin = (globalTarget as any).__LOCALMARKET_CLOUD_ORIGIN__;
    if (typeof customOrigin === 'string' && customOrigin.trim() !== '') {
      return customOrigin.trim().replace(/\/+$/, '');
    }
  }

  const envCloudUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_API_URL;
  if (envCloudUrl && typeof envCloudUrl === 'string' && envCloudUrl.trim() !== '') {
    return envCloudUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_PRODUCTION_CLOUD_ORIGIN;
}

/**
 * Resolves an API route. In Electron desktop mode:
 * - Privileged cloud routes (/api/auth/*, /api/verify-pin, /api/staff/*, /api/storage/*)
 *   route to the production cloud origin (https://local-market-nine.vercel.app).
 * - Local routes (/api/health, /api/market-intelligence/*) remain on the local Express server.
 * In standard web browser mode:
 * - Uses relative path or configured VITE_API_BASE_URL.
 */
export function resolveApiUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  // If in desktop environment and route is a cloud-required privileged route:
  if (isDesktopApp() && isCloudRequiredRoute(cleanPath)) {
    const cloudOrigin = getCloudApiOrigin();
    return `${cloudOrigin}${cleanPath}`;
  }

  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

/**
 * Safely performs an HTTP request to the LocalMarket Express backend.
 * Guarantees that non-JSON responses (HTML 404s, 502/503 proxies, Gateway timeouts)
 * never trigger syntax parsing errors like "Unexpected token <" or "The page cannot be found".
 */
export async function apiRequest<T = any>(
  input: string | URL | Request,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const resolvedInput = typeof input === 'string' ? resolveApiUrl(input) : input;

    const response = await fetch(resolvedInput, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (!isJson) {
      const rawText = await response.text().catch(() => '');
      const trimmed = rawText.trim();

      // Detect HTML error page or empty response
      const isHtmlOrPageError =
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<html') ||
        trimmed.toLowerCase().startsWith('the page') ||
        trimmed.startsWith('<');

      const message = isHtmlOrPageError
        ? BACKEND_UNAVAILABLE_MESSAGE
        : (trimmed || BACKEND_UNAVAILABLE_MESSAGE);

      return {
        ok: false,
        status: response.status,
        error: message,
        isJson: false,
      };
    }

    try {
      const data = await response.json();
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: !response.ok ? (data?.error || `Request failed with status ${response.status}`) : undefined,
        isJson: true,
      };
    } catch (parseErr: any) {
      return {
        ok: false,
        status: response.status,
        error: BACKEND_UNAVAILABLE_MESSAGE,
        isJson: false,
      };
    }
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      error: netErr?.message || BACKEND_UNAVAILABLE_MESSAGE,
      isJson: false,
    };
  }
}

/**
 * Convenience helper for JSON POST requests
 */
export async function apiPost<T = any>(
  url: string,
  body?: any,
  token?: string,
  customHeaders?: Record<string, string>
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(url, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

