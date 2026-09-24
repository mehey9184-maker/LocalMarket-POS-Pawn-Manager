import { terminalSessionsApi } from './supabaseApi';
import { db } from '../db';
import { TerminalSession } from '../types';

const HEARTBEAT_INTERVAL = 60000; // 1 minute
const LOCAL_STORAGE_DEVICE_ID_KEY = 'localmarket_device_id';

export const terminalService = {
  getDeviceId(): string {
    let deviceId = localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `term-${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem(LOCAL_STORAGE_DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  },

  async checkActiveSession() {
    return await terminalSessionsApi.checkActiveSessionRpc();
  },

  async activateSession(terminalName?: string) {
    const deviceId = this.getDeviceId();
    const res = await terminalSessionsApi.activateSessionRpc(deviceId, terminalName);
    
    if (res.success && res.session_id) {
      const session: TerminalSession = {
        id: res.session_id,
        shopId: '', // Will be filled by sync or profile
        userId: '', // Will be filled by profile
        userName: '',
        deviceId,
        activatedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        status: 'active'
      };
      
      // Store locally in Dexie
      await db.terminalSessions.clear();
      await db.terminalSessions.add(session);
      
      return { success: true, sessionId: res.session_id };
    }
    
    return res;
  },

  async heartbeat(sessionId: string) {
    const res = await terminalSessionsApi.heartbeatRpc(sessionId);
    
    if (res.status === 'active') {
      await db.terminalSessions.update(sessionId, {
        lastHeartbeatAt: new Date().toISOString()
      });
    } else if (res.status === 'invalidated' || res.status === 'expired') {
      await db.terminalSessions.update(sessionId, {
        status: res.status,
        invalidatedAt: (res as any).invalidated_at
      });
    }
    
    return res;
  },

  async getCurrentLocalSession(): Promise<TerminalSession | null> {
    const sessions = await db.terminalSessions.toArray();
    return sessions.length > 0 ? sessions[0] : null;
  }
};
