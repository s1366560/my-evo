/**
 * MSW Mock Handlers - Index
 * 
 * Re-exports all handlers for easy importing.
 * Usage:
 *   import { worker } from '@/lib/api/mocks/browser';
 *   import { allHandlers } from '@/lib/api/mocks';
 */

export { worker } from './browser';

// Re-export all handler arrays
export { authHandlers, sessionHandlers } from './handlers-auth';
export { bountyHandlers, mockBounty, mockBountyList } from './handlers-bounty';
export { workspaceHandlers, mockWorkspace, mockWorkspaceMembers } from './handlers-workspace';
export { creditsHandlers, mockCredits, mockCreditsHistory } from './handlers-credits';
export { marketplaceHandlers, mockListing, mockListingList } from './handlers-marketplace';
export { gdiHandlers, mockGDIWeights, mockGDIConfig } from './handlers-gdi';
export { dashboardHandlers } from './handlers-dashboard';
export { a2aBffHandlers } from './handlers-a2a-bff';

// Re-export shared utilities
export { MOCK_USER_ID, MOCK_WORKSPACE_ID, delay } from './handlers';

// Combine all handlers for convenience
import { handlers } from './handlers';
import { authHandlers, sessionHandlers } from './handlers-auth';
import { bountyHandlers } from './handlers-bounty';
import { workspaceHandlers } from './handlers-workspace';
import { creditsHandlers } from './handlers-credits';
import { marketplaceHandlers } from './handlers-marketplace';
import { gdiHandlers } from './handlers-gdi';
import { dashboardHandlers } from './handlers-dashboard';
import { a2aBffHandlers } from './handlers-a2a-bff';

export const allHandlers = [
  ...handlers,
  ...authHandlers,
  ...sessionHandlers,
  ...bountyHandlers,
  ...workspaceHandlers,
  ...creditsHandlers,
  ...marketplaceHandlers,
  ...gdiHandlers,
  ...dashboardHandlers,
  ...a2aBffHandlers,
];
