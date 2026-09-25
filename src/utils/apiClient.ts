/**
 * Robust API Client for LocalMarket POS Backend Requests.
 * Safely parses responses, handles non-JSON / HTML / Gateway error responses,
 * and provides clear, user-friendly diagnostics when the API server is unreachable.
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
 * Safely performs an HTTP request to the LocalMarket Express backend.
 * Guarantees that non-JSON responses (HTML 404s, 502/503 proxies, Gateway timeouts)
 * never trigger syntax parsing errors like "Unexpected token <" or "The page cannot be found".
 */
export async function apiRequest<T = any>(
  input: string | URL | Request,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(input, {
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
