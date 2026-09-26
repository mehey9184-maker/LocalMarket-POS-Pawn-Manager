import { db } from '../db';
import { WorkflowDraft } from '../types';

export const draftService = {
  async saveDraft(draft: Omit<WorkflowDraft, 'updatedAt' | 'createdAt' | 'status'> & { status?: 'active' | 'completed' | 'discarded'; shopId: string }): Promise<string> {
    if (!draft.shopId) {
      throw new Error('shopId is required to save a draft');
    }
    const now = new Date().toISOString();
    const existing = await db.workflowDrafts.get(draft.id);

    const record: WorkflowDraft = {
      ...draft,
      shopId: draft.shopId,
      status: draft.status || 'active',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await db.workflowDrafts.put(record);
    return record.id;
  },

  async getActiveDrafts(userId: string, shopId: string, workflowType?: 'buy' | 'pawn' | 'existing'): Promise<WorkflowDraft[]> {
    if (!shopId) {
      return [];
    }
    let query = db.workflowDrafts.where('userId').equals(userId).and(d => d.shopId === shopId && d.status === 'active');
    const drafts = await query.toArray();
    if (workflowType) {
      return drafts.filter(d => d.workflowType === workflowType);
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getDraft(id: string, shopId?: string): Promise<WorkflowDraft | undefined> {
    const draft = await db.workflowDrafts.get(id);
    if (!draft) return undefined;
    if (shopId && draft.shopId !== shopId) return undefined;
    return draft;
  },

  async closeDraft(id: string, shopId: string): Promise<void> {
    if (!shopId) {
      throw new Error('shopId is required to close draft');
    }
    const draft = await db.workflowDrafts.get(id);
    if (draft && draft.shopId && draft.shopId !== shopId) {
      throw new Error('Access Denied: Draft does not belong to active shop.');
    }
    await db.workflowDrafts.update(id, {
      status: 'completed',
      updatedAt: new Date().toISOString()
    });
  },

  async discardDraft(id: string, shopId: string): Promise<void> {
    if (!shopId) {
      throw new Error('shopId is required to discard draft');
    }
    const draft = await db.workflowDrafts.get(id);
    if (draft && draft.shopId && draft.shopId !== shopId) {
      throw new Error('Access Denied: Draft does not belong to active shop.');
    }
    await db.workflowDrafts.update(id, {
      status: 'discarded',
      updatedAt: new Date().toISOString()
    });
  }
};
