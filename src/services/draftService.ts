import { db } from '../db';
import { WorkflowDraft } from '../types';

export const draftService = {
  async saveDraft(draft: Omit<WorkflowDraft, 'updatedAt' | 'createdAt' | 'status'> & { status?: 'active' | 'completed' | 'discarded' }): Promise<string> {
    const now = new Date().toISOString();
    const existing = await db.workflowDrafts.get(draft.id);

    const record: WorkflowDraft = {
      ...draft,
      status: draft.status || 'active',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await db.workflowDrafts.put(record);
    return record.id;
  },

  async getActiveDrafts(userId: string, workflowType?: 'buy' | 'pawn' | 'existing'): Promise<WorkflowDraft[]> {
    let query = db.workflowDrafts.where('userId').equals(userId).and(d => d.status === 'active');
    const drafts = await query.toArray();
    if (workflowType) {
      return drafts.filter(d => d.workflowType === workflowType);
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getDraft(id: string): Promise<WorkflowDraft | undefined> {
    return await db.workflowDrafts.get(id);
  },

  async closeDraft(id: string): Promise<void> {
    await db.workflowDrafts.update(id, {
      status: 'completed',
      updatedAt: new Date().toISOString()
    });
  },

  async discardDraft(id: string): Promise<void> {
    await db.workflowDrafts.update(id, {
      status: 'discarded',
      updatedAt: new Date().toISOString()
    });
  }
};
