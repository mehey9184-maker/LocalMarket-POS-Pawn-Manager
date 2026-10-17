/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../types/supabase';

/**
 * Pure authorization helper for Analysis feature access.
 * Strictly restricted to permanent management roles:
 * - 'manager'
 * - 'owner'
 * - 'admin'
 *
 * Cashier and Senior Cashier accounts NEVER gain Analysis access,
 * even when temporary managerElevation is active for operational approvals.
 */
export function isPermanentManagerRole(role: UserRole | string | null | undefined): boolean {
  if (!role) return false;
  return role === 'manager' || role === 'owner' || role === 'admin';
}

export const isAnalysisAuthorizedRole = isPermanentManagerRole;

export function canAccessAnalysis(role: UserRole | string | null | undefined, _elevationIgnored = false): boolean {
  return isPermanentManagerRole(role);
}
