import { terminalSessionsApi } from './supabaseApi';
import { db } from '../db';
import { TerminalSession } from '../types';

const HEARTBEAT_INTERVAL = 60000; // 1 minute
const LOCAL_STORAGE_DEVICE_ID_KEY = 'localmarket_device_id';
const LOCAL_STORAGE_TERMINAL_SESSION_KEY = 'localmarket_active_terminal_session';

export const terminalService = {
  getDeviceId(): string {
    let deviceId = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY) : 'term-node-test';
    if (!deviceId) {
      deviceId = `term-${crypto.randomUUID().slice(0, 12)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_DEVICE_ID_KEY, deviceId);
      }
    }
    return deviceId;
  },

  getCachedLocalSession(): TerminalSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async checkActiveSession() {
    return await terminalSessionsApi.checkActiveSessionRpc();
  },

  async activateSession(
    terminalName: string | undefined,
    identity: {
      shopId: string;
      userId: string;
      userName: string;
    }
  ) {
    const deviceId = this.getDeviceId();
    const res = await terminalSessionsApi.activateSessionRpc(deviceId, terminalName);
    
    if (res.success && res.session_id) {
      const session: TerminalSession = {
        id: res.session_id,
        shopId: identity.shopId,
        userId: identity.userId,
        userName: identity.userName,
        deviceId,
        activatedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        status: 'active'
      };
      
      // Store locally in Dexie and synchronous localStorage cache
      await db.terminalSessions.clear();
      await db.terminalSessions.add(session);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY, JSON.stringify(session));
      }
      
      return { success: true, sessionId: res.session_id };
    }
    
    return res;
  },

  async clearLocalSession() {
    await db.terminalSessions.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY);
    }
  },

  async heartbeat(sessionId: string) {
    try {
      const res = await terminalSessionsApi.heartbeatRpc(sessionId);
      
      if (res.status === 'active') {
        const now = new Date().toISOString();
        await db.terminalSessions.update(sessionId, {
          lastHeartbeatAt: now
        });
        const current = this.getCachedLocalSession();
        if (current && current.id === sessionId && typeof window !== 'undefined') {
          current.lastHeartbeatAt = now;
          localStorage.setItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY, JSON.stringify(current));
        }
      } else if (res.status === 'invalidated' || res.status === 'expired') {
        await db.terminalSessions.update(sessionId, {
          status: res.status as any,
          invalidatedAt: (res as any).invalidated_at
        });
        const current = this.getCachedLocalSession();
        if (current && current.id === sessionId && typeof window !== 'undefined') {
          current.status = res.status as any;
          (current as any).invalidatedAt = (res as any).invalidated_at;
          localStorage.setItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY, JSON.stringify(current));
        }
      }
      
      return res;
    } catch (err: any) {
      return { success: false, status: 'error', error: err?.message || 'Heartbeat exception' };
    }
  },

  async getCurrentLocalSession(): Promise<TerminalSession | null> {
    const sessions = await db.terminalSessions.toArray();
    const session = sessions.length > 0 ? sessions[0] : null;
    if (typeof window !== 'undefined') {
      if (session) {
        localStorage.setItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_TERMINAL_SESSION_KEY);
      }
    }
    return session;
  }
};
