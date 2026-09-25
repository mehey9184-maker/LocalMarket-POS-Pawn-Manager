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
 * Resolves a relative or absolute API route against the configured API base URL.
 */
export function resolveApiUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const baseUrl = getApiBaseUrl();
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
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

