import { db } from '../db';
import { WorkflowDraft } from '../types';

export const draftService = {
  async saveDraft(draft: Omit<WorkflowDraft, 'updatedAt' | 'createdAt' | 'status'> & { status?: 'active' | 'completed' | 'discarded' }): Promise<string> {
    const now = new Date().toISOString();
    
    if (!draft.shopId) {
      throw new Error('Missing shop context for draft saving.');
    }

    const existing = await db.workflowDrafts.get(draft.id);
    if (existing && existing.shopId !== draft.shopId) {
      throw new Error('Access Denied: Draft belongs to another shop.');
    }

    const record: WorkflowDraft = {
      ...draft,
      status: draft.status || 'active',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await db.workflowDrafts.put(record);
    return record.id;
  },

  async getActiveDrafts(userId: string, shopId: string, workflowType?: 'buy' | 'pawn' | 'existing'): Promise<WorkflowDraft[]> {
    let query = db.workflowDrafts
      .where('shopId').equals(shopId)
      .and(d => d.userId === userId && d.status === 'active');
    
    const drafts = await query.toArray();
    if (workflowType) {
      return drafts.filter(d => d.workflowType === workflowType);
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getDraft(id: string, shopId: string): Promise<WorkflowDraft | undefined> {
    const draft = await db.workflowDrafts.get(id);
    if (draft && draft.shopId === shopId) return draft;
    return undefined;
  },

  async closeDraft(id: string, shopId: string): Promise<void> {
    const draft = await db.workflowDrafts.get(id);
    if (!draft || draft.shopId !== shopId) return;

    await db.workflowDrafts.update(id, {
      status: 'completed',
      updatedAt: new Date().toISOString()
    });
  },

  async discardDraft(id: string, shopId: string): Promise<void> {
    const draft = await db.workflowDrafts.get(id);
    if (!draft || draft.shopId !== shopId) return;

    await db.workflowDrafts.update(id, {
      status: 'discarded',
      updatedAt: new Date().toISOString()
    });
  }
};
