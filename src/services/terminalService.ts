import { getValidSupabaseSession } from './supabase';

const TERMINAL_STORAGE_KEY = 'localmarket_device_terminal_id';
const TERMINAL_NAME_KEY = 'localmarket_device_terminal_name';

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(TERMINAL_STORAGE_KEY);
  if (!id) {
    id = `TERM-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    localStorage.setItem(TERMINAL_STORAGE_KEY, id);
  }
  return id;
}

export function getTerminalName(): string {
  let name = localStorage.getItem(TERMINAL_NAME_KEY);
  if (!name) {
    name = `Terminal ${getOrCreateDeviceId().substring(5)}`;
    localStorage.setItem(TERMINAL_NAME_KEY, name);
  }
  return name;
}

export async function checkTerminalConflict(terminalId: string): Promise<{
  hasConflict: boolean;
  existingTerminalId?: string;
  existingTerminalName?: string;
  lastActive?: string;
  error?: string;
}> {
  try {
    const session = await getValidSupabaseSession();
    if (!session?.access_token) {
      return { hasConflict: false };
    }

    const res = await fetch('/api/terminal/check-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ terminalId })
    });

    if (!res.ok) {
      return { hasConflict: false };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    // Offline resilient: do not block if network is unreachable
    console.warn('Terminal conflict check bypassed (offline/network error):', err.message);
    return { hasConflict: false };
  }
}

export async function activateTerminalSession(
  terminalId: string,
  terminalName: string,
  isSwitch: boolean = false
): Promise<{
  success: boolean;
  sessionToken?: string;
  error?: string;
}> {
  try {
    const session = await getValidSupabaseSession();
    if (!session?.access_token) {
      return { success: true };
    }

    const res = await fetch('/api/terminal/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        terminalId,
        terminalName,
        isSwitch
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Failed to activate terminal.' };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('Terminal activation offline fallback:', err.message);
    return { success: true };
  }
}

export async function sendTerminalHeartbeat(
  terminalId: string,
  sessionToken?: string
): Promise<{
  isActive: boolean;
  isInvalidated: boolean;
  reason?: string;
}> {
  try {
    const session = await getValidSupabaseSession();
    if (!session?.access_token) {
      return { isActive: true, isInvalidated: false };
    }

    const res = await fetch('/api/terminal/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        terminalId,
        sessionToken
      })
    });

    if (!res.ok) {
      // Temporary network error: keep cashier working offline
      return { isActive: true, isInvalidated: false };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    // Network failure: stay active locally
    return { isActive: true, isInvalidated: false };
  }
}

export async function invalidateTerminalSession(terminalId: string): Promise<void> {
  try {
    const session = await getValidSupabaseSession();
    if (!session?.access_token) return;

    await fetch('/api/terminal/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ terminalId })
    });
  } catch (err: any) {
    console.warn('Terminal logout notice failed (offline):', err.message);
  }
}
